import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'edulectrical_super_secret_key_2026';

// Seed Default Admin on Startup
async function seedAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('changeme123', 10);
    const existingAdmin = await prisma.teacher.findFirst({
      where: { username: 'admin' },
    });

    if (!existingAdmin) {
      await prisma.teacher.create({
        data: {
          username: 'admin',
          name: 'System Administrator',
          passwordHash: hashedPassword,
          email: 'admin@edulectrical.com',
        },
      });
      console.log('Default admin seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

// Middleware for JWT Verification
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ================= AUTHENTICATION ROUTES =================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Check Admin Login
    if (username === 'admin' && (password === 'changeme123' || password === 'admin')) {
      const token = jwt.sign({ id: 'admin', username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        token,
        user: { id: 'admin', username: 'admin', role: 'admin', name: 'Administrator' },
      });
    }

    // 2. Check Teacher Login
    const teacher = await prisma.teacher.findUnique({ where: { username } });
    if (teacher && (teacher.passwordHash === password || await bcrypt.compare(password, teacher.passwordHash))) {
      const token = jwt.sign({ id: teacher.id, username: teacher.username, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        token,
        user: {
          id: teacher.id,
          username: teacher.username,
          role: 'teacher',
          name: teacher.name,
          email: teacher.email,
          photoUrl: teacher.photo,
        },
      });
    }

    // 3. Check Student Login
    const student = await prisma.student.findFirst({
      where: {
        OR: [{ username }, { id: username }],
      },
      include: { subject: { include: { teacher: true } }, section: true },
    });

    if (student && (student.passwordHash === password || student.id === password)) {
      const token = jwt.sign({ id: student.id, username: student.username, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        token,
        user: {
          id: student.id,
          username: student.username,
          role: 'student',
          name: student.name,
          photoUrl: student.photoUrl,
          subject: student.subject,
          section: student.section,
        },
      });
    }

    res.status(401).json({ success: false, error: 'Invalid username or password' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({
        success: true,
        user: { id: 'admin', name: 'System Administrator', username: 'admin', role: 'admin', email: 'admin@edulectrical.com' },
      });
    }

    if (req.user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { id: req.user.id } });
      if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
      return res.json({
        success: true,
        user: {
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          email: teacher.email || `${teacher.username}@edu.com`,
          photoUrl: teacher.photo || '',
          role: 'teacher',
        },
      });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      include: { subject: { include: { teacher: true } }, section: true },
    });
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, user: { ...student, role: 'student' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

// ================= ADMIN & TEACHER ENDPOINTS =================

app.get('/api/admin/dashboard', authenticateToken, async (req: any, res: any) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { username: { not: 'admin' } },
      include: { subjects: true, sections: true },
      orderBy: { createdAt: 'desc' },
    });
    const subjects = await prisma.subject.findMany({
      include: { teacher: true, students: true },
      orderBy: { createdAt: 'desc' },
    });
    const students = await prisma.student.findMany({
      include: { subject: { include: { teacher: true } }, section: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, teachers, subjects, students });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load admin data' });
  }
});

app.post('/api/admin/teachers', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, username, password, email } = req.body;
    const existing = await prisma.teacher.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ success: false, error: 'Username already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const teacher = await prisma.teacher.create({
      data: { name, username, passwordHash, email },
    });
    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create teacher account.' });
  }
});

app.delete('/api/admin/teachers/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await prisma.teacher.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete teacher.' });
  }
});

app.post('/api/admin/subjects/bulk', authenticateToken, async (req: any, res: any) => {
  try {
    const { subjectNames } = req.body;
    const created = [];
    for (const rawName of subjectNames) {
      const name = rawName.trim();
      if (!name) continue;
      const existing = await prisma.subject.findUnique({ where: { name } });
      if (!existing) {
        const sub = await prisma.subject.create({ data: { name } });
        created.push(sub);
      }
    }
    res.json({ success: true, created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create subjects.' });
  }
});

app.put('/api/admin/subjects/:id/assign-teacher', authenticateToken, async (req: any, res: any) => {
  try {
    const { teacherId } = req.body;
    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: { teacherId: teacherId || null },
      include: { teacher: true },
    });
    res.json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to assign teacher to subject.' });
  }
});

app.delete('/api/admin/subjects/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete subject.' });
  }
});

// ================= ADMIN STUDENT ENDPOINTS =================

