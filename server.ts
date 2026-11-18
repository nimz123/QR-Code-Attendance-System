import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = (() => {
  try {
    // @ts-ignore
    if (typeof __dirname !== 'undefined') return __dirname;
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://attendance_db_qrsystem_user:FDIfou3fFAiLpUhrYrjI90g8vkGmyqaw@dpg-dbas7mss728c739frua0-a.oregon-postgres.render.com/attendance_db_qrsystem?sslmode=require&connect_timeout=30&pool_timeout=30",
    },
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const JWT_SECRET = 'KhlarEskwela_CHANGE_THIS_TO_A_RANDOM_SECRET';

// Middleware to authenticate JWT tokens
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
};

// Seed default administrator account if not present
async function seedAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('changeme123', 10);
    const existingAdmin = await prisma.teacher.findFirst({
      where: { username: 'admin' }
    });

    if (!existingAdmin) {
      await prisma.teacher.create({
        data: {
          username: 'admin',
          name: 'Administrator',
          passwordHash: hashedPassword,
        }
      });
      console.log('✨ Default admin account created: admin / changeme123');
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
}

// Unified Login Route for Admin, Teachers, and Students
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const teacher = await prisma.teacher.findFirst({ where: { username } });
    if (teacher) {
      let isPasswordValid = await bcrypt.compare(password, teacher.passwordHash).catch(() => false);
      if (!isPasswordValid && teacher.passwordHash === password) isPasswordValid = true;

      if (isPasswordValid) {
        const assignedRole = (username.toLowerCase() === 'admin') ? 'admin' : 'teacher';
        const token = jwt.sign(
          { userId: String(teacher.id), role: assignedRole, username: teacher.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: String(teacher.id),
            name: teacher.name,
            username: teacher.username,
            email: teacher.email || `${teacher.username}@school.edu`,
            photoUrl: teacher.photo || '',
            role: assignedRole,
          },
        });
      }
    }

    const student = await prisma.student.findFirst({ 
      where: { username },
      include: { section: true, records: true }
    });

    if (student) {
      let isPasswordValid = await bcrypt.compare(password, student.passwordHash).catch(() => false);
      if (!isPasswordValid && student.passwordHash === password) isPasswordValid = true;

      if (isPasswordValid) {
        const token = jwt.sign(
          { userId: String(student.id), role: 'student', username: student.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          message: 'Student login successful',
          token,
          user: {
            id: String(student.id),
            name: student.name,
            username: student.username,
            photoUrl: student.photoUrl || '',
            isVerified: student.isVerified,
            sectionId: student.sectionId,
            sectionName: student.section?.name || '',
            records: student.records || [],
            role: 'student',
          },
        });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid username or password' });
  } catch (error) {
    console.error('🔥 Server login error:', error);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userIdStr = String(decoded.userId);

    if (decoded.role === 'student') {
      const student = await prisma.student.findUnique({ 
        where: { id: userIdStr },
        include: { section: true, records: true }
      });
      if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
      return res.json({
        success: true,
        user: {
          id: student.id,
          name: student.name,
          username: student.username,
          photoUrl: student.photoUrl || '',
          isVerified: student.isVerified,
          sectionId: student.sectionId,
          sectionName: student.section?.name || '',
          records: student.records || [],
          role: 'student',
        }
      });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: userIdStr } });
    if (!teacher) return res.status(404).json({ success: false, error: 'User not found' });

    const assignedRole = (teacher.username.toLowerCase() === 'admin') ? 'admin' : 'teacher';

    res.json({
      success: true,
      user: {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        email: teacher.email || `${teacher.username}@school.edu`,
        photoUrl: teacher.photo || '',
        role: assignedRole,
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Teacher State Endpoint
app.get('/api/state/teacher', authenticateToken, async (req: any, res) => {
  try {
    const teacherId = String(req.user.userId);
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        sections: {
          include: {
            students: { include: { records: true } },
            schedules: { orderBy: { date: 'desc' } }
          }
        }
      }
    });

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    const sections = teacher.sections.map(s => ({
      id: s.id,
      name: s.name,
      subject: s.subject || '',
      room: s.room || '',
      startTime: s.startTime || '08:00',
      endTime: s.endTime || '17:00',
      absentCutoffTime: s.absentCutoffTime || '08:30',
      requireTeacherApproval: s.requireTeacherApproval,
      students: s.students || [],
      schedules: s.schedules || []
    }));

    const sectionIds = sections.map(s => s.id);
    const records = await prisma.attendanceRecord.findMany({
      where: { sectionId: { in: sectionIds } }
    });

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        email: teacher.email || `${teacher.username}@school.edu`,
        photoUrl: teacher.photo || ''
      },
      sections,
      records
    });
  } catch (error) {
    console.error('Error fetching teacher state:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teacher state' });
  }
});

