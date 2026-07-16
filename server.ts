import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import prisma from "./src/lib/prisma";
import {
  requireRole,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  AUTH_COOKIE_NAME,
  authCookieOptions,
} from "./src/lib/auth";

const app = express();
const PORT = 3001;

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME as string;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD as string;

const teacherPublicSelect = {
  id: true,
  username: true,
  name: true,
  photo: true,
  room: true,
  subject: true,
  createdAt: true,
  updatedAt: true,
} as const;

const studentPublicSelect = {
  id: true,
  username: true,
  name: true,
  photoUrl: true,
  sectionId: true,
} as const;

// ===================== AUTH =====================

app.post("/api/auth/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Invalid admin credentials." });
  }
  const token = signToken({ role: "admin" });
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
  res.json({ success: true, user: { role: "admin", username } });
});

app.post("/api/auth/teacher/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const teacher = await prisma.teacher.findUnique({ where: { username } });
    if (!teacher || !(await comparePassword(password, teacher.passwordHash))) {
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }
    const token = signToken({ role: "teacher", id: teacher.id });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
    const { passwordHash, ...safeTeacher } = teacher;
    res.json({ success: true, user: { role: "teacher", ...safeTeacher } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Login failed." });
  }
});

app.post("/api/auth/student/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const student = await prisma.student.findUnique({ where: { username } });
    if (!student || !(await comparePassword(password, student.passwordHash))) {
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }
    const token = signToken({ role: "student", id: student.id, sectionId: student.sectionId });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
    const { passwordHash, ...safeStudent } = student;
    res.json({ success: true, user: { role: "student", ...safeStudent } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Login failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...authCookieOptions, maxAge: undefined });
  res.json({ success: true });
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.json({ success: false });

    if (payload.role === "admin") {
      return res.json({ success: true, user: { role: "admin", username: ADMIN_USERNAME } });
    }
    if (payload.role === "teacher") {
      const teacher = await prisma.teacher.findUnique({ where: { id: payload.id as number }, select: teacherPublicSelect });
      if (!teacher) return res.json({ success: false });
      return res.json({ success: true, user: { role: "teacher", ...teacher } });
    }
    if (payload.role === "student") {
      const student = await prisma.student.findUnique({ where: { id: payload.id as string }, select: studentPublicSelect });
      if (!student) return res.json({ success: false });
      return res.json({ success: true, user: { role: "student", ...student } });
    }
    res.json({ success: false });
  } catch (error) {
    console.error(error);
    res.json({ success: false });
  }
});

// ===================== ADMIN: TEACHERS =====================

app.get("/api/admin/teachers", requireRole("admin"), async (req, res) => {
  const teachers = await prisma.teacher.findMany({ select: teacherPublicSelect, orderBy: { name: "asc" } });
  res.json({ success: true, teachers });
});

app.post("/api/admin/teachers", requireRole("admin"), async (req, res) => {
  try {
    const { username, password, name, room, subject, photo } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, error: "Username, password, and name are required." });
    }
    const passwordHash = await hashPassword(password);
    const teacher = await prisma.teacher.create({
      data: { username, passwordHash, name, room: room || null, subject: subject || null, photo: photo || null },
      select: teacherPublicSelect,
    });
    res.json({ success: true, teacher });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, error: "That username is already taken." });
    }
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to create teacher." });
  }
});

app.put("/api/admin/teachers/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, password, name, room, subject, photo } = req.body;
    const data: any = {};
    if (username !== undefined) data.username = username;
    if (name !== undefined) data.name = name;
    if (room !== undefined) data.room = room;
    if (subject !== undefined) data.subject = subject;
    if (photo !== undefined) data.photo = photo;
    if (password) data.passwordHash = await hashPassword(password);

    const teacher = await prisma.teacher.update({ where: { id }, data, select: teacherPublicSelect });
    res.json({ success: true, teacher });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, error: "That username is already taken." });
    }
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to update teacher." });
  }
});

app.delete("/api/admin/teachers/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.teacher.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to delete teacher." });
  }
});

// ===================== ADMIN: SECTIONS (read-only, for the student-creation picker) =====================

app.get("/api/admin/sections", requireRole("admin"), async (req, res) => {
  const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
  const sections = await prisma.section.findMany({
    where: teacherId ? { teacherId } : undefined,
    select: { id: true, name: true, startTime: true },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, sections });
});

// ===================== ADMIN: STUDENTS =====================

app.get("/api/admin/students", requireRole("admin"), async (req, res) => {
  const sectionId = req.query.sectionId as string | undefined;
  const students = await prisma.student.findMany({
    where: sectionId ? { sectionId } : undefined,
    select: studentPublicSelect,
    orderBy: { name: "asc" },
  });
  res.json({ success: true, students });
});

app.post("/api/admin/students", requireRole("admin"), async (req, res) => {
  try {
    const { sectionId, username, password, name } = req.body;
    if (!sectionId || !username || !password || !name) {
      return res.status(400).json({ success: false, error: "Section, username, password, and name are required." });
    }
    const passwordHash = await hashPassword(password);
    const student = await prisma.student.create({
      data: { id: randomUUID(), sectionId, username, passwordHash, name },
      select: studentPublicSelect,
    });
    res.json({ success: true, student });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, error: "That username is already taken." });
    }
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to create student." });
  }
});