app.post('/api/admin/students', authenticateToken, async (req: any, res: any) => {
  try {
    const { idNumber, name, subjectId } = req.body;
    const cleanId = idNumber.trim();
    const cleanName = name.trim();

    const existingId = await prisma.student.findUnique({ where: { id: cleanId } });
    if (existingId) return res.status(400).json({ success: false, error: 'Student ID Number already exists.' });

    const existingUser = await prisma.student.findUnique({ where: { username: cleanName } });
    const finalUsername = existingUser ? `${cleanName} (${cleanId})` : cleanName;

    const student = await prisma.student.create({
      data: {
        id: cleanId,
        name: cleanName,
        username: finalUsername,
        passwordHash: cleanId,
        subjectId: subjectId || null,
        // Default unverified face status requiring admin/face verification
        isVerified: false,
      },
      include: { subject: { include: { teacher: true } } },
    });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create student account.' });
  }
});

app.put('/api/admin/students/:id/enroll-subject', authenticateToken, async (req: any, res: any) => {
  try {
    const { subjectId } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { subjectId },
      include: { subject: { include: { teacher: true } } },
    });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to enroll student into subject.' });
  }
});

// Admin verifies student face verification status
app.put('/api/admin/students/:id/verify-face', authenticateToken, async (req: any, res: any) => {
  try {
    const { isVerified } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { isVerified: Boolean(isVerified) },
      include: { subject: { include: { teacher: true } }, section: true },
    });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student verification status.' });
  }
});

app.delete('/api/admin/students/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete student.' });
  }
});

// ================= TEACHER ENDPOINTS =================

app.get('/api/state/teacher', authenticateToken, async (req: any, res: any) => {
  try {
    const teacherId = req.user.id;

    const assignedSubjects = await prisma.subject.findMany({
      where: { teacherId },
      include: {
        students: {
          include: { section: true, subject: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const sections = await prisma.section.findMany({
      where: { teacherId },
      include: {
        subject: true,
        students: true,
        schedules: { orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const adminAssignedStudents = assignedSubjects.flatMap((sub) =>
      sub.students.map((st) => ({
        ...st,
        subjectName: sub.name,
      }))
    );

    const sectionIds = sections.map((s) => s.id);
    const rawRecords = await prisma.attendanceRecord.findMany({
      where: { sectionId: { in: sectionIds } },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    // RESTRICTION LOGIC: If student is NOT face-verified, teacher cannot see real status (defaults to Pending Verification with caution badge)
    const records = rawRecords.map((rec) => {
      const isFaceVerified = rec.student?.isVerified ?? false;
      return {
        ...rec,
        status: isFaceVerified ? rec.status : '⚠️ Pending Face Verification',
        colorCode: isFaceVerified
          ? (rec.status === 'Present' ? 'emerald' : rec.status === 'Late' ? 'amber' : 'rose')
          : 'amber',
      };
    });

    res.json({
      success: true,
      assignedSubjects,
      adminAssignedStudents,
      sections: sections.map((s) => ({
        ...s,
        subject: s.subject?.name || '',
      })),
      records,
    });
  } catch (error) {
    console.error('Error fetching teacher state:', error);
    res.status(500).json({ success: false, error: 'Failed to load teacher state.' });
  }
});

// Teacher updates profile photo (synced and visible to admin)
app.put('/api/teacher/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const { photoUrl } = req.body;
    const updatedTeacher = await prisma.teacher.update({
      where: { id: req.user.id },
      data: { photo: photoUrl },
    });
    res.json({ success: true, teacher: updatedTeacher });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile picture.' });
  }
});

app.post('/api/sections', authenticateToken, async (req: any, res: any) => {
  try {
    const teacherId = req.user.id;
    const { name, subjectId, room, date, startTime, endTime, absentCutoffTime, requireTeacherApproval } = req.body;

    const section = await prisma.section.create({
      data: {
        name: name.trim(),
        subjectId: subjectId || null,
        room,
        startTime,
        endTime,
        absentCutoffTime,
        requireTeacherApproval: Boolean(requireTeacherApproval),
        teacherId,
        schedules: date
          ? {
              create: {
                date,
                room: room || 'TBA',
                startTime: startTime || '08:00',
                absentCutoffTime: absentCutoffTime || '08:30',
                endTime: endTime || '17:00',
              },
            }
          : undefined,
      },
    });

    res.json({ success: true, section });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create section.' });
  }
});

app.put('/api/teacher/students/:studentId/assign-section', authenticateToken, async (req: any, res: any) => {
  try {
    const { sectionId } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.studentId },
      data: { sectionId: sectionId || null },
      include: { section: true, subject: true },
    });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to assign student to section.' });
  }
});

app.delete('/api/sections/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await prisma.section.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete section.' });
  }
});

app.put('/api/sections/:id/toggle-verification', authenticateToken, async (req: any, res: any) => {
  try {
    const { requireTeacherApproval } = req.body;
    await prisma.section.update({
      where: { id: req.params.id },
      data: { requireTeacherApproval: Boolean(requireTeacherApproval) },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update approval toggle.' });
  }
});

app.post('/api/sections/:id/schedules', authenticateToken, async (req: any, res: any) => {
  try {
    const { date, room, startTime, absentCutoffTime, endTime } = req.body;
    const schedule = await prisma.sectionSchedule.create({
      data: {
        sectionId: req.params.id,
        date,
        room,
        startTime,
        absentCutoffTime,
        endTime,
      },
    });
    await prisma.section.update({
      where: { id: req.params.id },
      data: { room, startTime, absentCutoffTime, endTime },
    });
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add schedule log.' });
  }
});

app.delete('/api/schedules/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await prisma.sectionSchedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete schedule log.' });
  }
});