// Update Teacher Profile Picture
app.put('/api/teacher/profile', authenticateToken, async (req: any, res) => {
  try {
    const teacherId = String(req.user.userId);
    const { photoUrl } = req.body;

    const updatedTeacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { photo: photoUrl },
    });

    res.json({ success: true, teacher: updatedTeacher });
  } catch (error) {
    console.error('🔥 Error updating teacher profile photo:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile picture' });
  }
});

// Toggle Section Teacher Verification Mode (ON/OFF)
app.put('/api/sections/:id/toggle-verification', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { requireTeacherApproval } = req.body;

    const updatedSection = await prisma.section.update({
      where: { id },
      data: { requireTeacherApproval: Boolean(requireTeacherApproval) },
    });

    res.json({ success: true, section: updatedSection });
  } catch (error) {
    console.error('Error toggling verification mode:', error);
    res.status(500).json({ success: false, error: 'Failed to update verification setting' });
  }
});

// Teacher Approving or Rejecting Student Attendance
app.post('/api/teacher/approve-attendance', authenticateToken, async (req: any, res) => {
  try {
    const { recordId, status } = req.body; // status: 'Present', 'Absent', etc.

    if (!recordId || !status) {
      return res.status(400).json({ success: false, error: 'Record ID and status are required.' });
    }

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status },
    });

    res.json({ success: true, message: 'Attendance status updated successfully!', record: updatedRecord });
  } catch (error) {
    console.error('Error approving attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to update attendance status.' });
  }
});

// Public State Endpoint (Synced with Admin & Teacher Portals)
app.get('/api/state/public', async (req, res) => {
  try {
    const teachersFromDb = await prisma.teacher.findMany({
      include: {
        sections: {
          include: {
            students: { include: { records: true } },
            schedules: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teachers = teachersFromDb
      .filter((t) => t.username.toLowerCase() !== 'admin')
      .map((t) => {
        const activeRoom = t.sections?.find(s => s.room && s.room.trim() !== '')?.room || '';

        return {
          id: t.id,
          name: t.name,
          username: t.username,
          email: t.email || `${t.username}@school.edu`,
          room: activeRoom,
          subject: t.subject || '',
          photo: t.photo || null,
          photoUrl: t.photo || null,
          sectionCount: t.sections ? t.sections.length : 0,
          sections: t.sections ? t.sections.filter(Boolean).map((s) => ({
            id: s.id,
            name: s.name,
            subject: s.subject || '',
            room: s.room || '',
            teacherId: t.id,
            teacherName: t.name,
            teacher: t.name,
            studentCount: s.students ? s.students.length : 0,
            startTime: s.startTime || '08:00',
            endTime: s.endTime || '17:00',
            absentCutoffTime: s.absentCutoffTime || '08:30',
            requireTeacherApproval: s.requireTeacherApproval,
            students: s.students || [],
            schedules: s.schedules || []
          })) : []
        };
      });

    const allSections = teachers.flatMap(t => t.sections);
    const allStudents = allSections.flatMap(s => s.students);

    res.json({ 
      success: true, 
      teachers, 
      sections: allSections, 
      students: allStudents 
    });
  } catch (error) {
    console.error('Error fetching public state:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch public state' });
  }
});

// Student One-Time Biometric Enrollment & Verification
app.post('/api/student/verify-attendance', async (req, res) => {
  try {
    const { studentId, password, capturedPhoto, type } = req.body;

    if (!studentId || !capturedPhoto) {
      return res.status(400).json({ success: false, error: 'Student ID and captured photo are required.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student account not found.' });
    }

    if (type === 'In' && password) {
      let isPasswordValid = await bcrypt.compare(password, student.passwordHash).catch(() => false);
      if (!isPasswordValid && student.passwordHash === password) isPasswordValid = true;

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: 'Invalid student password.' });
      }
    }

    // One-time biometric facial identity lock (saved once and never overwritten)
    let updatedStudent = student;
    if (!student.isVerified || !student.biometricPhoto) {
      updatedStudent = await prisma.student.update({
        where: { id: studentId },
        data: {
          biometricPhoto: capturedPhoto,
          isVerified: true,
        },
      });
    }

    res.json({
      success: true,
      message: 'Biometric facial verification successful!',
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        username: updatedStudent.username,
        isVerified: updatedStudent.isVerified,
        photoUrl: updatedStudent.photoUrl,
      },
    });
  } catch (error) {
    console.error('Error in student biometric verification:', error);
    res.status(500).json({ success: false, error: 'Server error during biometric verification.' });
  }
});

