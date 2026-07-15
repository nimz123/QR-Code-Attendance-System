import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import prisma from "./src/lib/prisma";

const app = express();
const PORT = 3001;
const DB_FILE = path.join(process.cwd(), "attendance_db.json");

// Parse large JSON payloads (e.g. base64 teacher/student profile pictures)
app.use(express.json({ limit: "50mb" }));

// Initialize helper to load and save DB data
interface DBData {
  sections: any[];
  records: any[];
  teacher: {
    name: string;
    photo: string;
    password: string;
    isRegistered: boolean;
    room?: string;
    subject?: string;
  };
}

const defaultDB: DBData = {
  sections: [],
  records: [],
  teacher: {
    name: "",
    photo: "",
    password: "",
    isRegistered: false,
    room: "",
    subject: ""
  }
};

// Thread-safe memory-backed cache to avoid disk read latency and lockups during concurrent requests
let dbInMemory: DBData = defaultDB;

function readDB(): DBData {
  return dbInMemory;
}

function writeDB(data: DBData) {
  dbInMemory = data;
  try {
    // Write atomically by first writing to a temp file, then renaming it to the final destination
    const tempFile = DB_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error("Error writing database atomically:", error);
  }
}

// Initial server startup load
try {
  if (fs.existsSync(DB_FILE)) {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    if (content.trim()) {
      dbInMemory = JSON.parse(content);
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf-8");
    dbInMemory = defaultDB;
  }
} catch (error) {
  console.error("Critical error reading database at startup, falling back to defaultDB:", error);
  dbInMemory = defaultDB;
}

// API Routes

// Get complete status (for bootstrap)
app.get("/api/state", async (req, res) => {
  try {
    const teacher = await prisma.teacher.findFirst();

    const sections = await prisma.section.findMany({
      include: {
        students: true,
      },
    });

    const records = await prisma.attendanceRecord.findMany();

    res.json({
      teacher,
      sections,
      records,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});
// Update Teacher Profile when the teacher registers or updates their profile
app.post("/api/teacher", async (req, res) => {
  try {
    const data = req.body;

    let teacher = await prisma.teacher.findFirst();

    if (teacher) {
      teacher = await prisma.teacher.update({
        where: {
          id: teacher.id,
        },
        data: {
          ...data,
        },
      });
    } else {
      teacher = await prisma.teacher.create({
        data: {
          name: data.name ?? "",
          photo: data.photo ?? "",
          password: data.password ?? "",
          isRegistered: data.isRegistered ?? false,
          room: data.room ?? "",
          subject: data.subject ?? "",
        },
      });
    }

    res.json({
      success: true,
      teacher,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Failed to save teacher.",
    });
  }
});
// Sync Sections
app.post("/api/sections", async (req, res) => {
  try {
    const sections = req.body;

    console.log("===== SECTIONS RECEIVED =====");
    console.log(JSON.stringify(sections, null, 2));

    // Clear old data
    await prisma.attendanceRecord.deleteMany();
    await prisma.student.deleteMany();
    await prisma.section.deleteMany();

    // Save sections and students
    for (const section of sections) {
      await prisma.section.create({
        data: {
          id: section.id,
          name: section.name,
          startTime: section.startTime,
        },
      });

      for (const student of section.students || []) {
        await prisma.student.create({
          data: {
            id: student.id,
            name: student.name,
            sectionId: section.id,
          },
        });
      }
    }

    const allSections = await prisma.section.findMany({
      include: {
        students: true,
      },
    });

    res.json({
      success: true,
      sections: allSections,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Failed to save sections.",
    });
  }
});
// Sync Records
app.post("/api/records", async (req, res) => {
  try {
    const records = req.body;

    console.log("===== RECORDS RECEIVED =====");
    console.log(JSON.stringify(records, null, 2));

    // Remove existing attendance records
    await prisma.attendanceRecord.deleteMany();

    // Insert new attendance records
    for (const record of records) {
      await prisma.attendanceRecord.create({
        data: {
          id: record.id,
          studentId: record.studentId,
          sectionId: record.sectionId,
          studentName: record.studentName,
          sectionName: record.sectionName,
          date: record.date,
          time: record.time,
          status: record.status,
          type: record.type,
          timestamp: new Date(record.timestamp),
        },
      });
    }

    const allRecords = await prisma.attendanceRecord.findMany({
      orderBy: {
        timestamp: "desc",
      },
    });

    res.json({
      success: true,
      records: allRecords,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Failed to save attendance records.",
    });
  }
});
// Add Single Record (for student-level attendance registration)
// Add Single Record (Prisma)
app.post("/api/records/add", async (req, res) => {
  try {
    const newRecord = req.body;

    console.log("===== NEW ATTENDANCE =====");
    console.log(JSON.stringify(newRecord, null, 2));

    // Check for duplicate attendance
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
        studentName: newRecord.studentName,
        sectionName: newRecord.sectionName,
        date: newRecord.date,
        time: newRecord.time,
        status: newRecord.status,
        type: newRecord.type,
        timestamp: new Date(newRecord.timestamp),
      },
    });

    res.json({
      success: true,
      record,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Failed to save attendance.",
    });
  }
});
// Update Student Photo URL on server
app.post("/api/student/photo", (req, res) => {
  const { sectionId, studentId, photoUrl } = req.body;
  const db = readDB();

  db.sections = db.sections.map(s => {
    if (s.id === sectionId) {
      return {
        ...s,
        students: s.students.map((st: any) => {
          if (st.id === studentId) {
            return { ...st, photoUrl };
          }
          return st;
        })
      };
    }
    return s;
  });

  db.records = db.records.map(r => {
    if (r.studentId === studentId && r.sectionId === sectionId) {
      return { ...r, studentPhotoUrl: photoUrl };
    }
    return r;
  });

  writeDB(db);
  res.json({ success: true, sections: db.sections, records: db.records });
});

// Clear All Records
app.post("/api/records/clear", (req, res) => {
  const db = readDB();
  db.records = [];
  writeDB(db);
  res.json({ success: true, records: [] });
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


