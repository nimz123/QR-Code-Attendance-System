import React, { useState, useEffect } from "react";
import { Search, UserCheck, Plus, X, Calendar, Eye, EyeOff } from "lucide-react";

import {
  readTeacherPhotoGlobal,
  readStudentPhotoGlobal,
  saveStudentPhotoGlobal,
  saveTeacherPhotoGlobal,
  STUDENT_LIST_KEYS,
  TEACHER_LIST_KEYS
} from "./photoSync";

import {
  getTeacherResetRequestsLocal,
  updateTeacherResetRequestStatus,
  deleteTeacherResetRequest,
  clearTeacherResetRequests,
  TeacherResetRequest,
} from './portalFeatures';
interface TeacherAccount {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  photoUrl?: string;
  avatar?: string;
}

interface SubjectEntry {
  id: string;
  name: string;
  teacherId?: string;
  assignedTeacherId?: string;
}

interface SectionEntry {
  id: string;
  name: string;
  teacherId?: string;
  subjectId?: string;
  subject?: string;
  room?: string;
}

type AttendanceMark = "present" | "late" | "absent" | "no-class";

interface AttendanceRecordEntry {
  date: string; // YYYY-MM-DD
  status: AttendanceMark;
  studentId?: string;
  studentName?: string;
  teacherId?: string;
  teacherName?: string;
}

interface StudentEntry {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  defaultPassword?: string;
  photoUrl?: string;
  avatar?: string;
  isVerified?: boolean;
  verificationStatus?: "Pending Verification" | "Verified";
  assignedTeacherId?: string;
  assignedTeacherName?: string;
  sectionId?: string;
  sectionName?: string;
  attendanceRecords?: AttendanceRecordEntry[];
}

interface AdminDashboardProps {
  token?: string;
  onLogout?: () => void;
  onLogOut?: () => void;
}

type InspectedProfile =
  | { kind: "student"; data: StudentEntry }
  | { kind: "teacher"; data: TeacherAccount; subjects: SubjectEntry[]; sections: SectionEntry[] }
  | { kind: "section"; data: SectionEntry; teacherName: string; subjectName: string }
  | null;

const DELETED_TEACHERS_KEY = "deleted_teacher_registry";
const DELETED_STUDENTS_KEY = "deleted_student_registry";

const DEFAULT_TEACHER: TeacherAccount = {
  id: "",
  name: "",
  username: "",
  email: "",
};

const SECTION_STORAGE_KEYS = [
  "teacher_sections",
  "sections",
  "admin_sections",
  "created_sections",
  "class_sections",
  "teacher_class_sections"
];

const SUBJECT_STORAGE_KEYS = [
  "admin_subjects_list",
  "subjects",
  "assigned_subjects",
  "teacher_subjects",
  "admin_subjects"
];

const EXTRA_STUDENT_KEYS = [
  "users",
  "registered_users",
  "accounts",
  "student_accounts",
  "enrolled_students",
  "verified_students",
  "admin_assigned_teacher_students"
];

const ATTENDANCE_STORAGE_KEYS = [
  "attendance_records",
  "student_attendance_records",
  "attendance_logs",
  "qr_attendance_records",
  "teacher_attendance_records",
  "student_dashboard_attendance"
];

function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function normalizeAttendanceStatus(rawStatus: any): AttendanceMark | null {
  const s = String(rawStatus || "")
    .trim()
    .toLowerCase();
  if (s === "present" || s === "on-time" || s === "ontime" || s === "time-in") return "present";
  if (s === "late" || s === "tardy") return "late";
  if (s === "absent" || s === "missing" || s === "no-show") return "absent";
  if (
    s === "no-class" ||
    s === "no class" ||
    s === "noclass" ||
    s === "holiday" ||
    s === "suspended"
  ) {
    return "no-class";
  }
  return null;
}

// Generate a unique 6-digit numeric default password / ID that is never duplicated across existing students
function generateUniqueSixDigitId(existingStudents: StudentEntry[]): string {
  const usedIds = new Set<string>(
    existingStudents
      .flatMap((s) => [String(s.id || "").trim(), String(s.password || "").trim()])
      .filter(Boolean)
  );

  if (typeof window !== "undefined") {
    for (const key of [...STUDENT_LIST_KEYS, ...EXTRA_STUDENT_KEYS]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.students)
          ? parsed.students
          : [];
        for (const item of list) {
          const idVal = String(item?.studentId || item?.id || "").trim();
          const passVal = String(item?.password || item?.defaultPassword || "").trim();
          if (idVal) usedIds.add(idVal);
          if (passVal) usedIds.add(passVal);
        }
      } catch {}
    }
  }

  let candidate = "";
  let safetyCounter = 0;
  do {
    const num = Math.floor(100000 + Math.random() * 900000);
    candidate = String(num);
    safetyCounter += 1;
  } while (usedIds.has(candidate) && safetyCounter < 5000);

  return candidate;
}

// Determine whether student has completed facial recognition verification
function isStudentFaceVerified(item: any): boolean {
  if (typeof item?.isVerified === "boolean") return item.isVerified;
  const statusStr = String(item?.verificationStatus || item?.faceStatus || "").toLowerCase();
  if (statusStr.includes("pending") || statusStr.includes("unverified")) return false;
  if (statusStr.includes("verified") || statusStr.includes("approved")) return true;
  return false;
}

// Read real attendance records for a student without adding default/placeholder attendance
function readStudentAttendanceRecords(student: StudentEntry): AttendanceRecordEntry[] {
  const recMap = new Map<string, AttendanceRecordEntry>();

  const ingestRec = (entry: any, fallbackStudentId?: string, fallbackStudentName?: string) => {
    if (!entry || typeof entry !== "object") return;
    const recStuId = String(entry.studentId || entry.userId || fallbackStudentId || "")
      .trim()
      .toLowerCase();
    const recStuName = String(entry.studentName || entry.name || fallbackStudentName || "")
      .trim()
      .toLowerCase();

    const targetIds = [student.id, student.username]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);
    const targetName = String(student.name || student.username || "")
      .trim()
      .toLowerCase();

    const matchesStudent =
      (recStuId && targetIds.includes(recStuId)) ||
      (recStuName && targetName && recStuName === targetName);

    if (!matchesStudent) return;

    const rawDate = String(entry.date || entry.day || entry.timestamp || "").slice(0, 10);
    const status = normalizeAttendanceStatus(
      entry.status || entry.attendanceStatus || entry.state || entry.type
    );
    if (!rawDate || !status) return;

    recMap.set(rawDate, { date: rawDate, status });
  };

  if (Array.isArray(student.attendanceRecords)) {
    student.attendanceRecords.forEach((r) => ingestRec(r, student.id, student.name));
  }

  if (typeof window !== "undefined") {
    for (const key of ATTENDANCE_STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.records)
          ? parsed.records
          : Array.isArray(parsed?.attendance)
          ? parsed.attendance
          : [];
        list.forEach((item: any) => ingestRec(item));
      } catch {}
    }
  }

  return Array.from(recMap.values());
}

// Read class schedule / class-day records for a teacher ("present" or "no-class" only)
function readTeacherClassCalendarRecords(teacher: TeacherAccount): AttendanceRecordEntry[] {
  const recMap = new Map<string, AttendanceRecordEntry>();
  const teacherKeys = [teacher.id, teacher.name, teacher.username, teacher.email]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  const ingestEntry = (entry: any) => {
    if (!entry || typeof entry !== "object") return;
    const entryTeacherKeys = [
      entry.teacherId,
      entry.assignedTeacherId,
      entry.teacherName,
      entry.instructorId,
      entry.instructorName
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    if (entryTeacherKeys.length > 0 && !entryTeacherKeys.some((k) => teacherKeys.includes(k))) {
      return;
    }

    const rawDate = String(entry.date || entry.day || entry.timestamp || "").slice(0, 10);
    if (!rawDate) return;

    const rawType = String(
      entry.classStatus || entry.status || entry.attendanceStatus || entry.state || ""
    )
      .trim()
      .toLowerCase();

    let status: "present" | "no-class" | null = null;
    if (
      rawType === "no-class" ||
      rawType === "no class" ||
      rawType === "noclass" ||
      rawType === "holiday" ||
      rawType === "suspended" ||
      entry.noClass === true ||
      entry.hasClass === false
    ) {
      status = "no-class";
    } else if (
      rawType === "present" ||
      rawType === "has-class" ||
      rawType === "class" ||
      rawType === "held" ||
      entry.hasClass === true
    ) {
      status = "present";
    }

    if (status) {
      recMap.set(rawDate, { date: rawDate, status });
    }
  };

  if (typeof window !== "undefined") {
    for (const key of [
      ...ATTENDANCE_STORAGE_KEYS,
      "teacher_class_calendar",
      "teacher_schedule_logs",
      "class_sessions"
    ]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.records)
          ? parsed.records
          : Array.isArray(parsed?.classes)
          ? parsed.classes
          : [];
        list.forEach(ingestEntry);
      } catch {}
    }
  }

  return Array.from(recMap.values());
}