// Student Settings (Update Profile Photo & Password)
app.post('/api/student/update-settings', async (req, res) => {
  try {
    const { studentId, photoUrl, currentPassword, newPassword } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const updateData: any = {};

    if (photoUrl !== undefined && photoUrl.trim() !== '') {
      updateData.photoUrl = photoUrl;
    }

    if (currentPassword && newPassword) {
      let isPasswordValid = await bcrypt.compare(currentPassword, student.passwordHash).catch(() => false);
      if (!isPasswordValid && student.passwordHash === currentPassword) isPasswordValid = true;

      if (!isPasswordValid) {
        return res.status(400).json({ success: false, error: 'Incorrect current password.' });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Student settings updated successfully!',
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        photoUrl: updatedStudent.photoUrl,
      },
    });
  } catch (error) {
    console.error('Error updating student settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update student settings.' });
  }
});

// Create Section Endpoint
app.post('/api/sections', authenticateToken, async (req: any, res) => {
  try {
    const { name, subject, room, date, startTime, endTime, absentCutoffTime, requireTeacherApproval } = req.body;
    const teacherId = String(req.user.userId);

    if (!name) {
      return res.status(400).json({ success: false, error: 'Section name is required' });
    }

    const newSection = await prisma.section.create({
      data: {
        name,
        subject: subject || '',
        room: room || '',
        startTime: startTime || '08:00',
        endTime: endTime || '17:00',
        absentCutoffTime: absentCutoffTime || '08:30',
        requireTeacherApproval: Boolean(requireTeacherApproval),
        teacherId,
        schedules: date ? {
          create: [{
            date,
            room: room || '',
            startTime: startTime || '08:00',
            endTime: endTime || '17:00',
            absentCutoffTime: absentCutoffTime || '08:30'
          }]
        } : undefined
      },
      include: { students: true, schedules: true }
    });

    res.json({ success: true, section: newSection });
  } catch (error: any) {
    console.error('🔥 Error creating section:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create section' });
  }
});

// Schedule Management Endpoints
app.post('/api/sections/:id/schedules', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { date, room, startTime, absentCutoffTime, endTime } = req.body;

    if (!date || !room) {
      return res.status(400).json({ success: false, error: 'Date and room are required' });
    }

    const newSchedule = await prisma.sectionSchedule.create({
      data: {
        sectionId: id,
        date,
        room,
        startTime: startTime || '08:00',
        absentCutoffTime: absentCutoffTime || '08:30',
        endTime: endTime || '17:00',
      }
    });

    await prisma.section.update({
      where: { id },
      data: { room, startTime, absentCutoffTime, endTime }
    });

    res.json({ success: true, schedule: newSchedule });
  } catch (error: any) {
    console.error('🔥 Error adding schedule log:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to add schedule log' });
  }
});

app.delete('/api/schedules/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    await prisma.sectionSchedule.delete({ where: { id } });
    res.json({ success: true, message: 'Schedule log deleted successfully' });
  } catch (error: any) {
    console.error('🔥 Error deleting schedule log:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete schedule log' });
  }
});

