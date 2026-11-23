import React, { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight, Clock, Users, AlertTriangle } from "lucide-react";
import {
  compressImageFile,
  saveTeacherPhotoGlobal,
  readTeacherPhotoGlobal,
  readStudentPhotoGlobal
} from "./photoSync";

interface Student {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  photoUrl?: string;
  avatar?: string;
  isVerified?: boolean;
  sectionId?: string | null;
  subjectId?: string | null;
  subjectName?: string;
  assignedByAdmin?: boolean;
  subject?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

interface SectionSchedule {
  id: string;
  date: string;
  room: string;
  startTime: string;
  absentCutoffTime: string;
  endTime: string;
}

interface Section {
  id: string;
  name: string;
  subjectId?: string;
  subject?: string;
  room?: string;
  startTime: string;
  endTime: string;
  absentCutoffTime: string;
  requireTeacherApproval?: boolean;
  students: Student[];
  schedules?: SectionSchedule[];
}

interface Subject {
  id: string;
  name: string;
  teacherId?: string;
  students?: Student[];
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  sectionId: string;
  type: "In" | "Out";
  status?: string;
  colorCode?: string;
  date: string;
  time: string;
  photoUrl?: string;
  student?: Student;
}

interface TeacherDashboardProps {
  token?: string;
  onLogout?: () => void;
  onLogOut?: () => void;
}

type SelectedProfileView =
  | { kind: "teacher"; data: any }
  | { kind: "student"; data: Student; sectionName?: string }
  | { kind: "section"; data: Section; subjectName?: string }
  | null;

export default function TeacherDashboard({ token, onLogout, onLogOut }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sections" | "adminStudents" | "logs" | "qr" | "records" | "approvals">("sections");
  const [sections, setSections] = useState<Section[]>([]);
  const [adminAssignedStudents, setAdminAssignedStudents] = useState<Student[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<SelectedProfileView>(null);

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [addingScheduleSectionId, setAddingScheduleSectionId] = useState<string | null>(null);
  const [newScheduleForm, setNewScheduleForm] = useState({
    date: new Date().toISOString().split("T")[0],
    room: "",
    startTime: "08:00",
    absentCutoffTime: "08:30",
    endTime: "17:00",
  });

  const getAuthToken = () => {
    if (token) return token;
    return localStorage.getItem("token") || localStorage.getItem("edulectrical_token") || "";
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };

  const [teacher, setTeacher] = useState(() => {
    const fallbackProfile = {
      id: "",
      name: "",
      username: "",
      email: "",
      photoUrl: ""
    };
    const savedPhoto = readTeacherPhotoGlobal(fallbackProfile);
    return {
      ...fallbackProfile,
      photoUrl: savedPhoto || ""
    };
  });

  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  const [sectionForm, setSectionForm] = useState({
    name: "",
    subjectId: "",
    room: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endTime: "17:00",
    absentCutoffTime: "08:30",
    requireTeacherApproval: false,
  });

  const [qrSectionId, setQrSectionId] = useState("");
  const [qrType, setQrType] = useState<"In" | "Out">("In");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  const applyStudentPhotos = (list: Student[]): Student[] =>
    (Array.isArray(list) ? list : []).map((st) => {
      const synced = readStudentPhotoGlobal(st) || st?.photoUrl || st?.avatar || "";
      return synced ? { ...st, photoUrl: synced, avatar: synced } : st;
    });

  const readLocalAdminAssignments = (): Student[] => {
    if (typeof window === "undefined") return [];
    const keys = [
      "admin_assigned_teacher_students",
      "admin_student_assignments",
      "teacher_admin_students"
    ];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return applyStudentPhotos(
            parsed.map((item: any) => ({
              id: String(item?.studentId || item?.id || ""),
              name: item?.studentName || item?.name || item?.username || "Student",
              username: item?.username || "",
              email: item?.email || "",
              sectionId: item?.sectionId || null,
              subjectId: item?.subjectId || null,
              subjectName: item?.subjectName || item?.subject?.name || "",
              assignedByAdmin: true,
              isVerified: item?.isVerified ?? true,
              section: item?.section || (item?.sectionName ? { id: item?.sectionId || "", name: item?.sectionName } : null)
            }))
          );
        }
      } catch {}
    }
    return [];
  };

  const fetchTeacherData = async () => {
    const fallbackProfile = {
      id: "",
      name: "",
      username: "",
      email: ""
    };

    try {
      const currentToken = getAuthToken();
      const savedPhotoEarly = readTeacherPhotoGlobal(fallbackProfile);
      if (savedPhotoEarly) {
        setTeacher((prev) => ({
          ...prev,
          photoUrl: prev.photoUrl || savedPhotoEarly
        }));
      }

      const localAdminStudents = readLocalAdminAssignments();
      if (localAdminStudents.length > 0) {
        setAdminAssignedStudents(localAdminStudents);
      }

      if (!currentToken) return;

      const profileRes = await fetch("/api/auth/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const profileData = await profileRes.json();

      if (profileData?.success && profileData?.user) {
        const u = profileData.user;
        const baseProfile = {
          id: u.id || fallbackProfile.id,
          name: u.name || fallbackProfile.name,
          username: u.username || fallbackProfile.username,
          email: u.email || (u.username ? `${u.username}@edu.com` : fallbackProfile.email),
        };
        const resolvedPhoto =
          (typeof u.photoUrl === "string" && u.photoUrl.trim().length > 20
            ? u.photoUrl.trim()
            : "") || readTeacherPhotoGlobal(baseProfile);

        const updatedProfile = {
          ...baseProfile,
          photoUrl: resolvedPhoto || "",
        };
        setTeacher(updatedProfile);
        if (resolvedPhoto) {
          saveTeacherPhotoGlobal(updatedProfile, resolvedPhoto);
        }
      }

      const res = await fetch("/api/state/teacher", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const data = await res.json();
      if (data?.success) {
        const loadedSubjects: Subject[] = Array.isArray(data.assignedSubjects) ? data.assignedSubjects : [];
        setAssignedSubjects(loadedSubjects);

        const mergedAdminStudents =
          Array.isArray(data.adminAssignedStudents) && data.adminAssignedStudents.length > 0
            ? applyStudentPhotos(data.adminAssignedStudents)
            : localAdminStudents;
        setAdminAssignedStudents(mergedAdminStudents);

        const formattedSections = (Array.isArray(data.sections) ? data.sections : []).map((sec: any) => ({
          ...sec,
          students: applyStudentPhotos(sec?.students || []),
          schedules: Array.isArray(sec?.schedules) ? sec.schedules : [],
          requireTeacherApproval: Boolean(sec?.requireTeacherApproval)
        }));

        setSections(formattedSections);
        setRecords(Array.isArray(data.records) ? data.records : []);

        if (formattedSections.length > 0 && !qrSectionId) {
          setQrSectionId(formattedSections[0].id);
        }
        if (loadedSubjects.length > 0 && !sectionForm.subjectId) {
          setSectionForm((prev) => ({ ...prev, subjectId: loadedSubjects[0].id }));
        }
      }
    } catch (err) {
      console.error("Error fetching teacher state:", err);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  useEffect(() => {
    const syncLivePhotosAndAssignments = () => {
      setTeacher((prev) => {
        const latestTeacherPhoto = readTeacherPhotoGlobal(prev);
        if (latestTeacherPhoto && latestTeacherPhoto !== prev.photoUrl) {
          return { ...prev, photoUrl: latestTeacherPhoto };
        }
        return prev;
      });

      const localAdmin = readLocalAdminAssignments();
      setAdminAssignedStudents((prev) => {
        const base = localAdmin.length > 0 ? localAdmin : prev;
        return applyStudentPhotos(base);
      });

      setSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          students: applyStudentPhotos(sec.students || [])
        }))
      );
    };

    syncLivePhotosAndAssignments();
    window.addEventListener("storage", syncLivePhotosAndAssignments);
    window.addEventListener("student-profile-updated", syncLivePhotosAndAssignments);
    window.addEventListener("teacher-profile-updated", syncLivePhotosAndAssignments);
    window.addEventListener("admin-student-assigned", syncLivePhotosAndAssignments);

    return () => {
      window.removeEventListener("storage", syncLivePhotosAndAssignments);
      window.removeEventListener("student-profile-updated", syncLivePhotosAndAssignments);
      window.removeEventListener("teacher-profile-updated", syncLivePhotosAndAssignments);
      window.removeEventListener("admin-student-assigned", syncLivePhotosAndAssignments);
    };
  }, []);

  const toggleSectionDetails = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleToggleApproval = async (sectionId: string, currentState: boolean) => {
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/sections/${sectionId}/toggle-verification`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ requireTeacherApproval: !currentState }),
      });
      const data = await res.json();
      if (data?.success) {
        setSections((prev) =>
          prev.map((sec) => (sec.id === sectionId ? { ...sec, requireTeacherApproval: !currentState } : sec))
        );
        setSuccessMsg("Verification setting updated successfully!");
        fetchTeacherData();
      } else {
        setError(data?.error || "Failed to update setting.");
      }
    } catch {
      setError("Network error while updating toggle.");
    }
  };

  const handleApproveAttendance = async (recordId: string, newStatus: string) => {
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/teacher/approve-attendance", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ recordId, status: newStatus }),
      });
      const data = await res.json();
      if (data?.success) {
        setRecords((prev) => prev.map((rec) => (rec.id === recordId ? { ...rec, status: newStatus } : rec)));
        setSuccessMsg(`Attendance marked as ${newStatus}!`);
        fetchTeacherData();
      } else {
        setError(data?.error || "Failed to update attendance status.");
      }
    } catch {
      setError("Network error updating attendance.");
    }
  };

  const startAddingSchedule = (e: React.MouseEvent, sec: Section) => {
    e.stopPropagation();
    setAddingScheduleSectionId(sec.id);
    setNewScheduleForm({
      date: new Date().toISOString().split("T")[0],
      room: sec.room || "",
      startTime: sec.startTime || "08:00",
      absentCutoffTime: sec.absentCutoffTime || "08:30",
      endTime: sec.endTime || "17:00",
    });
  };

  const handleAddScheduleLog = async (e: React.FormEvent, sectionId: string) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch(`/api/sections/${sectionId}/schedules`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(newScheduleForm),
      });
      const data = await res.json();

      if (!data?.success) {
        setError(data?.error || "Failed to add schedule log.");
      } else {
        setSuccessMsg("New date schedule log added successfully!");
        setAddingScheduleSectionId(null);
        fetchTeacherData();
      }
    } catch {
      setError("Network error adding schedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScheduleLog = async (scheduleId: string) => {
    if (!window.confirm("Delete this schedule log?")) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE", headers: authHeaders });
      const data = await res.json();
      if (data?.success) {
        setSuccessMsg("Schedule log deleted!");
        fetchTeacherData();
      }
    } catch {
      setError("Failed to delete schedule log.");
    }
  };

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!window.confirm(`Delete Section ${sectionName}?`)) return;
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE", headers: authHeaders });
      const data = await res.json();
      if (data?.success) {
        setSuccessMsg(`Section ${sectionName} deleted successfully!`);
        fetchTeacherData();
      }
    } catch {
      setError("Failed to delete section.");
    }
  };

  const handleTeacherPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccessMsg("");
    try {
      const photoData = await compressImageFile(file, 180, 0.55);
      const savedPhoto = saveTeacherPhotoGlobal(teacher, photoData) || photoData;
      const updated = { ...teacher, photoUrl: savedPhoto, avatar: savedPhoto };

      setTeacher(updated);
      setIsEditingPhoto(false);

      try {
        await fetch("/api/teacher/profile", {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ photoUrl: savedPhoto, avatar: savedPhoto }),
        });
        saveTeacherPhotoGlobal(updated, savedPhoto);
        setSuccessMsg("Profile picture updated and synced with Admin & Student Portal!");
      } catch {
        saveTeacherPhotoGlobal(updated, savedPhoto);
        setSuccessMsg("Profile picture updated locally and synced with Student Portal!");
      }
    } catch {
      setError("Failed to process image.");
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(sectionForm),
      });
      const data = await res.json();

      if (!data?.success) {
        setError(data?.error || "Failed to create section.");
      } else {
        setSuccessMsg("Section created successfully!");
        setSectionForm({
          name: "",
          subjectId: assignedSubjects[0]?.id || "",
          room: "",
          date: new Date().toISOString().split("T")[0],
          startTime: "08:00",
          endTime: "17:00",
          absentCutoffTime: "08:30",
          requireTeacherApproval: false,
        });
        fetchTeacherData();
      }
    } catch {
      setError("Network error creating section.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudentToSection = async (studentId: string, sectionId: string) => {
    setError("");
    setSuccessMsg("");
    const targetSection = sections.find((s) => String(s.id) === String(sectionId));

    setAdminAssignedStudents((prev) =>
      prev.map((st) =>
        String(st.id) === String(studentId)
          ? {
              ...st,
              sectionId: sectionId || null,
              section: sectionId
                ? { id: sectionId, name: targetSection?.name || "Section" }
                : null
            }
          : st
      )
    );

    try {
      const res = await fetch(`/api/teacher/students/${studentId}/assign-section`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ sectionId }),
      });
      const data = await res.json();
      if (data?.success) {
        setSuccessMsg(
          sectionId
            ? `Student assigned to ${targetSection?.name || "section"}!`
            : "Student removed from section!"
        );
        fetchTeacherData();
      } else {
        setError(data?.error || "Failed to assign student.");
      }
    } catch {
      setSuccessMsg(
        sectionId
          ? `Student assigned locally to ${targetSection?.name || "section"}!`
          : "Student removed locally from section!"
      );
    }
  };

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setGeneratedImageUrl("");
    setQrLoading(true);

    try {
      const res = await fetch("/api/attendance/qr-session", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ sectionId: qrSectionId, type: qrType }),
      });
      const data = await res.json();
      if (!data?.success) {
        setError(data?.error || "Failed to generate QR session.");
      } else {
        setGeneratedImageUrl(data.qrImageUrl || "");
        setSuccessMsg(`Secure QR Code generated successfully for Time ${qrType}!`);
      }
    } catch {
      setError("Network error generating QR.");
    } finally {
      setQrLoading(false);
    }
  };

  const triggerLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("edulectrical_token");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    else if (onLogOut) onLogOut();
  };

  const pendingApprovalRecords = records.filter((r) => String(r?.status || "") === "Pending Approval");
  const teacherSubjectList = assignedSubjects.map((s) => s?.name).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row select-none">
      <div className="w-full md:w-64 bg-[#0d1322] border-r border-slate-800 p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <h1 className="text-base font-black text-indigo-400">Edulectrical</h1>
            <p className="text-[10px] text-slate-400">Teacher Portal</p>
          </div>

          <nav className="space-y-1 text-xs">
            <button
              onClick={() => setActiveTab("sections")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer flex items-center justify-between ${
                activeTab === "sections" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>Class Sections</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20">{sections.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("adminStudents")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer flex items-center justify-between ${
                activeTab === "adminStudents" ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>Admin Students</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20">{adminAssignedStudents.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer ${
                activeTab === "logs" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Schedule Logs
            </button>

            <button
              onClick={() => setActiveTab("approvals")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer flex justify-between items-center ${
                activeTab === "approvals" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>Approvals</span>
              {pendingApprovalRecords.length > 0 && (
                <span className="bg-amber-500 text-black font-black px-1.5 py-0.5 rounded-full text-[10px]">
                  {pendingApprovalRecords.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer ${
                activeTab === "qr" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Attendance QR Code
            </button>

            <button
              onClick={() => setActiveTab("records")}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer ${
                activeTab === "records" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Attendance Records
            </button>
          </nav>
        </div>

        <button
          onClick={triggerLogout}
          className="mt-6 w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-bold transition cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div
            onClick={() => setSelectedProfile({ kind: "teacher", data: teacher })}
            className="text-center md:text-left cursor-pointer group"
          >
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase group-hover:text-indigo-300 transition">
              Welcome, Teacher <span className="text-indigo-400">{teacher.name || ""}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Email: <strong className="text-slate-200">{teacher.email || ""}</strong>
              {teacherSubjectList.length > 0 && (
                <span className="ml-2 text-indigo-300 font-bold">
                  - Subjects: {teacherSubjectList.join(", ")}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#131b2e] border border-slate-800 p-3 rounded-xl shadow-inner">
            <div
              onClick={() => setSelectedProfile({ kind: "teacher", data: teacher })}
              className="relative cursor-pointer"
            >
              {teacher.photoUrl ? (
                <img
                  src={teacher.photoUrl}
                  alt="Teacher Profile"
                  className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-lg font-bold text-indigo-300 shadow-md">
                  {teacher.name ? teacher.name.charAt(0).toUpperCase() : "L"}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#131b2e] rounded-full"></span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setSelectedProfile({ kind: "teacher", data: teacher })}
                className="text-xs font-bold text-white hover:text-indigo-300 transition cursor-pointer text-left block"
              >
                {teacher.name || ""}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPhoto(!isEditingPhoto)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline mt-0.5 block transition cursor-pointer"
              >
                {isEditingPhoto ? "Cancel" : "Change Picture"}
              </button>
            </div>
          </div>
        </div>

        {isEditingPhoto && (
          <div className="bg-[#0d1322] border border-indigo-500/30 rounded-2xl p-4 max-w-md shadow-lg space-y-3">
            <h3 className="text-xs font-bold text-indigo-300 uppercase">Upload Profile Picture (Synced to Admin)</h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleTeacherPhotoUpload}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 font-bold">{error}</p>}
        {successMsg && <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 font-bold">{successMsg}</p>}

        {activeTab === "sections" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-indigo-400">Create Class Section</h2>
                <form onSubmit={handleCreateSection} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Section Name</label>
                    <input
                      type="text"
                      placeholder="e.g. A1 or Section 3-A"
                      required
                      value={sectionForm.name}
                      onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Select Admin-Assigned Subject</label>
                    <select
                      value={sectionForm.subjectId}
                      onChange={(e) => setSectionForm({ ...sectionForm, subjectId: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-indigo-300 font-bold"
                    >
                      <option value="">-- Choose Subject --</option>
                      {assignedSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Room</label>
                      <input
                        type="text"
                        placeholder="e.g. Room 222"
                        required
                        value={sectionForm.room}
                        onChange={(e) => setSectionForm({ ...sectionForm, room: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Initial Date</label>
                      <input
                        type="date"
                        required
                        value={sectionForm.date}
                        onChange={(e) => setSectionForm({ ...sectionForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.startTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, startTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Cutoff</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.absentCutoffTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, absentCutoffTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.endTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, endTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
                  >
                    {loading ? "Creating..." : "Create Class Section"}
                  </button>
                </form>
              </div>

              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                    <Users size={18} />
                    <span>Admin-Assigned Subjects &amp; Students</span>
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Admin assigns students to you. View them under <strong>Admin Students</strong>, check teacher subjects and sections, and assign them into your created sections such as <strong>A1</strong>.
                  </p>
                </div>
                <div className="bg-[#131b2e] p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <p className="text-xs font-bold text-indigo-300">Quick Summary:</p>
                  <p className="text-[11px] text-slate-300">
                    Assigned Teacher Subjects ({assignedSubjects.length}):{" "}
                    <strong className="text-indigo-300">
                      {teacherSubjectList.length > 0 ? teacherSubjectList.join(", ") : "None"}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Admin Students Assigned to Teacher: <strong className="text-emerald-400">{adminAssignedStudents.length}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-indigo-400">Your Created Sections ({sections.length})</h2>

              {sections.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No sections created yet.</p>
              ) : (
                <div className="space-y-4">
                  {sections.map((sec) => {
                    const matchedSubject = assignedSubjects.find((s) => s.id === sec.subjectId);
                    const secSubjectLabel = matchedSubject?.name || sec.subject || "N/A";
                    return (
                      <div key={sec.id} className="bg-[#131b2e] border border-slate-700/60 rounded-2xl p-4 space-y-4 shadow-md">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                          <div
                            onClick={() => setSelectedProfile({ kind: "section", data: sec, subjectName: secSubjectLabel })}
                            className="cursor-pointer group"
                          >
                            <h3 className="text-sm font-bold text-white flex flex-wrap items-center gap-2 group-hover:text-indigo-300 transition">
                              <span>Section: {sec.name}</span>
                              <span className="text-indigo-400">• Subject: {secSubjectLabel}</span>
                              {teacherSubjectList.length > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                                  All Teacher Subjects: {teacherSubjectList.join(", ")}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Assigned Students: <strong className="text-emerald-400">{sec.students?.length || 0}</strong> | Room: <strong className="text-slate-200">{sec.room || "N/A"}</strong>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleToggleApproval(sec.id, Boolean(sec.requireTeacherApproval))}
                              className="px-3 py-1.5 rounded-xl bg-[#0d1322] border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              {sec.requireTeacherApproval ? (
                                <><ToggleRight size={20} className="text-emerald-400" /><span className="text-emerald-400">Approval ON</span></>
                              ) : (
                                <><ToggleLeft size={20} className="text-slate-400" /><span className="text-slate-400">Approval OFF</span></>
                              )}
                            </button>

                            <button
                              onClick={(e) => startAddingSchedule(e, sec)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Clock size={14} />
                              <span>+ Add Date</span>
                            </button>

                            <button
                              onClick={() => handleDeleteSection(sec.id, sec.name)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold cursor-pointer"
                            >
                              Delete
                            </button>

                            <button
                              onClick={() => toggleSectionDetails(sec.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                            >
                              {expandedSections[sec.id] ? "Hide Section Details" : "View Section"}
                            </button>
                          </div>
                        </div>

                        {addingScheduleSectionId === sec.id && (
                          <form onSubmit={(e) => handleAddScheduleLog(e, sec.id)} className="bg-[#070b14] border border-indigo-500/30 rounded-xl p-4 space-y-3">
                            <h4 className="text-xs font-bold text-indigo-300">Add Scheduled Date Log for {sec.name}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-slate-400 block mb-1">Date</label>
                                <input
                                  type="date"
                                  required
                                  value={newScheduleForm.date}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, date: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded-lg bg-[#131b2e] border border-slate-700"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 block mb-1">Room</label>
                                <input
                                  type="text"
                                  required
                                  value={newScheduleForm.room}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, room: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded-lg bg-[#131b2e] border border-slate-700"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setAddingScheduleSectionId(null)} className="px-3 py-1 rounded bg-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
                              <button type="submit" className="px-3 py-1 rounded bg-indigo-600 text-xs font-bold text-white cursor-pointer">Save Date</button>
                            </div>
                          </form>
                        )}

                        {expandedSections[sec.id] && (
                          <div className="space-y-2 pt-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase">
                              Section: {sec.name} • Subject: {secSubjectLabel} ({sec.students?.length || 0} Students)
                            </h4>
                            {!sec.students || sec.students.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No students assigned to this section yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {sec.students.map((student) => {
                                  const studentImg = readStudentPhotoGlobal(student) || student?.photoUrl || student?.avatar || "";
                                  const displayName = student?.name || student?.username || "Student";
                                  return (
                                    <div key={student.id} className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                                      <div
                                        onClick={() => setSelectedProfile({ kind: "student", data: student, sectionName: sec.name })}
                                        className="flex items-center gap-2.5 cursor-pointer group"
                                      >
                                        {studentImg ? (
                                          <img
                                            src={studentImg}
                                            alt={displayName}
                                            className="w-9 h-9 rounded-full object-cover border border-indigo-500/60"
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-full bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300">
                                            {displayName.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-bold text-white group-hover:text-indigo-300 transition flex flex-wrap items-center gap-2">
                                            <span>{displayName}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                              Admin Student
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                                              Section: {sec.name}
                                            </span>
                                            {!student?.isVerified && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                                <AlertTriangle size={11} /> Pending Face Verification
                                              </span>
                                            )}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-mono">
                                            ID: {student.id} • Subject: {secSubjectLabel}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleAssignStudentToSection(student.id, "")}
                                        className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "adminStudents" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                <Users size={18} />
                <span>Admin Student Assignments &amp; Section Selection</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Students assigned by Admin are labeled <strong>Admin Student</strong>. View teacher subjects and sections, click any profile to inspect, and assign students to your created sections (such as <strong>A1</strong>).
              </p>
            </div>

            {adminAssignedStudents.length === 0 ? (
              <div className="text-center py-12 bg-[#131b2e] rounded-xl border border-slate-700/60">
                <p className="text-xs text-slate-400">No students assigned by admin yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminAssignedStudents.map((student) => {
                  const studentImg = readStudentPhotoGlobal(student) || student?.photoUrl || student?.avatar || "";
                  const displayName = student?.name || student?.username || "Student";
                  const assignedSecObj =
                    sections.find((s) => String(s.id) === String(student.sectionId || "")) ||
                    (student.section?.name ? { id: student.section.id, name: student.section.name } : null);
                  const currentSectionName = assignedSecObj?.name || "Unassigned";

                  return (
                    <div key={student.id} className="bg-[#131b2e] border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                      <div
                        onClick={() => setSelectedProfile({ kind: "student", data: student, sectionName: currentSectionName })}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        {studentImg ? (
                          <img
                            src={studentImg}
                            alt={displayName}
                            className="w-11 h-11 rounded-full object-cover border border-emerald-500/50"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-sm">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                              {displayName}
                            </p>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              Admin Student
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                              Section: {currentSectionName}
                            </span>
                            {!student?.isVerified && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                <AlertTriangle size={12} /> Pending Face Verification
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            Student ID: <span className="text-emerald-400 font-bold">{student.id}</span>
                            {teacherSubjectList.length > 0 && (
                              <span className="ml-2 text-indigo-300 font-sans font-semibold">
                                - Teacher Subject(s): {teacherSubjectList.join(" • ")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">Assign to Created Section (e.g. A1):</label>
                          <select
                            value={student.sectionId || ""}
                            onChange={(e) => handleAssignStudentToSection(student.id, e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-[#070b14] border border-indigo-500/50 text-xs text-indigo-300 font-bold cursor-pointer"
                          >
                            <option value="">-- Choose Section --</option>
                            {sections.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name} ({assignedSubjects.find((s) => s.id === sec.subjectId)?.name || sec.subject || "Subject"})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-indigo-400">Class Section Scheduled Date Logs</h2>
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No sections created yet.</p>
            ) : (
              <div className="space-y-4">
                {sections.map((sec) => (
                  <div key={sec.id} className="bg-[#131b2e] border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-white">
                      Section: {sec.name} • Subject: {assignedSubjects.find((s) => s.id === sec.subjectId)?.name || sec.subject || "N/A"}
                    </h3>
                    {!sec.schedules || sec.schedules.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No schedule logs.</p>
                    ) : (
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-700 text-slate-400">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Room</th>
                              <th className="pb-2">Start</th>
                              <th className="pb-2">Cutoff</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {sec.schedules.map((sch) => (
                              <tr key={sch.id} className="hover:bg-slate-800/40">
                                <td className="py-2.5 font-bold text-emerald-300">{sch.date}</td>
                                <td className="py-2.5 text-slate-300">{sch.room}</td>
                                <td className="py-2.5 text-slate-300">{sch.startTime}</td>
                                <td className="py-2.5 text-amber-300">{sch.absentCutoffTime}</td>
                                <td className="py-2.5 text-right">
                                  <button onClick={() => handleDeleteScheduleLog(sch.id)} className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold cursor-pointer">Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "approvals" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-indigo-400">Pending Attendance Approvals</h2>
            {pendingApprovalRecords.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No pending attendance approvals.</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovalRecords.map((rec) => {
                  const sec = sections.find((s) => s.id === rec.sectionId);
                  return (
                    <div key={rec.id} className="bg-[#131b2e] border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-white">Student ID: {rec.studentId}</p>
                        <p className="text-indigo-400">Section: {sec?.name || "N/A"}</p>
                        <p className="text-slate-400">Logged at {rec.date} {rec.time}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApproveAttendance(rec.id, "Present")} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white cursor-pointer">Approve Present</button>
                        <button onClick={() => handleApproveAttendance(rec.id, "Late")} className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white cursor-pointer">Mark Late</button>
                        <button onClick={() => handleApproveAttendance(rec.id, "Absent")} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white cursor-pointer">Mark Absent</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "qr" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4 max-w-xl mx-auto text-xs">
            <h2 className="text-base font-bold text-indigo-400">Generate Attendance QR Code</h2>
            <form onSubmit={handleGenerateQR} className="space-y-4">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Select Section</label>
                <select value={qrSectionId} onChange={(e) => setQrSectionId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 font-bold" required>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setQrType("In")} className={`py-2 rounded-xl font-bold cursor-pointer ${qrType === "In" ? "bg-indigo-600 text-white" : "bg-[#131b2e] text-slate-400"}`}>Time IN</button>
                <button type="button" onClick={() => setQrType("Out")} className={`py-2 rounded-xl font-bold cursor-pointer ${qrType === "Out" ? "bg-indigo-600 text-white" : "bg-[#131b2e] text-slate-400"}`}>Time OUT</button>
              </div>

              <button type="submit" disabled={qrLoading} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white cursor-pointer shadow-lg">
                {qrLoading ? "Generating..." : "Generate Secure QR Code"}
              </button>
            </form>

            {generatedImageUrl && (
              <div className="mt-6 p-6 bg-[#131b2e] border border-slate-700 rounded-2xl flex flex-col items-center justify-center space-y-4">
                <p className="font-bold text-emerald-400 uppercase tracking-widest">Active QR Session</p>
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <img src={generatedImageUrl} alt="QR" className="w-56 h-56 object-contain pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-indigo-400">Attendance Records History</h2>
            {records.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No attendance records found.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="pb-3">Student ID</th>
                      <th className="pb-3">Section</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {records.map((rec) => {
                      const sec = sections.find((s) => s.id === rec.sectionId);
                      const statusText = String(rec?.status || "");
                      const isPending = statusText.includes("Pending");
                      const isLate = statusText.includes("Late");
                      const isAbsent = statusText.includes("Absent");

                      const badgeColor = isPending
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : isLate
                        ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                        : isAbsent
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/40">
                          <td className="py-3 font-bold text-white">{rec.studentId}</td>
                          <td className="py-3 text-indigo-300">{sec?.name || "N/A"}</td>
                          <td className="py-3"><span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold">Time {rec.type}</span></td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 w-fit ${badgeColor}`}>
                              {isPending && <AlertTriangle size={13} className="text-amber-400" />}
                              <span>{statusText || "Recorded"}</span>
                            </span>
                          </td>
                          <td className="py-3 text-slate-300">{rec.date} {rec.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedProfile && (
        <div
          onClick={() => setSelectedProfile(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d1322] border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 text-xs shadow-2xl"
          >
            {selectedProfile.kind === "teacher" && (
              <>
                <div className="flex items-center gap-3">
                  {readTeacherPhotoGlobal(selectedProfile.data) ? (
                    <img
                      src={readTeacherPhotoGlobal(selectedProfile.data)}
                      alt={selectedProfile.data?.name || ""}
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-lg font-black text-indigo-300">
                      {(selectedProfile.data?.name || "L").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {selectedProfile.data?.name || ""}
                    </h3>
                    <p className="text-slate-400">{selectedProfile.data?.email || ""}</p>
                  </div>
                </div>
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 space-y-1">
                  <p className="text-slate-400 font-bold">Assigned Subjects:</p>
                  <p className="text-indigo-300 font-bold">
                    {teacherSubjectList.length > 0 ? teacherSubjectList.join(", ") : "No subjects assigned"}
                  </p>
                </div>
              </>
            )}

            {selectedProfile.kind === "student" && (
              <>
                <div className="flex items-center gap-3">
                  {readStudentPhotoGlobal(selectedProfile.data) ? (
                    <img
                      src={readStudentPhotoGlobal(selectedProfile.data)}
                      alt={selectedProfile.data?.name || "Student"}
                      className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-600/30 border-2 border-emerald-500 flex items-center justify-center text-lg font-black text-emerald-300">
                      {(selectedProfile.data?.name || selectedProfile.data?.username || "S").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white">
                        {selectedProfile.data?.name || selectedProfile.data?.username || "Student"}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        Admin Student
                      </span>
                    </div>
                    <p className="text-slate-400 font-mono">ID: {selectedProfile.data?.id}</p>
                  </div>
                </div>
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 space-y-1">
                  <p className="text-slate-300">
                    Section: <strong className="text-indigo-300">{selectedProfile.sectionName || "Unassigned"}</strong>
                  </p>
                  <p className="text-slate-300">
                    Teacher Subject(s):{" "}
                    <strong className="text-emerald-300">
                      {teacherSubjectList.length > 0 ? teacherSubjectList.join(", ") : "N/A"}
                    </strong>
                  </p>
                </div>
              </>
            )}

            {selectedProfile.kind === "section" && (
              <>
                <div>
                  <h3 className="text-sm font-black text-white">Section: {selectedProfile.data.name}</h3>
                  <p className="text-indigo-300 font-bold mt-0.5">
                    Subject: {selectedProfile.subjectName || "N/A"}
                  </p>
                </div>
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 space-y-1 text-slate-300">
                  <p>Room: <strong>{selectedProfile.data.room || "N/A"}</strong></p>
                  <p>
                    Schedule: <strong>{selectedProfile.data.startTime} - {selectedProfile.data.endTime}</strong>
                  </p>
                  <p>
                    All Teacher Subjects:{" "}
                    <strong className="text-indigo-300">
                      {teacherSubjectList.length > 0 ? teacherSubjectList.join(", ") : "N/A"}
                    </strong>
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
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