app.put("/api/admin/students/:id", requireRole("admin"), async (req, res) => {
  try {
    const { username, password, name, sectionId } = req.body;
    const data: any = {};
    if (username !== undefined) data.username = username;
    if (name !== undefined) data.name = name;
    if (sectionId !== undefined) data.sectionId = sectionId;
    if (password) data.passwordHash = await hashPassword(password);

    const student = await prisma.student.update({ where: { id: req.params.id }, data, select: studentPublicSelect });
    res.json({ success: true, student });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, error: "That username is already taken." });
    }
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to update student." });
  }
});

app.delete("/api/admin/students/:id", requireRole("admin"), async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to delete student." });
  }
});

// ===================== TEACHER: PROFILE =====================

app.put("/api/teacher/me", requireRole("teacher"), async (req, res) => {
  try {
    const { name, photo, room, subject, password } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (photo !== undefined) data.photo = photo;
    if (room !== undefined) data.room = room;
    if (subject !== undefined) data.subject = subject;
    if (password) data.passwordHash = await hashPassword(password);

    const teacher = await prisma.teacher.update({ where: { id: req.user!.id as number }, data, select: teacherPublicSelect });
    res.json({ success: true, teacher });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to update profile." });
  }
});

// ===================== TEACHER: SECTIONS =====================

app.get("/api/state/teacher", requireRole("teacher"), async (req, res) => {
  try {
    const teacherId = req.user!.id as number;
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: teacherPublicSelect });
    const sections = await prisma.section.findMany({
      where: { teacherId },
      include: { students: { select: studentPublicSelect } },
      orderBy: { name: "asc" },
    });
    const records = await prisma.attendanceRecord.findMany({ where: { teacherId }, orderBy: { timestamp: "desc" } });
    res.json({ success: true, teacher, sections, records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.post("/api/sections", requireRole("teacher"), async (req, res) => {
  try {
    const { name, startTime } = req.body;
    const section = await prisma.section.create({
      data: { id: randomUUID(), name, startTime, teacherId: req.user!.id as number },
      include: { students: { select: studentPublicSelect } },
    });
    res.json({ success: true, section });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to create section." });
  }
});

app.put("/api/sections/:id", requireRole("teacher"), async (req, res) => {
  try {
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.teacherId !== req.user!.id) {
      return res.status(404).json({ success: false, error: "Section not found." });
    }
    const updated = await prisma.section.update({
      where: { id: req.params.id },
      data: { startTime: req.body.startTime },
      include: { students: { select: studentPublicSelect } },
    });
    res.json({ success: true, section: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to update section." });
  }
});

app.delete("/api/sections/:id", requireRole("teacher"), async (req, res) => {
  try {
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.teacherId !== req.user!.id) {
      return res.status(404).json({ success: false, error: "Section not found." });
    }
    await prisma.section.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to delete section." });
  }
});

// ===================== TEACHER: STUDENT ROSTER (delete only — creation is admin-only) =====================

app.delete("/api/students/:id", requireRole("teacher"), async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id }, include: { section: true } });
    if (!student || student.section.teacherId !== req.user!.id) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to delete student." });
  }
});

// ===================== TEACHER: RECORDS =====================

app.post("/api/records/clear", requireRole("teacher"), async (req, res) => {
  try {
    await prisma.attendanceRecord.deleteMany({ where: { teacherId: req.user!.id as number } });
    res.json({ success: true, records: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to clear records." });
  }
});

// ===================== STUDENT: OWN ATTENDANCE HISTORY =====================

app.get("/api/student/records", requireRole("student"), async (req, res) => {
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: req.user!.id as string },
      orderBy: { timestamp: "desc" },
    });
    res.json({ success: true, records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to load attendance history." });
  }
});

// ===================== PUBLIC: CHECK-IN (no auth — kiosk/QR flow) =====================

app.get("/api/state/public", async (req, res) => {
  try {
    const sections = await prisma.section.findMany({
      select: {
        id: true,
        name: true,
        startTime: true,
        students: { select: studentPublicSelect },
        teacher: { select: { name: true, photo: true, room: true, subject: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({
      success: true,
      sections: sections.map(({ teacher, ...s }) => ({
        ...s,
        teacherName: teacher.name,
        teacherPhotoUrl: teacher.photo,
        room: teacher.room,
        subject: teacher.subject,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.post("/api/records/add", async (req, res) => {
  try {
    const newRecord = req.body;

    const section = await prisma.section.findUnique({ where: { id: newRecord.sectionId } });
    if (!section) {
      return res.status(404).json({ success: false, error: "Section not found." });
    }

    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        studentId: newRecord.studentId,
        sectionId: newRecord.sectionId,
        date: newRecord.date,
        type: newRecord.type ?? "In",
      },
    });

    if (existing) {
      return res.status(409).json({
        error:
          newRecord.type === "Out"
            ? "Time Out already logged for today."
            : "Attendance already logged for today.",
      });
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        id: newRecord.id,
        studentId: newRecord.studentId,
        sectionId: newRecord.sectionId,
        teacherId: section.teacherId,
        studentName: newRecord.studentName,
        sectionName: newRecord.sectionName,
        date: newRecord.date,
        time: newRecord.time,
        status: newRecord.status,
        type: newRecord.type,
        timestamp: new Date(newRecord.timestamp),
      },
    });

    res.json({ success: true, record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to save attendance." });
  }
});

app.post("/api/student/photo", async (req, res) => {
  try {
    const { studentId, photoUrl } = req.body;
    const student = await prisma.student.update({
      where: { id: studentId },
      data: { photoUrl },
      select: studentPublicSelect,
    });

    await prisma.attendanceRecord.updateMany({
      where: { studentId },
      data: { studentName: student.name },
    });

    res.json({ success: true, student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to update student photo." });
  }
});

// Vite Dev Middleware Configuration
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