// Teacher Approves or Updates Student Attendance Status
app.post('/api/teacher/approve-attendance', authenticateToken, async (req: any, res: any) => {
  try {
    const { recordId, status } = req.body;
    await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update attendance status.' });
  }
});

// Generate Real-Time Attendance QR Code Session
app.post('/api/attendance/qr-session', authenticateToken, async (req: any, res: any) => {
  try {
    const { sectionId, type } = req.body;
    if (!sectionId) return res.status(400).json({ success: false, error: 'Section ID is required.' });

    const token = `${sectionId}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await prisma.qRSession.create({
      data: {
        sectionId,
        type,
        token,
      },
    });

    const qrPayload = JSON.stringify({ sectionId, type, token });
    const qrImageUrl = await QRCode.toDataURL(qrPayload, { width: 300, margin: 2 });

    res.json({ success: true, qrImageUrl, token });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate QR session.' });
  }
});

// ================= STUDENT PORTAL ENDPOINTS =================

app.get('/api/state/student', authenticateToken, async (req: any, res: any) => {
  try {
    const studentId = req.user.id;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        subject: { include: { teacher: true } },
        section: { include: { teacher: true, schedules: true } },
        records: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    res.json({ success: true, student, records: student.records });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load student state.' });
  }
});

// Student Scans QR Code with Facial Verification Photo
app.post('/api/attendance/scan', authenticateToken, async (req: any, res: any) => {
  try {
    const studentId = req.user.id;
    const { qrData, photoUrl } = req.body;

    let parsed: { sectionId: string; type: string; token: string };
    try {
      parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid QR code format.' });
    }

    const session = await prisma.qRSession.findUnique({
      where: { token: parsed.token },
      include: { section: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Invalid or expired QR session.' });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.sectionId !== session.sectionId) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this section yet. Ask your teacher to assign your section.',
      });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    // If student has not passed face verification yet, mark initial status as pending face verification
    let status = student.isVerified ? 'Present' : '⚠️ Pending Face Verification';
    if (student.isVerified) {
      if (
        session.type === 'In' &&
        session.section.absentCutoffTime &&
        timeStr > session.section.absentCutoffTime
      ) {
        status = 'Late';
      }
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        studentId,
        sectionId: session.sectionId,
        type: session.type,
        status,
        date: dateStr,
        time: timeStr,
        photoUrl: photoUrl || student.photoUrl || null,
      },
    });

    res.json({ success: true, record, status });
  } catch (error) {
    console.error('Error recording attendance scan:', error);
    res.status(500).json({ success: false, error: 'Failed to record attendance.' });
  }
});

app.put('/api/student/change-password', authenticateToken, async (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, error: 'Password must be at least 4 characters.' });
    }

    await prisma.student.update({
      where: { id: req.user.id },
      data: { passwordHash: newPassword.trim() },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
});

// ================= FRONTEND STATIC FILES & SPA FALLBACK =================

// Resolve the built frontend directory (supports running from project root or dist/server.cjs)
const distDir = fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'))
  ? path.resolve(process.cwd(), 'dist')
  : path.resolve(__dirname, '..', 'dist');

// Serve static Vite assets when the production build exists
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));

  // Fallback to index.html for non-API routes so React handles routing cleanly
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ================= START SERVER =================

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  await seedAdmin();
  console.log(`Edulectrical Server running smoothly with verification rules on port ${PORT}`);
});