// Teacher calendar showing ONLY Present and No Class so Admin knows if the teacher held class
function TeacherClassOnlyCalendar({ teacher }: { teacher: TeacherAccount }) {
  const [records, setRecords] = useState<AttendanceRecordEntry[]>(() =>
    readTeacherClassCalendarRecords(teacher)
  );
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  useEffect(() => {
    setRecords(readTeacherClassCalendarRecords(teacher));
  }, [teacher]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const statusByDate = new Map<string, "present" | "no-class">();
  let presentCount = 0;
  let noClassCount = 0;

  for (const r of records) {
    if (r.status === "present" || r.status === "no-class") {
      statusByDate.set(r.date, r.status);
      if (r.status === "present") presentCount += 1;
      else noClassCount += 1;
    }
  }

  const persistTeacherDayStatus = (day: number, status: "present" | "no-class") => {
    const dateKey = formatDateKey(year, month, day);
    const nextMap = new Map<string, AttendanceRecordEntry>();
    for (const item of records) {
      nextMap.set(item.date, item);
    }
    nextMap.set(dateKey, {
      date: dateKey,
      status,
      teacherId: teacher.id,
      teacherName: teacher.name || teacher.username || ""
    });
    const updatedList = Array.from(nextMap.values());
    setRecords(updatedList);

    try {
      const storageKey = "teacher_class_calendar";
      const existingRaw = localStorage.getItem(storageKey);
      const existingParsed = existingRaw ? JSON.parse(existingRaw) : [];
      const teacherKeys = [teacher.id, teacher.name, teacher.username]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean);
      const otherTeachers = Array.isArray(existingParsed)
        ? existingParsed.filter(
            (item: any) =>
              !teacherKeys.includes(String(item?.teacherId || "").trim().toLowerCase()) &&
              !teacherKeys.includes(String(item?.teacherName || "").trim().toLowerCase())
          )
        : [];
      localStorage.setItem(storageKey, JSON.stringify([...otherTeachers, ...updatedList]));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells: Array<{ day: number | null; status: "present" | "no-class" | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i += 1) {
    calendarCells.push({ day: null, status: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = formatDateKey(year, month, d);
    calendarCells.push({ day: d, status: statusByDate.get(key) || null });
  }

  const getCellStyle = (status: "present" | "no-class" | null) => {
    if (status === "present") {
      return "bg-emerald-500/25 text-emerald-200 border-emerald-400/60 font-black";
    }
    if (status === "no-class") {
      return "bg-sky-500/25 text-sky-200 border-sky-400/60 font-black";
    }
    return "bg-[#0d1322] text-slate-500 border-slate-800/80 hover:border-slate-600";
  };

  return (
    <div className="bg-[#131b2e] border border-indigo-500/30 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
          <Calendar size={14} />
          <span>Teacher Class Calendar ({monthLabel})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold cursor-pointer"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {/* Only Present and No Class Counters */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 py-1.5 px-2">
          <p className="text-[10px] text-emerald-300 font-bold uppercase">Present (Has Class)</p>
          <p className="text-sm font-black text-emerald-200">{presentCount}</p>
        </div>
        <div className="rounded-lg bg-sky-500/15 border border-sky-500/30 py-1.5 px-2">
          <p className="text-[10px] text-sky-300 font-bold uppercase">No Class</p>
          <p className="text-sm font-black text-sky-200">{noClassCount}</p>
        </div>
      </div>

      {/* Calendar Grid (Click a day to toggle Present or No Class) */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dow) => (
          <div key={dow} className="text-slate-400 font-bold py-0.5">
            {dow}
          </div>
        ))}
        {calendarCells.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!cell.day}
            onClick={() => {
              if (!cell.day) return;
              const nextStatus: "present" | "no-class" =
                cell.status === "present" ? "no-class" : "present";
              persistTeacherDayStatus(cell.day, nextStatus);
            }}
            title={
              cell.day
                ? `${monthLabel.split(" ")[0]} ${cell.day}: ${
                    cell.status === "no-class"
                      ? "NO CLASS"
                      : cell.status === "present"
                      ? "PRESENT"
                      : "Click to mark Present / No Class"
                  }`
                : ""
            }
            className={`h-7 rounded border flex items-center justify-center ${
              cell.day
                ? `${getCellStyle(cell.status)} cursor-pointer`
                : "border-transparent cursor-default"
            }`}
          >
            {cell.day || ""}
          </button>
        ))}
      </div>

      {/* Color Legend (Present & No Class Only) */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300 pt-0.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Present
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> No Class
          </span>
        </div>
        <span className="text-slate-400">Click date to toggle</span>
      </div>
    </div>
  );
}

