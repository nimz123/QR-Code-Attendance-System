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
    } else {
      await prisma.teacher.update({
        where: { id: existingAdmin.id },
        data: { passwordHash: hashedPassword }
      });
      console.log('🔄 Admin account verified.');
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
}

async function findSectionFlexible(identifier) {
  if (!identifier) return null;
  let section = await prisma.section.findUnique({
    where: { id: identifier },
    include: { students: { include: { records: true } }, teacher: true }
  }).catch(() => null);

  if (!section) {
    section = await prisma.section.findFirst({
      where: { name: { equals: identifier, mode: 'insensitive' } },
      include: { students: { include: { records: true } }, teacher: true }
    }).catch(() => null);
  }
  return section;
}

// UNIFIED LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const teacher = await prisma.teacher.findFirst({ where: { username } });
    if (teacher) {
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, teacher.passwordHash);
      } catch (e) {
        isPasswordValid = false;
      }
      if (!isPasswordValid && teacher.passwordHash === password) {
        isPasswordValid = true;
      }

      if (isPasswordValid) {
        const assignedRole = (username.toLowerCase() === 'admin') ? 'admin' : 'teacher';
        const token = jwt.sign(
          { userId: teacher.id, role: assignedRole, username: teacher.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: teacher.id,
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
      include: { section: true }
    });

    if (student) {
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, student.passwordHash);
      } catch (e) {
        isPasswordValid = false;
      }
      if (!isPasswordValid && student.passwordHash === password) {
        isPasswordValid = true;
      }

      if (isPasswordValid) {
        const token = jwt.sign(
          { userId: student.id, role: 'student', username: student.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          message: 'Student login successful',
          token,
          user: {
            id: student.id,
            name: student.name,
            username: student.username,
            photoUrl: student.photoUrl || '',
            isVerified: student.isVerified,
            sectionId: student.sectionId,
            sectionName: student.section?.name || '',
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

const handleStudentLoginRequest = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const student = await prisma.student.findFirst({ 
      where: { username },
      include: { section: true }
    });

    if (!student) {
      return res.status(400).json({ success: false, error: 'Invalid student username or password' });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, student.passwordHash);
    } catch (e) {
      isPasswordValid = false;
    }
    if (!isPasswordValid && student.passwordHash === password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return res.status(400).json({ success: false, error: 'Invalid student username or password' });
    }

    const token = jwt.sign(
      { userId: student.id, role: 'student', username: student.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Student login successful',
      token,
      user: {
        id: student.id,
        name: student.name,
        username: student.username,
        photoUrl: student.photoUrl || '',
        isVerified: student.isVerified,
        sectionId: student.sectionId,
        sectionName: student.section?.name || '',
        role: 'student',
      },
    });
  } catch (error) {
    console.error('🔥 Student login error:', error);
    res.status(500).json({ success: false, error: 'Server error during student login' });
  }
};

app.post('/api/student/login', handleStudentLoginRequest);
app.post('/api/students/login', handleStudentLoginRequest);
app.post('/api/auth/student/login', handleStudentLoginRequest);

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role === 'student') {
      const student = await prisma.student.findUnique({ 
        where: { id: decoded.userId },
        include: { section: true }
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
          role: 'student',
        }
      });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: decoded.userId } });
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

// PUBLIC STATE ENDPOINT
app.get('/api/state/public', async (req, res) => {
  try {
    const teachersFromDb = await prisma.teacher.findMany({
      include: {
        sections: {
          include: {
            students: { include: { records: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teachers = teachersFromDb
      .filter((t) => t.username.toLowerCase() !== 'admin')
      .map((t) => ({
        id: t.id,
        name: t.name,
        username: t.username,
        email: t.email || `${t.username}@school.edu`,
        room: t.room || null,
        subject: t.subject || null,
        photo: t.photo || null,
        sectionCount: t.sections ? t.sections.length : 0,
        sections: t.sections ? t.sections.filter(Boolean).map((s) => ({
          id: s.id || s.name,
          name: s.name || s.id,
          teacherName: t.name,
          teacher: t.name,
          studentCount: s.students ? s.students.length : 0,
          startTime: s.startTime || '08:00',
          endTime: s.endTime || '17:00',
          students: s.students || []
        })) : []
      }));

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

app.get('/api/admin/teachers', async (req, res) => {
  try {
    const teachersFromDb = await prisma.teacher.findMany({
      include: {
        sections: {
          include: {
            students: { include: { records: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teachers = teachersFromDb
      .filter((t) => t.username.toLowerCase() !== 'admin')
      .map((t) => ({
        id: t.id,
        name: t.name,
        username: t.username,
        email: t.email || `${t.username}@school.edu`,
        room: t.room || null,
        subject: t.subject || null,
        photo: t.photo || null,
        sectionCount: t.sections ? t.sections.length : 0,
        sections: t.sections ? t.sections.filter(Boolean).map((s) => ({
          id: s.id || s.name,
          name: s.name || s.id,
          teacherName: t.name,
          teacher: t.name,
          studentCount: s.students ? s.students.length : 0,
          startTime: s.startTime || '08:00',
          endTime: s.endTime || '17:00',
          students: s.students || []
        })) : []
      }));

    res.json({ success: true, teachers });
  } catch (error) {
    console.error('Error fetching admin teachers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teachers' });
  }
});

app.post('/api/admin/teachers', async (req, res) => {
  try {
    const { name, username, email, password, room, subject } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, error: 'Name, username, and password are required' });
    }

    const existing = await prisma.teacher.findFirst({ where: { username } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newTeacher = await prisma.teacher.create({
      data: { name, username, passwordHash: hashedPassword, email: email || `${username}@school.edu`, room, subject }
    });

    res.json({ success: true, teacher: newTeacher });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

// DELETE TEACHER ENDPOINT
app.delete('/api/admin/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = isNaN(Number(id)) ? id : Number(id);

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { sections: true }
    });

    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    if (teacher.username.toLowerCase() === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot delete the default administrator account' });
    }

    await prisma.section.deleteMany({
      where: { teacherId: teacherId }
    });

    await prisma.teacher.delete({
      where: { id: teacherId }
    });

    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('🔥 Error deleting teacher:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete teacher' });
  }
});

app.post('/api/teacher/students', async (req, res) => {
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
  } catch (error) {
    console.error('🔥 Error enrolling student:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to enroll student' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running smoothly' });
});

// --- RENDER STATIC FILES & SPA FALLBACK ---
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- DYNAMIC PORT FOR RENDER ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  await seedAdmin();
  console.log(`🚀 Server running on port ${PORT} smoothly!`);
});