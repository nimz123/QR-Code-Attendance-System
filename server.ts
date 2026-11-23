import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.PORT || 5001);
const JWT_SECRET = process.env.JWT_SECRET || 'qr_attendance_super_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
}

async function generateUnique6DigitId(model: 'teacher' | 'student'): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    if (model === 'teacher') {
      const existing = await prisma.teacher.findUnique({ where: { id: candidate } });
      if (!existing) return candidate;
    } else {
      const existing = await prisma.student.findUnique({ where: { id: candidate } });
      if (!existing) return candidate;
    }
  }
  return `${Date.now()}`.slice(-6);
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ success: true, status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Health check failed:', err);
    return res.status(500).json({ success: false, status: 'error' });
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const rawIdentifier = String(
      req.body?.username ?? req.body?.idNumber ?? req.body?.email ?? ''
    ).trim();
    const password = String(req.body?.password ?? '').trim();
    const requestedRole = String(req.body?.role ?? '').trim().toLowerCase();

    if (!rawIdentifier || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'ID/Username and password are required' });
    }

    // 1. Admin login
    if (
      rawIdentifier.toLowerCase() === 'admin' &&
      (password === 'changeme123' || password === 'admin')
    ) {
      if (requestedRole && requestedRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access Denied' });
      }
      const token = jwt.sign(
        { id: 'admin', username: 'admin', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        token,
        user: {
          id: 'admin',
          username: 'admin',
          role: 'admin',
          name: 'Administrator',
          email: 'admin@edu.com',
        },
      });
    }

    // 2. Teacher login
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { id: rawIdentifier },
          { username: { equals: rawIdentifier, mode: 'insensitive' } },
          { email: { equals: rawIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (teacher) {
      const isTeacherPasswordValid =
        teacher.passwordHash === password ||
        (await bcrypt.compare(password, teacher.passwordHash).catch(() => false));

      if (isTeacherPasswordValid) {
        if (requestedRole && requestedRole !== 'teacher') {
          return res.status(403).json({ success: false, error: 'Access Denied' });
        }
        const token = jwt.sign(
          { id: teacher.id, username: teacher.username, role: 'teacher' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({
          success: true,
          token,
          user: {
            id: teacher.id,
            username: teacher.username,
            role: 'teacher',
            name: teacher.name,
            email: teacher.email || '',
            photoUrl: teacher.photo || '',
          },
        });
      }
    }

    // 3. Student login (exact ID first, then case-insensitive username/name + password validation)
    const isPassValidForStudent = async (st: any): Promise<boolean> => {
      if (!st) return false;
      if (st.passwordHash) {
        const matchedHash = await bcrypt.compare(password, st.passwordHash).catch(() => false);
        if (matchedHash) return true;
        if (password === st.passwordHash) return true;
      }
      if (password === st.id) return true;
      return false;
    };

    let matchedStudent = await prisma.student.findUnique({
      where: { id: rawIdentifier },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    if (matchedStudent) {
      const valid = await isPassValidForStudent(matchedStudent);
      if (!valid) matchedStudent = null;
    } else {
      const candidates = await prisma.student.findMany({
        where: {
          OR: [
            { username: { equals: rawIdentifier, mode: 'insensitive' } },
            { name: { equals: rawIdentifier, mode: 'insensitive' } },
          ],
        },
        include: {
          subject: { include: { teacher: true } },
          section: true,
        },
      });

      for (const candidate of candidates) {
        if (await isPassValidForStudent(candidate)) {
          matchedStudent = candidate;
          break;
        }
      }
    }

    // Fallback sync: if a student with this name/username is not yet in DB and uses a 6-digit default password,
    // persist it into PostgreSQL so login & subsequent password changes work immediately.
    if (!matchedStudent && /^\d{6}$/.test(password) && !/^\d+$/.test(rawIdentifier)) {
      const existingNameOrUname = await prisma.student.findFirst({
        where: {
          OR: [
            { username: { equals: rawIdentifier, mode: 'insensitive' } },
            { name: { equals: rawIdentifier, mode: 'insensitive' } },
          ],
        },
      });
      const existingId = await prisma.student.findUnique({ where: { id: password } });

      if (!existingNameOrUname && !existingId) {
        const passwordHash = await bcrypt.hash(password, 10);
        matchedStudent = await prisma.student.create({
          data: {
            id: password,
            name: rawIdentifier,
            username: rawIdentifier,
            passwordHash,
            isVerified: false,
          },
          include: {
            subject: { include: { teacher: true } },
            section: true,
          },
        });
      }
    }

    if (matchedStudent) {
      if (requestedRole && requestedRole !== 'student') {
        return res.status(403).json({ success: false, error: 'Access Denied' });
      }
      const token = jwt.sign(
        { id: matchedStudent.id, username: matchedStudent.username, role: 'student' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        token,
        user: {
          id: matchedStudent.id,
          username: matchedStudent.username,
          role: 'student',
          name: matchedStudent.name,
          photoUrl: matchedStudent.photoUrl || matchedStudent.biometricPhoto || '',
          isVerified: Boolean(matchedStudent.isVerified),
          sectionId: matchedStudent.sectionId || null,
          subjectId: matchedStudent.subjectId || null,
          subject: matchedStudent.subject || null,
          section: matchedStudent.section || null,
        },
      });
    }

    return res
      .status(401)
      .json({ success: false, error: 'Invalid ID/username or password' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

app.get('/api/auth/me', verifyToken, async (req: any, res) => {
  try {
    const { id, role } = req.user || {};

    if (role === 'admin') {
      return res.json({
        success: true,
        user: {
          id: 'admin',
          username: 'admin',
          role: 'admin',
          name: 'Administrator',
          email: 'admin@edu.com',
        },
      });
    }

    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { id } });
      if (!teacher) {
        return res.status(404).json({ success: false, error: 'Teacher not found' });
      }
      return res.json({
        success: true,
        user: {
          id: teacher.id,
          username: teacher.username,
          role: 'teacher',
          name: teacher.name,
          email: teacher.email || '',
          photoUrl: teacher.photo || '',
        },
      });
    }

    if (role === 'student') {
      const student = await prisma.student.findUnique({
        where: { id },
        include: {
          subject: { include: { teacher: true } },
          section: true,
        },
      });
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      return res.json({
        success: true,
        user: {
          id: student.id,
          username: student.username,
          role: 'student',
          name: student.name,
          photoUrl: student.photoUrl || student.biometricPhoto || '',
          isVerified: Boolean(student.isVerified),
          sectionId: student.sectionId || null,
          subjectId: student.subjectId || null,
          subject: student.subject || null,
          section: student.section || null,
        },
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid user role' });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch current user' });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

app.get('/api/state/admin', verifyToken, async (_req, res) => {
  try {
    const [teachers, students, subjects, sections, records] = await Promise.all([
      prisma.teacher.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.student.findMany({
        include: {
          subject: { include: { teacher: true } },
          section: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subject.findMany({
        include: {
          teacher: true,
          students: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.section.findMany({
        include: {
          teacher: true,
          students: true,
          schedules: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceRecord.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      teachers,
      students,
      subjects,
      sections,
      records,
    });
  } catch (err) {
    console.error('GET /api/state/admin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load admin state' });
  }
});

app.post('/api/admin/teachers', verifyToken, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || name).trim();
    const email = String(
      req.body?.email || `${username.toLowerCase().replace(/\s+/g, '.')}@edu.com`
    ).trim();
    const rawPassword = String(req.body?.password || '').trim();

    if (!name || !username) {
      return res.status(400).json({ success: false, error: 'Name and username are required' });
    }

    const id = await generateUnique6DigitId('teacher');
    const passwordToHash = rawPassword || id;
    const passwordHash = await bcrypt.hash(passwordToHash, 10);

    const teacher = await prisma.teacher.create({
      data: {
        id,
        name,
        username,
        email,
        passwordHash,
      },
    });

    return res.json({
      success: true,
      teacher,
      defaultPassword: passwordToHash,
    });
  } catch (err: any) {
    console.error('POST /api/admin/teachers error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create teacher' });
  }
});

app.delete('/api/admin/teachers/:id', verifyToken, async (req, res) => {
  try {
    const teacherId = String(req.params.id);
    await prisma.teacher.delete({ where: { id: teacherId } });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/admin/teachers/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete teacher' });
  }
});

app.post('/api/admin/subjects/bulk', verifyToken, async (req, res) => {
  try {
    const teacherId = req.body?.teacherId ? String(req.body.teacherId).trim() : null;
    const rawSubjects = Array.isArray(req.body?.subjects)
      ? req.body.subjects.map((item: any) => (typeof item === 'string' ? item : item?.name))
      : Array.isArray(req.body?.names)
      ? req.body.names
      : String(req.body?.name || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const cleanedNames = rawSubjects
      .map((s: any) => String(s || '').trim())
      .filter((s: string) => s.length > 0);

    if (cleanedNames.length === 0) {
      return res.status(400).json({ success: false, error: 'Subject name is required' });
    }

    const createdSubjects = [];
    for (const subName of cleanedNames) {
      const created = await prisma.subject.upsert({
        where: { name: subName },
        update: {
          ...(teacherId ? { teacherId } : {}),
        },
        create: {
          name: subName,
          teacherId: teacherId || null,
        },
        include: { teacher: true, students: true },
      });
      createdSubjects.push(created);
    }

    return res.json({
      success: true,
      subjects: createdSubjects,
      subject: createdSubjects[0],
    });
  } catch (err: any) {
    console.error('POST /api/admin/subjects/bulk error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create subject' });
  }
});

app.delete('/api/admin/subjects/:id', verifyToken, async (req, res) => {
  try {
    const subjectId = String(req.params.id);
    await prisma.subject.delete({ where: { id: subjectId } });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/admin/subjects/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete subject' });
  }
});

app.put('/api/admin/subjects/:id/assign-teacher', verifyToken, async (req, res) => {
  try {
    const subjectId = String(req.params.id);
    const teacherId = req.body?.teacherId ? String(req.body.teacherId).trim() : null;

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: { teacherId },
      include: { teacher: true, students: true },
    });

    return res.json({ success: true, subject: updated });
  } catch (err: any) {
    console.error('PUT /api/admin/subjects/:id/assign-teacher error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to assign teacher' });
  }
});

// Create Student: Username = Full Name, 6-digit = Default Password
app.post('/api/admin/students', verifyToken, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Student name is required' });
    }

    const generatedId = await generateUnique6DigitId('student');
    const providedId = String(req.body?.id || req.body?.studentId || '').trim();
    const studentId = providedId || generatedId;

    const defaultPassword = String(
      req.body?.password || req.body?.defaultPassword || generatedId
    ).trim();

    const desiredUsername = String(req.body?.username || name).trim();
    const existingByUsername = await prisma.student.findUnique({
      where: { username: desiredUsername },
    });
    const finalUsername = existingByUsername ? `${name} (${studentId})` : desiredUsername;

    const subjectId = req.body?.subjectId ? String(req.body.subjectId).trim() : null;
    const sectionId = req.body?.sectionId ? String(req.body.sectionId).trim() : null;
    const photoUrl = typeof req.body?.photoUrl === 'string' ? req.body.photoUrl : null;

    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const existingById = await prisma.student.findUnique({ where: { id: studentId } });
    if (existingById) {
      return res.status(409).json({ success: false, error: `Student ID ${studentId} already exists` });
    }

    const createdStudent = await prisma.student.create({
      data: {
        id: studentId,
        name,
        username: finalUsername,
        passwordHash,
        subjectId,
        sectionId,
        photoUrl,
        biometricPhoto: photoUrl,
        isVerified: Boolean(photoUrl),
      },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    return res.json({
      success: true,
      student: {
        ...createdStudent,
        password: defaultPassword,
        defaultPassword,
      },
      credentials: {
        studentId: createdStudent.id,
        username: createdStudent.username,
        defaultPassword,
      },
    });
  } catch (err: any) {
    console.error('POST /api/admin/students error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to register student' });
  }
});

app.delete('/api/admin/students/:id', verifyToken, async (req, res) => {
  try {
    const studentId = String(req.params.id);
    await prisma.student.delete({ where: { id: studentId } });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/admin/students/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete student' });
  }
});

app.put('/api/admin/students/:id/enroll-subject', verifyToken, async (req, res) => {
  try {
    const studentId = String(req.params.id);
    const subjectId = req.body?.subjectId ? String(req.body.subjectId).trim() : null;

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { subjectId },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    return res.json({ success: true, student: updated });
  } catch (err: any) {
    console.error('PUT /api/admin/students/:id/enroll-subject error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to enroll student' });
  }
});

app.post('/api/admin/assign-student-teacher', verifyToken, async (req, res) => {
  try {
    const studentId = String(req.body?.studentId || '').trim();
    const subjectId = req.body?.subjectId ? String(req.body.subjectId).trim() : null;
    const sectionId = req.body?.sectionId ? String(req.body.sectionId).trim() : null;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        ...(subjectId ? { subjectId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    return res.json({ success: true, student: updated });
  } catch (err: any) {
    console.error('POST /api/admin/assign-student-teacher error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to assign student to teacher' });
  }
});

// ==========================================
// TEACHER ROUTES
// ==========================================

app.get('/api/state/teacher', verifyToken, async (req: any, res) => {
  try {
    const teacherId = String(req.user?.id || '');

    const [assignedSubjects, sections, allStudents, records] = await Promise.all([
      prisma.subject.findMany({
        where: { teacherId },
        include: { students: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.section.findMany({
        where: { teacherId },
        include: {
          students: {
            include: { subject: true, section: true },
          },
          schedules: {
            orderBy: { date: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.findMany({
        include: {
          subject: { include: { teacher: true } },
          section: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceRecord.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const assignedSubjectIds = new Set(assignedSubjects.map((s) => s.id));
    const sectionIds = new Set(sections.map((sec) => sec.id));

    const adminAssignedStudents = allStudents.filter(
      (st) =>
        (st.subjectId && assignedSubjectIds.has(st.subjectId)) ||
        (st.sectionId && sectionIds.has(st.sectionId))
    );

    const teacherRecords = records.filter((rec) => sectionIds.has(rec.sectionId));

    return res.json({
      success: true,
      assignedSubjects,
      adminAssignedStudents,
      sections,
      records: teacherRecords,
    });
  } catch (err) {
    console.error('GET /api/state/teacher error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load teacher dashboard state' });
  }
});

app.put('/api/teacher/profile', verifyToken, async (req: any, res) => {
  try {
    const teacherId = String(req.user?.id || '');
    const photoValue = String(req.body?.photoUrl ?? req.body?.avatar ?? req.body?.photo ?? '');

    const updated = await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        photo: photoValue,
      },
    });

    return res.json({
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        role: 'teacher',
        name: updated.name,
        email: updated.email || '',
        photoUrl: updated.photo || '',
      },
    });
  } catch (err: any) {
    console.error('PUT /api/teacher/profile error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update teacher profile' });
  }
});

app.post('/api/sections', verifyToken, async (req: any, res) => {
  try {
    const teacherId = String(req.user?.id || '');
    const name = String(req.body?.name || '').trim();
    const subjectId = req.body?.subjectId ? String(req.body.subjectId).trim() : null;
    const room = String(req.body?.room || '').trim();
    const date = String(req.body?.date || new Date().toISOString().split('T')[0]).trim();
    const startTime = String(req.body?.startTime || '08:00').trim();
    const endTime = String(req.body?.endTime || '17:00').trim();
    const absentCutoffTime = String(req.body?.absentCutoffTime || '08:30').trim();
    const requireTeacherApproval = Boolean(req.body?.requireTeacherApproval);

    if (!name) {
      return res.status(400).json({ success: false, error: 'Section name is required' });
    }

    const section = await prisma.section.create({
      data: {
        name,
        teacherId,
        subjectId,
        room,
        startTime,
        endTime,
        absentCutoffTime,
        requireTeacherApproval,
        schedules: {
          create: {
            date,
            room,
            startTime,
            absentCutoffTime,
            endTime,
          },
        },
      },
      include: {
        students: true,
        schedules: true,
      },
    });

    return res.json({ success: true, section });
  } catch (err: any) {
    console.error('POST /api/sections error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create section' });
  }
});

app.delete('/api/sections/:id', verifyToken, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    await prisma.sectionSchedule.deleteMany({ where: { sectionId } });
    await prisma.student.updateMany({
      where: { sectionId },
      data: { sectionId: null },
    });
    await prisma.section.delete({ where: { id: sectionId } });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/sections/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete section' });
  }
});

app.put('/api/sections/:id/toggle-verification', verifyToken, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const requireTeacherApproval = Boolean(req.body?.requireTeacherApproval);

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { requireTeacherApproval },
    });

    return res.json({ success: true, section: updated });
  } catch (err: any) {
    console.error('PUT /api/sections/:id/toggle-verification error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to toggle approval' });
  }
});

app.post('/api/sections/:id/schedules', verifyToken, async (req, res) => {
  try {
    const sectionId = String(req.params.id);
    const date = String(req.body?.date || new Date().toISOString().split('T')[0]).trim();
    const room = String(req.body?.room || '').trim();
    const startTime = String(req.body?.startTime || '08:00').trim();
    const absentCutoffTime = String(req.body?.absentCutoffTime || '08:30').trim();
    const endTime = String(req.body?.endTime || '17:00').trim();

    const schedule = await prisma.sectionSchedule.create({
      data: {
        sectionId,
        date,
        room,
        startTime,
        absentCutoffTime,
        endTime,
      },
    });

    return res.json({ success: true, schedule });
  } catch (err: any) {
    console.error('POST /api/sections/:id/schedules error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to add schedule' });
  }
});

app.delete('/api/schedules/:id', verifyToken, async (req, res) => {
  try {
    const scheduleId = String(req.params.id);
    await prisma.sectionSchedule.delete({ where: { id: scheduleId } });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/schedules/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to delete schedule' });
  }
});

app.put('/api/teacher/students/:studentId/assign-section', verifyToken, async (req, res) => {
  try {
    const studentId = String(req.params.studentId);
    const sectionId = req.body?.sectionId ? String(req.body.sectionId).trim() : null;

    let inheritedSubjectId: string | undefined;
    if (sectionId) {
      const sec = await prisma.section.findUnique({ where: { id: sectionId } });
      if (sec?.subjectId) {
        inheritedSubjectId = sec.subjectId;
      }
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        sectionId,
        ...(inheritedSubjectId ? { subjectId: inheritedSubjectId } : {}),
      },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    return res.json({ success: true, student: updated });
  } catch (err: any) {
    console.error('PUT /api/teacher/students/:studentId/assign-section error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to assign section' });
  }
});

app.post('/api/teacher/approve-attendance', verifyToken, async (req, res) => {
  try {
    const recordId = String(req.body?.recordId || '').trim();
    const status = String(req.body?.status || 'Present').trim();

    if (!recordId) {
      return res.status(400).json({ success: false, error: 'Record ID is required' });
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status },
    });

    return res.json({ success: true, record: updated });
  } catch (err: any) {
    console.error('POST /api/teacher/approve-attendance error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update attendance' });
  }
});

app.post('/api/attendance/qr-session', verifyToken, async (req, res) => {
  try {
    const sectionId = String(req.body?.sectionId || '').trim();
    const type = String(req.body?.type || 'In').trim();

    if (!sectionId) {
      return res.status(400).json({ success: false, error: 'Section is required' });
    }

    const token = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.qRSession.create({
      data: {
        sectionId,
        type,
        token,
      },
    });

    const payload = JSON.stringify({
      sectionId,
      type,
      token,
      issuedAt: Date.now(),
    });

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(payload)}`;
    return res.json({ success: true, qrImageUrl, payload, token });
  } catch (err: any) {
    console.error('POST /api/attendance/qr-session error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to generate QR session' });
  }
});

// ==========================================
// STUDENT ROUTES
// ==========================================

app.get('/api/state/student', verifyToken, async (req: any, res) => {
  try {
    const studentId = String(req.user?.id || '');
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        subject: { include: { teacher: true } },
        section: {
          include: {
            teacher: true,
            schedules: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const [subjects, sections, records] = await Promise.all([
      prisma.subject.findMany({ include: { teacher: true }, orderBy: { createdAt: 'desc' } }),
      prisma.section.findMany({ include: { teacher: true }, orderBy: { createdAt: 'desc' } }),
      prisma.attendanceRecord.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      student,
      subjects,
      sections,
      records,
    });
  } catch (err) {
    console.error('GET /api/state/student error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load student state' });
  }
});

app.post('/api/student/change-password', verifyToken, async (req: any, res) => {
  try {
    const studentId = String(req.user?.id || req.body?.studentId || '').trim();
    const currentPassword = String(req.body?.currentPassword || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!studentId || !currentPassword || newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Current password and a new password (at least 4 characters) are required',
      });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const isCurrentValid =
      (student.passwordHash &&
        (await bcrypt.compare(currentPassword, student.passwordHash).catch(() => false))) ||
      currentPassword === student.passwordHash ||
      currentPassword === student.id;

    if (!isCurrentValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash: newPasswordHash },
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('POST /api/student/change-password error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to change password' });
  }
});

app.post('/api/student/verify-attendance', async (req, res) => {
  try {
    const studentId = String(req.body?.studentId || '').trim();
    const capturedPhoto = typeof req.body?.capturedPhoto === 'string' ? req.body.capturedPhoto : '';

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        isVerified: true,
        ...(capturedPhoto ? { photoUrl: capturedPhoto, biometricPhoto: capturedPhoto } : {}),
      },
      include: {
        subject: { include: { teacher: true } },
        section: true,
      },
    });

    return res.json({ success: true, student: updated });
  } catch (err: any) {
    console.error('POST /api/student/verify-attendance error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Verification failed' });
  }
});

app.post('/api/student/forgot-password-face', async (req, res) => {
  try {
    const identifier = String(req.body?.username || req.body?.id || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();
    const capturedPhoto = typeof req.body?.capturedPhoto === 'string' ? req.body.capturedPhoto : '';

    if (!identifier || newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'Valid student identifier and password are required' });
    }

    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: identifier },
          { username: { equals: identifier, mode: 'insensitive' } },
          { name: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student account not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.student.update({
      where: { id: student.id },
      data: {
        passwordHash,
        isVerified: true,
        ...(capturedPhoto ? { photoUrl: capturedPhoto, biometricPhoto: capturedPhoto } : {}),
      },
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('POST /api/student/forgot-password-face error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reset password' });
  }
});

// ==========================================
// STATIC FRONTEND SERVING (PRODUCTION)
// ==========================================

const distDir = path.resolve(process.cwd(), 'dist');
app.use(express.static(distDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  return res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});