// Render color-coded attendance calendar matching student dashboard records (Present, Late, Absent, No Class)
function VerifiedStudentAttendanceCalendar({ student }: { student: StudentEntry }) {
  const verified = Boolean(student.isVerified || readStudentPhotoGlobal(student));
  const records = readStudentAttendanceRecords(student);
  const [calendarOpen, setCalendarOpen] = useState<boolean>(() => verified);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  if (!verified && records.length === 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-[11px] text-amber-300">
        Attendance calendar will open once this student is <strong>Verified</strong> and has
        attendance records.
      </div>
    );
  }

  if (!calendarOpen) {
    return (
      <div className="bg-[#131b2e] border border-slate-700/70 rounded-xl p-3.5 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-300">
          Student attendance calendar is ready ({records.length} recorded day(s)).
        </div>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
        >
          Open Calendar
        </button>
      </div>
    );
  }

  const statusByDate = new Map<string, AttendanceMark>();
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let noClassCount = 0;

  for (const r of records) {
    statusByDate.set(r.date, r.status);
    if (r.status === "present") presentCount += 1;
    else if (r.status === "late") lateCount += 1;
    else if (r.status === "absent") absentCount += 1;
    else if (r.status === "no-class") noClassCount += 1;
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells: Array<{ day: number | null; status: AttendanceMark | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i += 1) {
    calendarCells.push({ day: null, status: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = formatDateKey(year, month, d);
    calendarCells.push({ day: d, status: statusByDate.get(key) || null });
  }

  const getCellStyle = (status: AttendanceMark | null) => {
    if (status === "present") {
      return "bg-emerald-500/25 text-emerald-200 border-emerald-400/60 font-black";
    }
    if (status === "late") {
      return "bg-amber-500/25 text-amber-200 border-amber-400/60 font-black";
    }
    if (status === "absent") {
      return "bg-rose-500/25 text-rose-200 border-rose-400/60 font-black";
    }
    if (status === "no-class") {
      return "bg-sky-500/25 text-sky-200 border-sky-400/60 font-black";
    }
    return "bg-[#0d1322] text-slate-500 border-slate-800/80";
  };
  return (
    <div className="bg-[#131b2e] border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
          <Calendar size={14} />
          <span>Student Calendar ({monthLabel})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold cursor-pointer"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {/* Present / Late / Absent / No Class Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 py-1.5 px-2">
          <p className="text-[10px] text-emerald-300 font-bold uppercase">Present</p>
          <p className="text-sm font-black text-emerald-200">{presentCount}</p>
        </div>
        <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 py-1.5 px-2">
          <p className="text-[10px] text-amber-300 font-bold uppercase">Late</p>
          <p className="text-sm font-black text-amber-200">{lateCount}</p>
        </div>
        <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 py-1.5 px-2">
          <p className="text-[10px] text-rose-300 font-bold uppercase">Absent</p>
          <p className="text-sm font-black text-rose-200">{absentCount}</p>
        </div>
        <div className="rounded-lg bg-sky-500/15 border border-sky-500/30 py-1.5 px-2">
          <p className="text-[10px] text-sky-300 font-bold uppercase">No Class</p>
          <p className="text-sm font-black text-sky-200">{noClassCount}</p>
        </div>
      </div>

      {/* Color-Coded Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dow) => (
          <div key={dow} className="text-slate-400 font-bold py-0.5">
            {dow}
          </div>
        ))}
        {calendarCells.map((cell, idx) => (
          <div
            key={idx}
            title={
              cell.day
                ? `${monthLabel.split(" ")[0]} ${cell.day}: ${
                    cell.status ? cell.status.toUpperCase() : "No Record"
                  }`
                : ""
            }
            className={`h-7 rounded border flex items-center justify-center ${
              cell.day ? getCellStyle(cell.status) : "border-transparent"
            }`}
          >
            {cell.day || ""}
          </div>
        ))}
      </div>

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-300 pt-0.5">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Present
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Late
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Absent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> No Class
        </span>
      </div>
    </div>
  );
}

// Read deleted IDs/names so deleted accounts never reappear
function readDeletedRegistry(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
    }
  } catch {}
  return new Set();
}

function recordDeletedEntries(storageKey: string, identifiers: Array<string | undefined>) {
  if (typeof window === "undefined") return;
  try {
    const current = readDeletedRegistry(storageKey);
    for (const val of identifiers) {
      const clean = String(val || "").trim().toLowerCase();
      if (clean) current.add(clean);
    }
    localStorage.setItem(storageKey, JSON.stringify(Array.from(current)));
  } catch {}
}

// Read all sections created in Teacher or Admin storage
function readAllSectionsFromStorage(): SectionEntry[] {
  if (typeof window === "undefined") return [];
  const sectionMap = new Map<string, SectionEntry>();

  for (const key of SECTION_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.sections)
        ? parsed.sections
        : [];
      for (const sec of list) {
        if (!sec || typeof sec !== "object") continue;
        const secId = String(sec.id || sec.sectionId || sec.name || "").trim();
        const secName = String(sec.name || sec.sectionName || sec.id || "").trim();
        if (!secId && !secName) continue;
        const mapKey = (secId || secName).toLowerCase();
        const existing = sectionMap.get(mapKey);
        sectionMap.set(mapKey, {
          id: existing?.id || secId || secName,
          name: secName || existing?.name || secId,
          teacherId: String(sec.teacherId || existing?.teacherId || ""),
          subjectId: sec.subjectId || existing?.subjectId || "",
          subject: sec.subject || sec.subjectName || existing?.subject || "",
          room: sec.room || existing?.room || ""
        });
      }
    } catch {}
  }

  return Array.from(sectionMap.values());
}

// Resolve exact student ID while preserving stored 6-digit default password/ID
function resolveStudentRecordId(item: any, existing?: StudentEntry): string {
  const explicitId = String(item?.studentId || item?.id || "").trim();
  const credentialPass = String(
    item?.password || item?.defaultPassword || item?.studentPassword || ""
  ).trim();
  const nameLower = String(item?.studentName || item?.name || item?.username || "")
    .trim()
    .toLowerCase();

  return explicitId || existing?.id || credentialPass || nameLower;
}

// Read all students from storage while excluding deleted students
function readAllStudentsFromStorage(): StudentEntry[] {
  if (typeof window === "undefined") return [];
  const deletedSet = readDeletedRegistry(DELETED_STUDENTS_KEY);
  const studentMap = new Map<string, StudentEntry>();

  const isDeletedRecord = (rawId: string, rawName: string, username: string) =>
    [rawId, rawName, username]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean)
      .some((k) => deletedSet.has(k));

  const ingestItem = (item: any) => {
    if (!item || typeof item !== "object") return;
    const rawName = String(
      item.studentName || item.name || item.fullName || item.username || ""
    ).trim();
    const rawId = String(item.studentId || item.id || "").trim();
    const uname = String(item.username || "").trim();

    if (isDeletedRecord(rawId, rawName, uname)) return;

    const mapKey = (rawName || rawId).toLowerCase();
    if (!mapKey) return;

    const existing = studentMap.get(mapKey);
    const resolvedId = resolveStudentRecordId(item, existing);
    const resolvedName = rawName || existing?.name || resolvedId;
    const resolvedUsername = resolvedName;
    const resolvedPassword = String(
      item.password || item.defaultPassword || existing?.password || existing?.defaultPassword || resolvedId
    ).trim();
    const verified = isStudentFaceVerified(item) || Boolean(existing?.isVerified);

    studentMap.set(mapKey, {
      ...existing,
      id: resolvedId,
      name: resolvedName,
      username: resolvedUsername,
      password: resolvedPassword,
      defaultPassword: existing?.defaultPassword || resolvedPassword,
      email: item.email || existing?.email || "",
      photoUrl: item.photoUrl || item.avatar || existing?.photoUrl || "",
      avatar: item.avatar || item.photoUrl || existing?.avatar || "",
      isVerified: verified,
      verificationStatus: verified ? "Verified" : "Pending Verification",
      assignedTeacherId:
        item.assignedTeacherId || item.teacherId || existing?.assignedTeacherId || "",
      assignedTeacherName:
        item.assignedTeacherName || item.teacherName || existing?.assignedTeacherName || "",
      sectionId: item.sectionId || existing?.sectionId || "",
      sectionName: item.sectionName || item.section?.name || existing?.sectionName || ""
    });
  };

  for (const key of STUDENT_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(ingestItem);
      else if (Array.isArray(parsed?.students)) parsed.students.forEach(ingestItem);
    } catch {}
  }

  for (const key of EXTRA_STUDENT_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.students)
        ? parsed.students
        : [];
      for (const entry of list) {
        if (key === "users" || key === "registered_users" || key === "accounts") {
          const role = String(entry?.role || entry?.userType || "").toLowerCase();
          if (role && role !== "student") continue;
        }
        ingestItem(entry);
      }
    } catch {}
  }

  return Array.from(studentMap.values());
}

// Read all subjects created and assigned in Admin/Teacher storage
function readAllSubjectsFromStorage(): SubjectEntry[] {
  if (typeof window === "undefined") return [];
  const subMap = new Map<string, SubjectEntry>();

  for (const key of SUBJECT_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.subjects)
        ? parsed.subjects
        : [];
      for (const s of list) {
        if (!s || typeof s !== "object") continue;
        const name = String(s.name || s.subjectName || "").trim();
        if (!name) continue;
        const mapKey = name.toLowerCase();
        const existing = subMap.get(mapKey);
        const teacherRef = String(s.teacherId || s.assignedTeacherId || existing?.teacherId || "");
        subMap.set(mapKey, {
          id: existing?.id || String(s.id || `sub_${mapKey.replace(/\s+/g, "_")}`),
          name,
          teacherId: teacherRef,
          assignedTeacherId: teacherRef
        });
      }
    } catch {}
  }

  return Array.from(subMap.values());
}

// Read all registered teachers from storage while excluding deleted teachers
function readAllTeachersFromStorage(): TeacherAccount[] {
  if (typeof window === "undefined") return [DEFAULT_TEACHER];
  const deletedSet = readDeletedRegistry(DELETED_TEACHERS_KEY);
  const teacherMap = new Map<string, TeacherAccount>();

  const isDeletedTeacher = (t: any) =>
    [t?.id, t?.name, t?.fullName, t?.username, t?.email]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean)
      .some((k) => deletedSet.has(k));

  const Deleted =
    deletedSet.has("") ||
    deletedSet.has("") ||
    deletedSet.has("");

  if (!Deleted) {
    teacherMap.set("", DEFAULT_TEACHER);
  }

  for (const key of TEACHER_LIST_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.teachers)
        ? parsed.teachers
        : [];
      for (const t of list) {
        if (!t || typeof t !== "object") continue;
        if (isDeletedTeacher(t)) continue;
        const tNameLower = String(t.name || t.fullName || t.username || "")
          .trim()
          .toLowerCase();
        const is =
          String(t.id || "").toLowerCase() === "" ||
          tNameLower.includes("");
        const tId = is ? "" : String(t.id || t.username || t.name || "").trim();
        if (!tId) continue;
        const mapKey = tId.toLowerCase();
        const existing = teacherMap.get(mapKey);
        teacherMap.set(mapKey, {
          ...existing,
          id: existing?.id || tId,
          name: t.name || t.fullName || existing?.name || tId,
          username: t.username || existing?.username || t.name || tId,
          email: t.email || existing?.email || "",
          photoUrl: t.photoUrl || t.avatar || existing?.photoUrl || "",
          avatar: t.avatar || t.photoUrl || existing?.avatar || ""
        });
      }
    } catch {}
  }

  for (const accKey of ["users", "registered_users", "accounts", "teacher_accounts"]) {
    try {
      const raw = localStorage.getItem(accKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const u of parsed) {
        if (!u || typeof u !== "object") continue;
        if (String(u.role || "").toLowerCase() !== "teacher") continue;
        if (isDeletedTeacher(u)) continue;
        const tId = String(u.id || u.username || u.name || "").trim();
        if (!tId) continue;
        const mapKey = tId.toLowerCase();
        if (!teacherMap.has(mapKey)) {
          teacherMap.set(mapKey, {
            id: tId,
            name: u.name || u.fullName || u.username || tId,
            username: u.username || u.name || tId,
            email: u.email || "",
            photoUrl: u.photoUrl || u.avatar || "",
            avatar: u.avatar || u.photoUrl || ""
          });
        }
      }
    } catch {}
  }

  return Array.from(teacherMap.values());
}

export default function AdminDashboard({ token, onLogout, onLogOut }: AdminDashboardProps) {
  // Ordered flow: 1 Create Teacher Account Portal -> 2 Create Subject -> 3 Create Student Verification -> 4 Assign Student to a Teacher
  const [flowStep, setFlowStep] = useState<1 | 2 | 3 | 4>(1);

  const [teachers, setTeachers] = useState<TeacherAccount[]>(() => readAllTeachersFromStorage());
  const [subjects, setSubjects] = useState<SubjectEntry[]>(() => readAllSubjectsFromStorage());
  const [sections, setSections] = useState<SectionEntry[]>(() => readAllSectionsFromStorage());
  const [students, setStudents] = useState<StudentEntry[]>(() => readAllStudentsFromStorage());

  // Step 1: Create Teacher Account Portal
  const [teacherFullName, setTeacherFullName] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");

  // Step 2: Create Multiple Subjects with Searchable Teacher + Select a Teacher
  const [subjectDrafts, setSubjectDrafts] = useState<string[]>([""]);
  const [subjectTeacherSearch, setSubjectTeacherSearch] = useState("");
  const [newSubjectTeacherId, setNewSubjectTeacherId] = useState("");
  // Step 3: Create Student Verification (Auto 6-Digit Unique Default Password, Full Name = Username, Email Optional)
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [enrolledStudentSearch, setEnrolledStudentSearch] = useState("");

  // Step 4: Assign Student to a Teacher (Searchable Student & Searchable Teacher + Toggle Unselect)
  const [assignStudentSearch, setAssignStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assignTeacherSearch, setAssignTeacherSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [inspectedProfile, setInspectedProfile] = useState<InspectedProfile>(null);
  const [, setSyncVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const getAuthToken = () => {
    if (token) return token;
    return localStorage.getItem("token") || localStorage.getItem("edulectrical_token") || "";
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`
  };

  const attachLatestPhotosToStudents = (list: StudentEntry[]): StudentEntry[] =>
    (Array.isArray(list) ? list : []).map((st) => {
      const photo = readStudentPhotoGlobal(st) || st.photoUrl || st.avatar || "";
      const verified = Boolean(st.isVerified || photo);
      return {
        ...st,
        ...(photo ? { photoUrl: photo, avatar: photo } : {}),
        isVerified: verified,
        verificationStatus: verified ? "Verified" : "Pending Verification"
      };
    });

  const mergeStudentsSafely = (incoming: StudentEntry[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const deletedSet = readDeletedRegistry(DELETED_STUDENTS_KEY);
    setStudents((prev) => {
      const map = new Map<string, StudentEntry>();
      for (const item of prev) {
        const key = String(item.name || item.id || "").toLowerCase();
        if (key) map.set(key, item);
      }
      for (const item of incoming) {
        const keys = [item.id, item.name, item.username]
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean);
        if (keys.some((k) => deletedSet.has(k))) continue;

        const key = String(item.name || item.id || "").toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        const preservedId = resolveStudentRecordId(item, existing);
        const resolvedName = item.name || existing?.name || preservedId;
        const resolvedPassword = String(
          item.password ||
            item.defaultPassword ||
            existing?.password ||
            existing?.defaultPassword ||
            preservedId
        ).trim();

        map.set(key, {
          ...existing,
          ...item,
          id: preservedId,
          name: resolvedName,
          username: resolvedName,
          password: resolvedPassword,
          defaultPassword: existing?.defaultPassword || resolvedPassword
        });
      }
      return attachLatestPhotosToStudents(Array.from(map.values()));
    });
  };

  const mergeTeachersSafely = (incoming: TeacherAccount[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const deletedSet = readDeletedRegistry(DELETED_TEACHERS_KEY);
    setTeachers((prev) => {
      const map = new Map<string, TeacherAccount>();
      for (const t of prev) {
        const keys = [t.id, t.name, t.username, t.email]
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean);
        if (keys.some((k) => deletedSet.has(k))) continue;
        const key = String(t.id || t.name || "").toLowerCase();
        if (key) map.set(key, t);
      }
      for (const t of incoming) {
        const keys = [t.id, t.name, t.username, t.email]
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean);
        if (keys.some((k) => deletedSet.has(k))) continue;

        const key = String(t.id || t.name || "").toLowerCase();
        if (!key) continue;
        const merged = { ...map.get(key), ...t };
        const photo = readTeacherPhotoGlobal(merged) || merged.photoUrl || merged.avatar || "";
        map.set(key, photo ? { ...merged, photoUrl: photo, avatar: photo } : merged);
      }
      return Array.from(map.values());
    });
  };

  const mergeSubjectsSafely = (incoming: SubjectEntry[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setSubjects((prev) => {
      const map = new Map<string, SubjectEntry>();
      for (const s of prev) {
        const key = String(s.name || s.id || "").toLowerCase();
        if (key) map.set(key, s);
      }
      for (const s of incoming) {
        const key = String(s.name || s.id || "").toLowerCase();
        if (!key) continue;
        map.set(key, { ...map.get(key), ...s });
      }
      return Array.from(map.values());
    });
  };

  const mergeSectionsSafely = (incoming: SectionEntry[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setSections((prev) => {
      const map = new Map<string, SectionEntry>();
      for (const sec of prev) {
        const key = String(sec.id || sec.name || "").toLowerCase();
        if (key) map.set(key, sec);
      }
      for (const sec of incoming) {
        const key = String(sec.id || sec.name || "").toLowerCase();
        if (!key) continue;
        map.set(key, { ...map.get(key), ...sec });
      }
      return Array.from(map.values());
    });
  };

  const syncAllLocalData = () => {
    setTeachers(readAllTeachersFromStorage());
    mergeSubjectsSafely(readAllSubjectsFromStorage());
    mergeSectionsSafely(readAllSectionsFromStorage());
    setStudents(attachLatestPhotosToStudents(readAllStudentsFromStorage()));
  };

  const fetchAdminAndTeacherState = async () => {
    syncAllLocalData();

    try {
      const currentToken = getAuthToken();
      if (!currentToken) return;

      const [adminRes, teacherRes] = await Promise.allSettled([
        fetch("/api/state/admin", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` }
        }),
        fetch("/api/state/teacher", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` }
        })
      ]);

      if (adminRes.status === "fulfilled") {
        const adminData = await adminRes.value.json();
        if (adminData?.success) {
          if (Array.isArray(adminData.teachers) && adminData.teachers.length > 0) {
            mergeTeachersSafely(adminData.teachers);
          }
          if (Array.isArray(adminData.subjects) && adminData.subjects.length > 0) {
            mergeSubjectsSafely(adminData.subjects);
          }
          if (Array.isArray(adminData.sections) && adminData.sections.length > 0) {
            mergeSectionsSafely(adminData.sections);
          }
          if (Array.isArray(adminData.students) && adminData.students.length > 0) {
            mergeStudentsSafely(adminData.students);
          }
        }
      }

      if (teacherRes.status === "fulfilled") {
        const teacherData = await teacherRes.value.json();
        if (teacherData?.success) {
          if (Array.isArray(teacherData.sections) && teacherData.sections.length > 0) {
            mergeSectionsSafely(teacherData.sections);
          }
          if (Array.isArray(teacherData.assignedSubjects) && teacherData.assignedSubjects.length > 0) {
            mergeSubjectsSafely(teacherData.assignedSubjects);
          }
          if (
            Array.isArray(teacherData.adminAssignedStudents) &&
            teacherData.adminAssignedStudents.length > 0
          ) {
            mergeStudentsSafely(teacherData.adminAssignedStudents);
          }
          if (Array.isArray(teacherData.students) && teacherData.students.length > 0) {
            mergeStudentsSafely(teacherData.students);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchAdminAndTeacherState();

    const onSyncChange = () => {
      setSyncVersion((n) => n + 1);
      syncAllLocalData();
    };

    window.addEventListener("storage", onSyncChange);
    window.addEventListener("teacher-profile-updated", onSyncChange);
    window.addEventListener("student-profile-updated", onSyncChange);
    window.addEventListener("admin-student-assigned", onSyncChange);

    return () => {
      window.removeEventListener("storage", onSyncChange);
      window.removeEventListener("teacher-profile-updated", onSyncChange);
      window.removeEventListener("student-profile-updated", onSyncChange);
      window.removeEventListener("admin-student-assigned", onSyncChange);
    };
  }, []);

  const persistStudentsList = (nextList: StudentEntry[]) => {
    const hydrated = attachLatestPhotosToStudents(nextList);
    setStudents(hydrated);
    try {
      const serialized = JSON.stringify(hydrated);
      for (const key of STUDENT_LIST_KEYS) {
        localStorage.setItem(key, serialized);
      }
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const persistSubjectsList = (nextSubjects: SubjectEntry[]) => {
    setSubjects(nextSubjects);
    try {
      const serialized = JSON.stringify(nextSubjects);
      for (const key of SUBJECT_STORAGE_KEYS) {
        localStorage.setItem(key, serialized);
      }
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  // Delete a created subject from state, localStorage, and backend API
  const handleDeleteSubject = async (subject: SubjectEntry) => {
    if (!window.confirm(`Delete subject "${subject.name}"?`)) return;

    const targetId = String(subject.id).toLowerCase();
    const targetName = String(subject.name).toLowerCase();
    const matchesSub = (s: any) =>
      String(s?.id || "").toLowerCase() === targetId ||
      String(s?.name || s?.subjectName || "").toLowerCase() === targetName;

    const updated = subjects.filter((s) => !matchesSub(s));
    persistSubjectsList(updated);

    try {
      for (const key of SUBJECT_STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(parsed.filter((item) => !matchesSub(item))));
        } else if (Array.isArray(parsed?.subjects)) {
          localStorage.setItem(
            key,
            JSON.stringify({
              ...parsed,
              subjects: parsed.subjects.filter((item: any) => !matchesSub(item))
            })
          );
        }
      }
    } catch {}

    try {
      if (getAuthToken()) {
        await Promise.allSettled([
          fetch(`/api/admin/subjects/${encodeURIComponent(subject.id)}`, {
            method: "DELETE",
            headers: authHeaders
          }),
          fetch(`/api/subjects/${encodeURIComponent(subject.id)}`, {
            method: "DELETE",
            headers: authHeaders
          })
        ]);
      }
    } catch {}

    setSuccessMsg(`Deleted subject "${subject.name}".`);
  };

  // Step 1: Create Teacher Account Portal
  const handleCreateTeacherPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFullName.trim()) return;

    setError("");
    setSuccessMsg("");
    setLoading(true);

    const createdAccount: TeacherAccount = {
      id: `teacher_${Date.now()}`,
      name: teacherFullName.trim(),
      username: (teacherUsername || teacherFullName).trim(),
      email:
        teacherEmail.trim() ||
        `${teacherFullName.trim().toLowerCase().replace(/\s+/g, ".")}@edu.com`
    };

    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: createdAccount.name,
          username: createdAccount.username,
          email: createdAccount.email,
          password: teacherPassword
        })
      });
      const data = await res.json();
      const finalAccount = data?.success && data?.teacher ? data.teacher : createdAccount;
      const nextTeachers = [...teachers, finalAccount];
      setTeachers(nextTeachers);
      try {
        for (const k of TEACHER_LIST_KEYS) {
          localStorage.setItem(k, JSON.stringify(nextTeachers));
        }
      } catch {}
      setTeacherFullName("");
      setTeacherUsername("");
      setTeacherEmail("");
      setTeacherPassword("");
      setShowTeacherPassword(false);
      setSuccessMsg(`Teacher account portal created for ${finalAccount.name}!`);
    } catch {
      const nextTeachers = [...teachers, createdAccount];
      setTeachers(nextTeachers);
      try {
        for (const k of TEACHER_LIST_KEYS) {
          localStorage.setItem(k, JSON.stringify(nextTeachers));
        }
      } catch {}
      setTeacherFullName("");
      setTeacherUsername("");
      setTeacherEmail("");
      setTeacherPassword("");
      setShowTeacherPassword(false);
      setSuccessMsg(`Teacher account portal created for ${createdAccount.name}!`);
    } finally {
      setLoading(false);
    }
  };

  // Wipe and delete all records tied to a Teacher across state, localStorage, calendars, and API
  const handleDeleteTeacherAccount = async (teacher: TeacherAccount) => {
    const label = teacher.name || teacher.username || teacher.id;
    if (
      !window.confirm(
        `Permanently delete teacher "${label}" and wipe all associated records from the system?`
      )
    ) {
      return;
    }

    const targetKeys = [teacher.id, teacher.name, teacher.username, teacher.email]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    const matchesTeacher = (entry: any) =>
      [entry?.id, entry?.name, entry?.fullName, entry?.username, entry?.email]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean)
        .some((k) => targetKeys.includes(k));

    recordDeletedEntries(DELETED_TEACHERS_KEY, [
      teacher.id,
      teacher.name,
      teacher.username,
      teacher.email
    ]);

    const updatedTeachers = teachers.filter((t) => !matchesTeacher(t));
    setTeachers(updatedTeachers);

    // Purge teacher linkage from subjects, sections, and students in state
    const updatedSubjects = subjects.map((sub) => {
      const ref = String(sub.teacherId || sub.assignedTeacherId || "").trim().toLowerCase();
      return targetKeys.includes(ref)
        ? { ...sub, teacherId: "", assignedTeacherId: "" }
        : sub;
    });
    persistSubjectsList(updatedSubjects);

    const updatedSections = sections.filter(
      (sec) => !targetKeys.includes(String(sec.teacherId || "").trim().toLowerCase())
    );
    setSections(updatedSections);

    const updatedStudents = students.map((st) => {
      const tIdMatch = targetKeys.includes(String(st.assignedTeacherId || "").trim().toLowerCase());
      const tNameMatch = targetKeys.includes(
        String(st.assignedTeacherName || "").trim().toLowerCase()
      );
      if (tIdMatch || tNameMatch) {
        return { ...st, assignedTeacherId: "", assignedTeacherName: "" };
      }
      return st;
    });
    persistStudentsList(updatedStudents);

    if (targetKeys.includes(String(selectedTeacherId).toLowerCase())) {
      setSelectedTeacherId("");
    }
    if (targetKeys.includes(String(newSubjectTeacherId).toLowerCase())) {
      setNewSubjectTeacherId("");
    }
    if (inspectedProfile?.kind === "teacher" && matchesTeacher(inspectedProfile.data)) {
      setInspectedProfile(null);
    }

    try {
      for (const k of TEACHER_LIST_KEYS) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(k, JSON.stringify(parsed.filter((item) => !matchesTeacher(item))));
        }
      }

      for (const accKey of ["users", "registered_users", "accounts", "teacher_accounts"]) {
        const raw = localStorage.getItem(accKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(
            accKey,
            JSON.stringify(
              parsed.filter(
                (u: any) => !(String(u?.role || "").toLowerCase() === "teacher" && matchesTeacher(u))
              )
            )
          );
        }
      }

      const assignedRaw = localStorage.getItem("admin_assigned_teacher_students");
      if (assignedRaw) {
        const parsedAssigned = JSON.parse(assignedRaw);
        if (Array.isArray(parsedAssigned)) {
          localStorage.setItem(
            "admin_assigned_teacher_students",
            JSON.stringify(
              parsedAssigned.filter(
                (item: any) =>
                  !targetKeys.includes(String(item?.teacherId || "").trim().toLowerCase()) &&
                  !targetKeys.includes(String(item?.teacherName || "").trim().toLowerCase())
              )
            )
          );
        }
      }

      for (const secKey of SECTION_STORAGE_KEYS) {
        const rawSec = localStorage.getItem(secKey);
        if (!rawSec) continue;
        const parsedSec = JSON.parse(rawSec);
        if (Array.isArray(parsedSec)) {
          localStorage.setItem(
            secKey,
            JSON.stringify(
              parsedSec.filter(
                (sec: any) => !targetKeys.includes(String(sec?.teacherId || "").trim().toLowerCase())
              )
            )
          );
        }
      }

      const calRaw = localStorage.getItem("teacher_class_calendar");
      if (calRaw) {
        const parsedCal = JSON.parse(calRaw);
        if (Array.isArray(parsedCal)) {
          localStorage.setItem(
            "teacher_class_calendar",
            JSON.stringify(
              parsedCal.filter(
                (rec: any) =>
                  !targetKeys.includes(String(rec?.teacherId || "").trim().toLowerCase()) &&
                  !targetKeys.includes(String(rec?.teacherName || "").trim().toLowerCase())
              )
            )
          );
        }
      }

      window.dispatchEvent(new Event("storage"));
    } catch {}

    try {
      const currentToken = getAuthToken();
      if (currentToken) {
        await Promise.allSettled([
          fetch(`/api/admin/teachers/${encodeURIComponent(teacher.id)}`, {
            method: "DELETE",
            headers: authHeaders
          }),
          fetch(`/api/teachers/${encodeURIComponent(teacher.id)}`, {
            method: "DELETE",
            headers: authHeaders
          })
        ]);
      }
    } catch {}

    setSuccessMsg(
      `Deleted teacher "${label}" and cleared all associated records from the system.`
    );
  };

  // Wipe and delete Student Account across state, localStorage, attendance logs, assignments, and API
  const handleDeleteStudentAccount = async (student: StudentEntry) => {
    const label = student.name || student.username || student.id;
    if (
      !window.confirm(
        `Permanently delete student "${label}" and wipe all associated records from the system?`
      )
    ) {
      return;
    }

    const targetKeys = [student.id, student.name, student.username, student.email]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    const matchesStudent = (entry: any) =>
      [entry?.id, entry?.studentId, entry?.name, entry?.studentName, entry?.username, entry?.email]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean)
        .some((k) => targetKeys.includes(k));

    recordDeletedEntries(DELETED_STUDENTS_KEY, [
      student.id,
      student.name,
      student.username,
      student.email
    ]);

    const nextStudents = students.filter((s) => !matchesStudent(s));
    persistStudentsList(nextStudents);

    if (targetKeys.includes(String(selectedStudentId).toLowerCase())) {
      setSelectedStudentId("");
    }
    if (inspectedProfile?.kind === "student" && matchesStudent(inspectedProfile.data)) {
      setInspectedProfile(null);
    }

    try {
      for (const key of EXTRA_STUDENT_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(parsed.filter((item) => !matchesStudent(item))));
        } else if (Array.isArray(parsed?.students)) {
          localStorage.setItem(
            key,
            JSON.stringify({
              ...parsed,
              students: parsed.students.filter((item: any) => !matchesStudent(item))
            })
          );
        }
      }

      for (const attKey of ATTENDANCE_STORAGE_KEYS) {
        const rawAtt = localStorage.getItem(attKey);
        if (!rawAtt) continue;
        const parsedAtt = JSON.parse(rawAtt);
        if (Array.isArray(parsedAtt)) {
          localStorage.setItem(
            attKey,
            JSON.stringify(parsedAtt.filter((rec: any) => !matchesStudent(rec)))
          );
        }
      }

      window.dispatchEvent(new Event("storage"));
    } catch {}

    try {
      const currentToken = getAuthToken();
      if (currentToken) {
        await Promise.allSettled([
          fetch(`/api/admin/students/${encodeURIComponent(student.id)}`, {
            method: "DELETE",
            headers: authHeaders
          }),
          fetch(`/api/students/${encodeURIComponent(student.id)}`, {
            method: "DELETE",
            headers: authHeaders
          })
        ]);
      }
    } catch {}

    setSuccessMsg(`Deleted student "${label}" and cleared all associated records from the system.`);
  };
  // Step 2: Add / Remove / Submit Multiple Subjects
  const handleAddSubjectRow = () => {
    setSubjectDrafts((prev) => [...prev, ""]);
  };

  const handleUpdateSubjectRow = (index: number, value: string) => {
    setSubjectDrafts((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleRemoveSubjectRow = (index: number) => {
    setSubjectDrafts((prev) => (prev.length <= 1 ? [""] : prev.filter((_, idx) => idx !== index)));
  };

  const handleCreateMultipleSubjects = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedNames = subjectDrafts.map((s) => s.trim()).filter((s) => s.length > 0);

    if (cleanedNames.length === 0) {
      setError("Please enter at least one subject name.");
      return;
    }

    if (!newSubjectTeacherId) {
      setError("Please select a teacher first.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setLoading(true);

    const targetTeacherId = newSubjectTeacherId;
    const assignedTeacher = teachers.find((t) => String(t.id) === String(targetTeacherId));

    const createdItems: SubjectEntry[] = cleanedNames.map((name, idx) => ({
      id: `sub_${Date.now()}_${idx}`,
      name,
      teacherId: targetTeacherId,
      assignedTeacherId: targetTeacherId
    }));

    try {
      if (getAuthToken()) {
        await fetch("/api/admin/subjects/bulk", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            teacherId: targetTeacherId,
            subjects: createdItems
          })
        }).catch(() => {});
      }
    } catch {}

    const subMap = new Map<string, SubjectEntry>();
    for (const existing of subjects) {
      subMap.set(String(existing.name).toLowerCase(), existing);
    }
    for (const item of createdItems) {
      subMap.set(String(item.name).toLowerCase(), item);
    }

    persistSubjectsList(Array.from(subMap.values()));
    setSubjectDrafts([""]);
    setSuccessMsg(
      `Created ${createdItems.length} subject(s) (${cleanedNames.join(", ")}) for ${
        assignedTeacher?.name || "Teacher"
      }!`
    );
    setLoading(false);
  };

  // Step 3: Full Name = Username, System 6-digit = Default Password (editable later by student)
  const handleCreateStudentVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    setError("");
    setSuccessMsg("");
    setLoading(true);

    const fullNameClean = newStudentName.trim();
    const generatedSixDigitId = generateUniqueSixDigitId(students);
    const generatedSixDigitPassword = generatedSixDigitId;

    const pendingStudent: StudentEntry = {
      id: generatedSixDigitId,
      name: fullNameClean,
      username: fullNameClean,
      password: generatedSixDigitPassword,
      defaultPassword: generatedSixDigitPassword,
      email: newStudentEmail.trim(),
      isVerified: false,
      verificationStatus: "Pending Verification"
    };

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          ...pendingStudent,
          password: generatedSixDigitPassword,
          defaultPassword: generatedSixDigitPassword
        })
      });
      const data = await res.json();
      const resolvedPassword = String(
        data?.credentials?.defaultPassword ||
          data?.student?.password ||
          generatedSixDigitPassword
      ).trim();
      const createdStudent: StudentEntry =
        data?.success && data?.student
          ? {
              ...data.student,
              id: String(data.student.id || data.student.studentId || generatedSixDigitId),
              name: data.student.name || fullNameClean,
              username: data.student.name || data.student.username || fullNameClean,
              password: resolvedPassword,
              defaultPassword: resolvedPassword,
              email: data.student.email ?? newStudentEmail.trim(),
              isVerified: Boolean(data.student.isVerified),
              verificationStatus: data.student.isVerified ? "Verified" : "Pending Verification"
            }
          : pendingStudent;

      persistStudentsList([
        ...students.filter(
          (s) =>
            String(s.name || "").toLowerCase() !== String(createdStudent.name || "").toLowerCase()
        ),
        createdStudent
      ]);
      setNewStudentName("");
      setNewStudentEmail("");
      setSuccessMsg(
        `Created "${createdStudent.name}" | Username: "${createdStudent.username}" | Default 6-Digit Password: ${createdStudent.password} (student can change password later).`
      );
    } catch {
      persistStudentsList([
        ...students.filter(
          (s) =>
            String(s.name || "").toLowerCase() !== String(pendingStudent.name || "").toLowerCase()
        ),
        pendingStudent
      ]);
      setNewStudentName("");
      setNewStudentEmail("");
      setSuccessMsg(
        `Created "${pendingStudent.name}" | Username: "${pendingStudent.username}" | Default 6-Digit Password: ${pendingStudent.password} (student can change password later).`
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Assign Student to a Teacher and broadcast to TeacherDashboard
  const handleAssignStudentToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!selectedStudentId) {
      setError("Please select a student first.");
      return;
    }
    if (!selectedTeacherId) {
      setError("Please select a teacher.");
      return;
    }

    const chosenStudent = students.find((s) => String(s.id) === String(selectedStudentId));
    const chosenTeacher = teachers.find((t) => String(t.id) === String(selectedTeacherId));
    const teacherSubjectsList = subjects.filter(
      (sub) =>
        String(sub.teacherId || "") === String(selectedTeacherId) ||
        String(sub.assignedTeacherId || "") === String(selectedTeacherId)
    );
    const primarySubject = teacherSubjectsList[0] || null;
    const syncedStudentPhoto =
      readStudentPhotoGlobal(chosenStudent) || chosenStudent?.photoUrl || chosenStudent?.avatar || "";
    const verified = Boolean(chosenStudent?.isVerified || syncedStudentPhoto);

    if (chosenStudent && syncedStudentPhoto) {
      saveStudentPhotoGlobal(chosenStudent, syncedStudentPhoto);
    }
    if (chosenTeacher) {
      const tPhoto =
        readTeacherPhotoGlobal(chosenTeacher) || chosenTeacher.photoUrl || chosenTeacher.avatar || "";
      if (tPhoto) saveTeacherPhotoGlobal(chosenTeacher, tPhoto);
    }

    const payload = {
      id: `assign_${selectedStudentId}_${selectedTeacherId}`,
      studentId: selectedStudentId,
      studentName: chosenStudent?.name || chosenStudent?.username || "Student",
      username: chosenStudent?.username || "",
      email: chosenStudent?.email || "",
      photoUrl: syncedStudentPhoto,
      avatar: syncedStudentPhoto,
      isVerified: verified,
      verificationStatus: verified ? "Verified" : "Pending Verification",
      teacherId: selectedTeacherId,
      teacherName: chosenTeacher?.name || chosenTeacher?.username || "Teacher",
      subjectId: primarySubject?.id || null,
      subjectName: teacherSubjectsList.map((s) => s.name).join(" • ") || "",
      assignedByAdmin: true
    };

    try {
      const rawExisting = localStorage.getItem("admin_assigned_teacher_students");
      const parsedExisting = rawExisting ? JSON.parse(rawExisting) : [];
      const cleaned = Array.isArray(parsedExisting)
        ? parsedExisting.filter(
            (item: any) =>
              !(
                String(item?.studentId || item?.id) === String(selectedStudentId) &&
                String(item?.teacherId) === String(selectedTeacherId)
              )
          )
        : [];
      localStorage.setItem(
        "admin_assigned_teacher_students",
        JSON.stringify([payload, ...cleaned])
      );
      window.dispatchEvent(new CustomEvent("admin-student-assigned", { detail: payload }));
      window.dispatchEvent(new Event("storage"));
    } catch {}

    persistStudentsList(
      students.map((st) =>
        String(st.id) === String(selectedStudentId)
          ? {
              ...st,
              isVerified: verified,
              verificationStatus: verified ? "Verified" : "Pending Verification",
              assignedTeacherId: selectedTeacherId,
              assignedTeacherName: payload.teacherName,
              photoUrl: syncedStudentPhoto || st.photoUrl,
              avatar: syncedStudentPhoto || st.avatar
            }
          : st
      )
    );

    setLoading(true);
    try {
      await fetch("/api/admin/assign-student-teacher", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
    } catch {}
    setLoading(false);

    setSuccessMsg(
      `Assigned "${payload.studentName}" to ${payload.teacherName} and synced to Teacher Dashboard!`
    );
  };

  const triggerLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("edulectrical_token");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    else if (onLogOut) onLogOut();
  };

  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.name || "").toLowerCase().includes(q) ||
      String(t.username || "").toLowerCase().includes(q) ||
      String(t.email || "").toLowerCase().includes(q)
    );
  });

  const filteredSubjectTeachers = teachers.filter((t) => {
    const q = subjectTeacherSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.name || "").toLowerCase().includes(q) ||
      String(t.username || "").toLowerCase().includes(q) ||
      String(t.email || "").toLowerCase().includes(q)
    );
  });

  const filteredAssignTeachers = teachers.filter((t) => {
    const q = assignTeacherSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.name || "").toLowerCase().includes(q) ||
      String(t.username || "").toLowerCase().includes(q) ||
      String(t.email || "").toLowerCase().includes(q)
    );
  });

  const filteredEnrolledStudents = students.filter((st) => {
    const q = enrolledStudentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(st.name || "").toLowerCase().includes(q) ||
      String(st.username || "").toLowerCase().includes(q) ||
      String(st.id || "").toLowerCase().includes(q)
    );
  });

  const filteredAssignStudents = students.filter((st) => {
    const q = assignStudentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(st.name || "").toLowerCase().includes(q) ||
      String(st.username || "").toLowerCase().includes(q) ||
      String(st.id || "").toLowerCase().includes(q)
    );
  });

  const selectedStudentObj = students.find((s) => String(s.id) === String(selectedStudentId)) || null;
  const selectedTeacherObj = teachers.find((t) => String(t.id) === String(selectedTeacherId)) || null;
  const selectedTeacherSubjects = subjects.filter(
    (sub) =>
      String(sub.teacherId || "") === String(selectedTeacherId) ||
      String(sub.assignedTeacherId || "") === String(selectedTeacherId)
  );
  const selectedTeacherSections = sections.filter(
    (sec) => !sec.teacherId || String(sec.teacherId) === String(selectedTeacherId)
  );
  const [resetRequests, setResetRequests] = useState<TeacherResetRequest[]>(() =>
  getTeacherResetRequestsLocal()
);

useEffect(() => {
  const refresh = () => setResetRequests(getTeacherResetRequestsLocal());
  refresh();
  window.addEventListener('storage', refresh);
  window.addEventListener('focus', refresh);
  return () => {
    window.removeEventListener('storage', refresh);
    window.removeEventListener('focus', refresh);
  };
}, []);
  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-6 space-y-6 select-none">
      {/* Clean Top Admin Header */}
      <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-black tracking-wide uppercase text-white">
            ADMIN CONTROL CENTER
          </h1>
          <p className="text-xs text-slate-400">
            Teacher Portals, Subjects, Student Verifications &amp; Teacher Assignments
          </p>
        </div>

        <button
          type="button"
          onClick={triggerLogout}
          className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      {/* Ordered 4-Step Flow Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFlowStep(1)}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            flowStep === 1
              ? "bg-indigo-600 border-indigo-400 text-white shadow-lg"
              : "bg-[#0d1322] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider opacity-80">1. TEACHER PORTAL</p>
          <p className="text-sm font-bold mt-0.5">Create Teacher Account Portal</p>
          <p className="text-[11px] opacity-80 mt-1">{teachers.length} Registered Teachers</p>
        </button>

        <button
          type="button"
          onClick={() => setFlowStep(2)}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            flowStep === 2
              ? "bg-indigo-600 border-indigo-400 text-white shadow-lg"
              : "bg-[#0d1322] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider opacity-80">2. SUBJECTS</p>
          <p className="text-sm font-bold mt-0.5">Create Subject</p>
          <p className="text-[11px] opacity-80 mt-1">{subjects.length} Total Subjects</p>
        </button>

        <button
          type="button"
          onClick={() => setFlowStep(3)}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            flowStep === 3
              ? "bg-indigo-600 border-indigo-400 text-white shadow-lg"
              : "bg-[#0d1322] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider opacity-80">3. STUDENT VERIFICATION</p>
          <p className="text-sm font-bold mt-0.5">Create Student Verification</p>
          <p className="text-[11px] opacity-80 mt-1">{students.length} Enrolled Students</p>
        </button>

        <button
          type="button"
          onClick={() => setFlowStep(4)}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            flowStep === 4
              ? "bg-emerald-600 border-emerald-400 text-white shadow-lg"
              : "bg-[#0d1322] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider opacity-80">4. ASSIGN TO TEACHER</p>
          <p className="text-sm font-bold mt-0.5">Assign Student to a Teacher</p>
          <p className="text-[11px] opacity-80 mt-1">Search, Click &amp; View Subjects</p>
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 font-bold">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 font-bold">
          {successMsg}
        </p>
      )}

      {/* 1. CREATE TEACHER ACCOUNT PORTAL + SEARCHABLE / CLICKABLE / DELETABLE TEACHERS */}
      {flowStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <form
            onSubmit={handleCreateTeacherPortal}
            className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-indigo-400">Create Teacher Account Portal</h2>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Teacher Full Name</label>
              <input
                type="text"
                value={teacherFullName}
                onChange={(e) => setTeacherFullName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Username</label>
                <input
                  type="text"
                  value={teacherUsername}
                  onChange={(e) => setTeacherUsername(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-bold block mb-1">Email Address</label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showTeacherPassword ? "text" : "password"}
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="e.g. 12345"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword((prev) => !prev)}
                  title={showTeacherPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showTeacherPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
            >
              {loading ? "Creating..." : "Create Teacher Portal"}
            </button>
          </form>

          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">
                View Registered Teachers ({filteredTeachers.length})
              </h2>
              <span className="text-[11px] text-slate-400">Click teacher to inspect or delete</span>
            </div>
          <div className="bg-[#0d1222] border border-white/10 rounded-2xl p-4 space-y-3 text-xs text-white">
  <div className="flex items-center justify-between gap-2">
    <h3 className="font-black text-sm">Teacher Password Reset Requests</h3>
    <div className="flex items-center gap-2">
      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[11px]">
        {resetRequests.filter((r) => r.status === 'pending').length} Pending
      </span>
      {resetRequests.length > 0 && (
        <button
          type="button"
          onClick={() => setResetRequests(clearTeacherResetRequests())}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px] cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  </div>

  {resetRequests.length === 0 ? (
    <p className="text-slate-400">No teacher password reset requests yet.</p>
  ) : (
    resetRequests.map((req) => (
      <div
        key={req.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 border-t border-white/10 first:border-t-0"
      >
        <div>
          <p className="font-bold text-white">
            {req.username}{' '}
            <span className="text-[11px] uppercase text-indigo-300">({req.status})</span>
          </p>
          {req.note && <p className="text-slate-400 text-[11px]">Note: {req.note}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {req.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() =>
                  setResetRequests(updateTeacherResetRequestStatus(req.id, 'approved'))
                }
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() =>
                  setResetRequests(updateTeacherResetRequestStatus(req.id, 'rejected'))
                }
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              >
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setResetRequests(deleteTeacherResetRequest(req.id))}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    ))
  )}
</div>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {filteredTeachers.length === 0 ? (
                <p className="text-slate-500 italic py-6 text-center">No registered teachers found.</p>
              ) : (
                filteredTeachers.map((t) => {
                  const tImg = readTeacherPhotoGlobal(t) || t.photoUrl || t.avatar || "";
                  const tName = t.name || t.username || "Teacher";
                  const tSubs = subjects.filter(
                    (s) => String(s.teacherId || s.assignedTeacherId) === String(t.id)
                  );
                  const tSecs = sections.filter(
                    (sec) => !sec.teacherId || String(sec.teacherId) === String(t.id)
                  );

                  return (
                    <div
                      key={t.id}
                      onClick={() =>
                        setInspectedProfile({
                          kind: "teacher",
                          data: t,
                          subjects: tSubs,
                          sections: tSecs
                        })
                      }
                      className="bg-[#131b2e] border border-slate-700/60 hover:border-indigo-400/60 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {tImg ? (
                          <img
                            src={tImg}
                            alt={tName}
                            className="w-11 h-11 rounded-full object-cover border border-indigo-400/60 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300 shrink-0">
                            {tName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{tName}</p>
                          <p className="text-[11px] text-indigo-300 truncate">
                            @{t.username || tName}
                            {tSecs.length > 0
                              ? ` • Sections: ${tSecs.map((sc) => sc.name).join(", ")}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeacherAccount(t);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold shrink-0 cursor-pointer transition"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE MULTIPLE SUBJECTS (ADD SUBJECT + X) & SEARCHABLE + SELECT A TEACHER */}
      {flowStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <form
            onSubmit={handleCreateMultipleSubjects}
            className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-indigo-400">Create Subjects</h2>
              <button
                type="button"
                onClick={handleAddSubjectRow}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus size={14} />
                <span>Add Subject</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {subjectDrafts.map((draftVal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftVal}
                    onChange={(e) => handleUpdateSubjectRow(idx, e.target.value)}
                    placeholder="Math"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white font-bold"
                  />
                  {subjectDrafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubjectRow(idx)}
                      title="Remove subject row"
                      className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 font-bold block">Search &amp; Select a Teacher</label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={subjectTeacherSearch}
                  onChange={(e) => setSubjectTeacherSearch(e.target.value)}
                  placeholder="Search teacher name..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                />
              </div>

              <select
                value={newSubjectTeacherId}
                onChange={(e) => setNewSubjectTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-indigo-300 font-bold cursor-pointer"
              >
                <option value="">-- Select a Teacher --</option>
                {filteredSubjectTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.username || "Teacher"}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
            >
              {loading ? "Saving..." : "Save Subjects"}
            </button>
          </form>

          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-emerald-400">Created Subjects ({subjects.length})</h2>
            {subjects.length === 0 ? (
              <p className="text-slate-500 italic py-6 text-center">No subjects created yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {subjects.map((sub) => {
                  const tObj = teachers.find(
                    (t) => String(t.id) === String(sub.teacherId || sub.assignedTeacherId)
                  );
                  return (
                    <div
                      key={sub.id}
                      onClick={() =>
                        tObj &&
                        setInspectedProfile({
                          kind: "teacher",
                          data: tObj,
                          subjects: subjects.filter(
                            (s) => String(s.teacherId || s.assignedTeacherId) === String(tObj.id)
                          ),
                          sections: sections.filter(
                            (sec) => !sec.teacherId || String(sec.teacherId) === String(tObj.id)
                          )
                        })
                      }
                      className="bg-[#131b2e] border border-slate-700/60 hover:border-indigo-400/60 rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{sub.name}</p>
                        <p className="text-[11px] text-indigo-300 truncate">
                          Teacher: {tObj?.name || "Unassigned"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubject(sub);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold shrink-0 cursor-pointer transition"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CREATE STUDENT VERIFICATION (FULL NAME = USERNAME, SYSTEM 6-DIGIT = DEFAULT PASSWORD) */}
      {flowStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <form
            onSubmit={handleCreateStudentVerification}
            className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-emerald-400">Create Student Verification</h2>
            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
              Student <strong>Username</strong> is their <strong>Full Name</strong>, and the system
              automatically generates a <strong>6-digit Default Password</strong> (which the student
              can change later).
            </p>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Student Full Name (Username)</label>
              <input
                type="text"
                required
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Student Email (Optional)</label>
              <input
                type="email"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                placeholder="Optional (student can add their own)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
            >
              {loading ? "Generating Default Password..." : "Create Student Verification"}
            </button>
          </form>

          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">
                View Enrolled Students ({filteredEnrolledStudents.length})
              </h2>
              <span className="text-[11px] text-slate-400">Click student to inspect or delete</span>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={enrolledStudentSearch}
                onChange={(e) => setEnrolledStudentSearch(e.target.value)}
                placeholder="e.g. Juan Dela Cruz or 6-digit password"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {filteredEnrolledStudents.length === 0 ? (
                <p className="text-slate-500 italic py-6 text-center">No enrolled students found.</p>
              ) : (
                filteredEnrolledStudents.map((st) => {
                  const stImg = readStudentPhotoGlobal(st) || st.photoUrl || st.avatar || "";
                  const stName = st.name || st.username || "Student";
                  const stPass = st.password || st.defaultPassword || st.id;
                  const verified = Boolean(st.isVerified || stImg);

                  return (
                    <div
                      key={st.id}
                      onClick={() => setInspectedProfile({ kind: "student", data: st })}
                      className="bg-[#131b2e] border border-slate-700/60 hover:border-emerald-400/60 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {stImg ? (
                          <img
                            src={stImg}
                            alt={stName}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-400/60 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center font-bold text-emerald-300 shrink-0">
                            {stName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm truncate">{stName}</p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                verified
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {verified ? "Verified" : "Pending Verification"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            Username: {st.username || stName} • 6-Digit Password: {stPass}
                            {st.assignedTeacherName ? ` • Teacher: ${st.assignedTeacherName}` : ""}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStudentAccount(st);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold shrink-0 cursor-pointer transition"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* 4. ASSIGN STUDENT TO A TEACHER (SEARCHABLE STUDENT & SEARCHABLE TEACHER + CLICK TO UNSELECT) */}
      {flowStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-emerald-400">Select Student</h2>
              <span className="text-[11px] text-slate-400">{filteredAssignStudents.length} students</span>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={assignStudentSearch}
                onChange={(e) => setAssignStudentSearch(e.target.value)}
                placeholder="e.g. Juan Dela Cruz or 6-digit password"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredAssignStudents.length === 0 ? (
                <p className="text-slate-500 italic py-6 text-center">No matching student found.</p>
              ) : (
                filteredAssignStudents.map((st) => {
                  const stImg = readStudentPhotoGlobal(st) || st.photoUrl || st.avatar || "";
                  const stName = st.name || st.username || "Student";
                  const stPass = st.password || st.defaultPassword || st.id;
                  const isSelected = String(st.id) === String(selectedStudentId);
                  const verified = Boolean(st.isVerified || stImg);

                  return (
                    <div
                      key={st.id}
                      onClick={() =>
                        setSelectedStudentId((prev) =>
                          String(prev) === String(st.id) ? "" : String(st.id)
                        )
                      }
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-emerald-600/20 border-emerald-400"
                          : "bg-[#131b2e] border-slate-700/60 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {stImg ? (
                          <img
                            src={stImg}
                            alt={stName}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-400/60 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center font-bold text-emerald-300 shrink-0">
                            {stName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white truncate">{stName}</p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                verified
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {verified ? "Verified" : "Pending Verification"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            Password: {stPass}
                            {st.assignedTeacherName ? ` • Teacher: ${st.assignedTeacherName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedProfile({ kind: "student", data: st });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStudentAccount(st);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <form
            onSubmit={handleAssignStudentToTeacher}
            className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <h2 className="text-base font-bold text-indigo-400 flex items-center gap-2">
                <UserCheck size={18} />
                <span>Assign Selected Student to a Teacher</span>
              </h2>

              <div className="bg-[#131b2e] border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-400 font-bold">Selected Student</p>
                  <p className="text-sm font-bold text-emerald-300 mt-0.5">
                    {selectedStudentObj
                      ? `${selectedStudentObj.name || selectedStudentObj.username} (Pass: ${
                          selectedStudentObj.password || selectedStudentObj.defaultPassword || selectedStudentObj.id
                        })`
                      : "Click a student on the left"}
                  </p>
                </div>
                {selectedStudentObj && (
                  <button
                    type="button"
                    onClick={() => setInspectedProfile({ kind: "student", data: selectedStudentObj })}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/25 text-indigo-300 text-[10px] font-bold cursor-pointer"
                  >
                    Inspect Student
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Search &amp; Choose Teacher</label>
                  <span className="text-[10px] text-slate-400">
                    Click selected teacher to unselect
                  </span>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={assignTeacherSearch}
                    onChange={(e) => setAssignTeacherSearch(e.target.value)}
                    placeholder="Search teacher name or email..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {filteredAssignTeachers.length === 0 ? (
                    <p className="text-slate-500 italic py-3 text-center">No matching teacher found.</p>
                  ) : (
                    filteredAssignTeachers.map((t) => {
                      const tName = t.name || t.username || "Teacher";
                      const isTeacherSelected = String(t.id) === String(selectedTeacherId);
                      return (
                        <div
                          key={t.id}
                          onClick={() =>
                            setSelectedTeacherId((prev) =>
                              String(prev) === String(t.id) ? "" : String(t.id)
                            )
                          }
                          className={`px-3.5 py-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                            isTeacherSelected
                              ? "bg-indigo-600/25 border-indigo-400 text-white"
                              : "bg-[#131b2e] border-slate-700/60 hover:border-slate-500 text-slate-200"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold truncate">{tName}</p>
                            {t.email && (
                              <p className="text-[10px] text-slate-400 truncate">{t.email}</p>
                            )}
                          </div>
                          {isTeacherSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold shrink-0">
                              Selected (Click to unselect)
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedTeacherObj && (
                <div className="bg-[#131b2e] border border-indigo-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      onClick={() =>
                        setInspectedProfile({
                          kind: "teacher",
                          data: selectedTeacherObj,
                          subjects: selectedTeacherSubjects,
                          sections: selectedTeacherSections
                        })
                      }
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      {readTeacherPhotoGlobal(selectedTeacherObj) ? (
                        <img
                          src={readTeacherPhotoGlobal(selectedTeacherObj)}
                          alt={selectedTeacherObj.name || "Teacher"}
                          className="w-11 h-11 rounded-full object-cover border border-indigo-400/60"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300">
                          {(selectedTeacherObj.name || "T").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white hover:text-indigo-300 transition">
                          {selectedTeacherObj.name || selectedTeacherObj.username || "Teacher"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {selectedTeacherObj.email || ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setInspectedProfile({
                          kind: "teacher",
                          data: selectedTeacherObj,
                          subjects: selectedTeacherSubjects,
                          sections: selectedTeacherSections
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-indigo-300 cursor-pointer"
                    >
                      Teacher Profile
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-bold">
                      Teacher Assigned Subject(s) ({selectedTeacherSubjects.length}):
                    </p>
                    {selectedTeacherSubjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeacherSubjects.map((sub) => (
                          <span
                            key={sub.id}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[11px]"
                          >
                            {sub.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        No subject assigned to this teacher yet.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-bold">
                      Teacher Section(s) ({selectedTeacherSections.length}):
                    </p>
                    {selectedTeacherSections.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeacherSections.map((sec) => {
                          const subName =
                            subjects.find((s) => String(s.id) === String(sec.subjectId))?.name ||
                            sec.subject ||
                            "Subject";
                          return (
                            <button
                              key={sec.id}
                              type="button"
                              onClick={() =>
                                setInspectedProfile({
                                  kind: "section",
                                  data: sec,
                                  teacherName:
                                    selectedTeacherObj.name ||
                                    selectedTeacherObj.username ||
                                    "Teacher",
                                  subjectName: subName
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] cursor-pointer"
                            >
                              {sec.name} ({subName})
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        No teacher section found in storage yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
            >
              {loading ? "Assigning..." : "Assign Student to Teacher"}
            </button>
          </form>
        </div>
      )}

      {/* Clickable Profile Modal for Student, Teacher, and Section */}
      {inspectedProfile && (
        <div
          onClick={() => setInspectedProfile(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d1322] border border-slate-700 rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 text-xs shadow-2xl"
          >
            {inspectedProfile.kind === "student" && (
              <>
                <div className="flex items-center gap-3">
                  {readStudentPhotoGlobal(inspectedProfile.data) ? (
                    <img
                      src={readStudentPhotoGlobal(inspectedProfile.data)}
                      alt={inspectedProfile.data.name || "Student"}
                      className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-600/30 border-2 border-emerald-500 flex items-center justify-center text-lg font-black text-emerald-300">
                      {(inspectedProfile.data.name || inspectedProfile.data.username || "S")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {inspectedProfile.data.name || inspectedProfile.data.username || "Student"}
                    </h3>
                    <p className="text-slate-400 font-mono">
                      Username: {inspectedProfile.data.username || inspectedProfile.data.name}
                    </p>
                    <p className="text-slate-400 font-mono">
                      Default 6-Digit Password:{" "}
                      {inspectedProfile.data.password ||
                        inspectedProfile.data.defaultPassword ||
                        inspectedProfile.data.id}
                    </p>
                    <p className="text-amber-300 font-bold mt-0.5">
                      Status:{" "}
                      {inspectedProfile.data.isVerified ||
                      readStudentPhotoGlobal(inspectedProfile.data)
                        ? "Verified"
                        : "Pending Verification"}
                    </p>
                  </div>
                </div>

                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 text-slate-300 space-y-1">
                  <p>
                    Assigned Teacher:{" "}
                    <strong className="text-emerald-300">
                      {inspectedProfile.data.assignedTeacherName || "Not yet assigned"}
                    </strong>
                  </p>
                  {inspectedProfile.data.sectionName && (
                    <p>
                      Section:{" "}
                      <strong className="text-indigo-300">{inspectedProfile.data.sectionName}</strong>
                    </p>
                  )}
                </div>

                <VerifiedStudentAttendanceCalendar student={inspectedProfile.data} />
              </>
            )}

            {inspectedProfile.kind === "teacher" && (
              <>
                <div className="flex items-center gap-3">
                  {readTeacherPhotoGlobal(inspectedProfile.data) ? (
                    <img
                      src={readTeacherPhotoGlobal(inspectedProfile.data)}
                      alt={inspectedProfile.data.name || "Teacher"}
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-lg font-black text-indigo-300">
                      {(inspectedProfile.data.name || "T").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {inspectedProfile.data.name || inspectedProfile.data.username || "Teacher"}
                    </h3>
                    <p className="text-slate-400">{inspectedProfile.data.email || ""}</p>
                  </div>
                </div>
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 space-y-1.5 text-slate-300">
                  <p>
                    Subjects:{" "}
                    <strong className="text-indigo-300">
                      {inspectedProfile.subjects.length > 0
                        ? inspectedProfile.subjects.map((s) => s.name).join(", ")
                        : "None"}
                    </strong>
                  </p>
                  <p>
                    Sections:{" "}
                    <strong className="text-emerald-300">
                      {inspectedProfile.sections.length > 0
                        ? inspectedProfile.sections.map((sec) => sec.name).join(", ")
                        : "None"}
                    </strong>
                  </p>
                </div>

                <TeacherClassOnlyCalendar teacher={inspectedProfile.data} />
              </>
            )}

            {inspectedProfile.kind === "section" && (
              <>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Section: {inspectedProfile.data.name}
                  </h3>
                  <p className="text-indigo-300 font-bold mt-0.5">
                    Subject: {inspectedProfile.subjectName}
                  </p>
                </div>
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 space-y-1 text-slate-300">
                  <p>
                    Teacher: <strong className="text-emerald-300">{inspectedProfile.teacherName}</strong>
                  </p>
                  <p>
                    Room: <strong>{inspectedProfile.data.room || "N/A"}</strong>
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedProfile(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}