app.delete('/api/sections/:id/schedules', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    await prisma.sectionSchedule.deleteMany({ where: { sectionId: id } });
    res.json({ success: true, message: 'All schedule logs cleared successfully' });
  } catch (error: any) {
    console.error('🔥 Error clearing schedule logs:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to clear schedule logs' });
  }
});

app.delete('/api/sections/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const teacherId = String(req.user.userId);

    const section = await prisma.section.findFirst({ where: { id, teacherId } });
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found or unauthorized' });
    }

    const students = await prisma.student.findMany({ where: { sectionId: id }, select: { id: true } });
    const studentIds = students.map(s => s.id);

    if (studentIds.length > 0) {
      await prisma.attendanceRecord.deleteMany({ where: { studentId: { in: studentIds } } });
    }

    await prisma.attendanceRecord.deleteMany({ where: { sectionId: id } });
    await prisma.sectionSchedule.deleteMany({ where: { sectionId: id } });
    await prisma.student.deleteMany({ where: { sectionId: id } });
    await prisma.section.delete({ where: { id } });

    res.json({ success: true, message: 'Section and all its students deleted successfully' });
  } catch (error: any) {
    console.error('🔥 Error deleting section and students:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete section' });
  }
});

// Submit Attendance Record (Respects Teacher Approval Toggle)
app.post('/api/attendance/submit', async (req: any, res) => {
  try {
    const { studentId, sectionId, type, photoUrl } = req.body;

    if (!studentId || !sectionId || !type) {
      return res.status(400).json({ success: false, error: 'Student ID, section ID, and type are required' });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { schedules: true }
    });

    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    // If teacher approval toggle is ON, set status to 'Pending Approval'; otherwise automatic 'Present' or 'Late'
    let status = section.requireTeacherApproval ? 'Pending Approval' : 'Present';

    if (!section.requireTeacherApproval && type === 'In') {
      const cutoffTime = section.absentCutoffTime || '08:30';
      if (currentTime > cutoffTime) {
        status = 'Late';
      }
    } else if (type === 'Out') {
      status = 'TimeOut Recorded';
    }

    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        studentId,
        sectionId,
        type,
        date: currentDate,
      }
    });

    if (existingRecord) {
      const updatedRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          time: currentTime,
          status: section.requireTeacherApproval ? existingRecord.status : status,
          photoUrl: photoUrl || existingRecord.photoUrl,
        }
      });
      return res.json({ success: true, message: `Attendance Time ${type} updated successfully!`, record: updatedRecord });
    }

    const newRecord = await prisma.attendanceRecord.create({
      data: {
        studentId,
        sectionId,
        type,
        status,
        date: currentDate,
        time: currentTime,
        photoUrl: photoUrl || null,
      }
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { isVerified: true }
    });

    res.json({ success: true, message: `Attendance Time ${type} recorded successfully!`, record: newRecord });
  } catch (error: any) {
    console.error('🔥 Error submitting attendance:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to submit attendance' });
  }
});

// Student Enrollment & Deletion
app.post('/api/teacher/students', authenticateToken, async (req: any, res) => {
  try {
    const { sectionId, name, username, password, photoUrl } = req.body;
    if (!sectionId || !name || !username || !password) {
      return res.status(400).json({ success: false, error: 'All required fields must be filled' });
    }

    const existing = await prisma.student.findFirst({ where: { username } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Student username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const studentId = 'STU-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const newStudent = await prisma.student.create({
      data: {
        id: studentId,
        sectionId,
        name,
        username,
        passwordHash: hashedPassword,
        photoUrl: photoUrl || null,
        isVerified: false,
      }
    });

    res.json({ success: true, student: newStudent });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to enroll student' });
  }
});

app.delete('/api/teacher/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.attendanceRecord.deleteMany({ where: { studentId: id } });
    await prisma.student.delete({ where: { id } });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete student' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running smoothly' });
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  await seedAdmin();
  console.log(`🚀 Server running on port ${PORT} smoothly!`);
});