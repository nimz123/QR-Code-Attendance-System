import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ToggleLeft, ToggleRight, Clock } from "lucide-react";

interface Student {
  id: string;
  name: string;
  username: string;
  photoUrl?: string;
  isVerified?: boolean;
  sectionId: string;
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
  name: string;       // Section Name (e.g., A-1)
  subject?: string;   // Subject Name (e.g., MUSIC)
  room?: string;
  startTime: string;
  endTime: string;
  absentCutoffTime: string;
  requireTeacherApproval?: boolean; // Toggle for teacher verification
  students: Student[];
  schedules?: SectionSchedule[];
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  sectionId: string;
  type: "In" | "Out";
  status: string;
  date: string;
  time: string;
  photoUrl?: string;
}

interface TeacherDashboardProps {
  token?: string;
  onLogout?: () => void;
  onLogOut?: () => void;
}

export default function TeacherDashboard({ token, onLogout, onLogOut }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sections" | "logs" | "qr" | "records" | "approvals">("sections");
  const [sections, setSections] = useState<Section[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [expandedStudents, setExpandedStudents] = useState<{ [key: string]: boolean }>({});

  const [addingScheduleSectionId, setAddingScheduleSectionId] = useState<string | null>(null);
  const [newScheduleForm, setNewScheduleForm] = useState({
    date: new Date().toISOString().split('T')[0],
    room: "",
    startTime: "08:00",
    absentCutoffTime: "08:30",
    endTime: "17:00",
  });

  const [teacher, setTeacher] = useState({
    id: "",
    name: "",
    username: "",
    email: "",
    photoUrl: ""
  });
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  // Section form state with separated Section Name and Subject Name inputs
  const [sectionForm, setSectionForm] = useState({
    name: "",      // Section (e.g., A-1)
    subject: "",   // Subject (e.g., MUSIC)
    room: "",
    date: new Date().toISOString().split('T')[0],
    startTime: "08:00",
    endTime: "17:00",
    absentCutoffTime: "08:30",
    requireTeacherApproval: false,
  });

  const [studentForm, setStudentForm] = useState({
    sectionId: "",
    name: "",
    username: "",
    password: "",
    photoUrl: "",
  });

  const [showStudentPassword, setShowStudentPassword] = useState(false);

  const [qrSectionId, setQrSectionId] = useState("");
  const [qrType, setQrType] = useState<"In" | "Out">("In");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  const getAuthToken = () => {
    if (token) return token;
    return localStorage.getItem("token") || "";
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  };

  // Fetch teacher profile and current state data from backend API
  const fetchTeacherData = async () => {
    try {
      const currentToken = getAuthToken();
      if (!currentToken) return;

      const profileRes = await fetch("/api/auth/me", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const profileData = await profileRes.json();
      if (profileData.success && profileData.user) {
        const updatedProfile = {
          id: profileData.user.id || "",
          name: profileData.user.name || "",
          username: profileData.user.username || "",
          email: profileData.user.email || `${profileData.user.username}@school.edu`,
          photoUrl: profileData.user.photoUrl || "",
        };
        setTeacher(updatedProfile);
        localStorage.setItem("user", JSON.stringify(updatedProfile));
      }

      const res = await fetch("/api/state/teacher", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        const formattedSections = (data.sections || []).map((sec: any) => ({
          ...sec,
          students: sec.students || [],
          schedules: sec.schedules || [],
          requireTeacherApproval: Boolean(sec.requireTeacherApproval)
        }));

        setSections(formattedSections);
        setRecords(data.records || []);
        if (formattedSections.length > 0 && (!studentForm.sectionId || !formattedSections.some((s: any) => s.id === studentForm.sectionId))) {
          setStudentForm((prev) => ({ ...prev, sectionId: formattedSections[0].id }));
          setQrSectionId(formattedSections[0].id);
        }
      } else {
        setError(data.error || "Failed to load teacher data.");
      }
    } catch (err) {
      console.error("Error fetching teacher state:", err);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const toggleSectionDetails = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleStudentDetails = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Handle Toggle for Teacher Approval (ON/OFF)
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
      if (data.success) {
        setSections((prev) =>
          prev.map((sec) =>
            sec.id === sectionId ? { ...sec, requireTeacherApproval: !currentState } : sec
          )
        );
        setSuccessMsg("Verification toggle updated successfully!");
        fetchTeacherData();
      } else {
        setError(data.error || "Failed to update verification setting.");
      }
    } catch (err) {
      setError("Network error while updating toggle.");
    }
  };

  // Handle Teacher Approving Student Attendance (Pending Approval -> Present / Absent)
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
      if (data.success) {
        setRecords((prev) =>
          prev.map((rec) => (rec.id === recordId ? { ...rec, status: newStatus } : rec))
        );
        setSuccessMsg(`Attendance marked as ${newStatus}!`);
        fetchTeacherData();
      } else {
        setError(data.error || "Failed to update attendance status.");
      }
    } catch (err) {
      setError("Network error while updating attendance status.");
    }
  };

  const startAddingSchedule = (e: React.MouseEvent, sec: Section) => {
    e.stopPropagation();
    setAddingScheduleSectionId(sec.id);
    setNewScheduleForm({
      date: new Date().toISOString().split('T')[0],
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

      if (!data.success) {
        setError(data.error || "Failed to add schedule log.");
      } else {
        setSuccessMsg("New date and schedule log added successfully!");
        setAddingScheduleSectionId(null);
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while adding schedule log.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScheduleLog = async (scheduleId: string) => {
    if (!window.confirm("Are you sure you want to delete this specific schedule log?")) return;
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to delete schedule log.");
      } else {
        setSuccessMsg("Schedule log deleted successfully!");
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while deleting schedule log.");
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all schedule logs history?")) return;
    setError("");
    setSuccessMsg("");

    try {
      for (const sec of sections) {
        await fetch(`/api/sections/${sec.id}/schedules`, {
          method: "DELETE",
          headers: authHeaders,
        });
      }
      setSuccessMsg("All schedule logs history cleared successfully!");
      fetchTeacherData();
    } catch (err) {
      setError("Network error while clearing all history.");
    }
  };

  const handleDeleteSection = async (sectionId: string, sectionName: string, subjectName?: string) => {
    if (!window.confirm(`Are you sure you want to delete Section: ${sectionName} (${subjectName || 'No Subject'})? This will also remove all enrolled students and records.`)) {
      return;
    }
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to delete section.");
      } else {
        setSuccessMsg(`Section ${sectionName} and its students were deleted successfully!`);
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while deleting section.");
    }
  };

  const getStudentStats = (studentId: string, sectionId: string) => {
    const studentRecords = records.filter((r) => r.studentId === studentId && r.sectionId === sectionId);
    const present = studentRecords.filter((r) => r.status === 'Present').length;
    const late = studentRecords.filter((r) => r.status === 'Late').length;
    const absent = studentRecords.filter((r) => r.status === 'Absent').length;
    return { present, late, absent };
  };

  const handleTeacherPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const updated = { ...teacher, photoUrl: base64String };
        setTeacher(updated);
        localStorage.setItem("user", JSON.stringify(updated));
        setIsEditingPhoto(false);

        try {
          await fetch("/api/teacher/profile", {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({ photoUrl: base64String }),
          });
          setSuccessMsg("Profile picture updated successfully!");
        } catch {
          setSuccessMsg("Profile picture updated locally!");
        }
      };
      reader.readAsDataURL(file);
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

      if (!data.success) {
        setError(data.error || "Failed to create section.");
      } else {
        setSuccessMsg("Section and Subject created successfully!");
        setSectionForm({ name: "", subject: "", room: "", date: new Date().toISOString().split('T')[0], startTime: "08:00", endTime: "17:00", absentCutoffTime: "08:30", requireTeacherApproval: false });
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while creating section.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStudentForm((prev) => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(studentForm),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to enroll student.");
      } else {
        setSuccessMsg("Student enrolled successfully!");
        setStudentForm({
          sectionId: studentForm.sectionId,
          name: "",
          username: "",
          password: "",
          photoUrl: "",
        });
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while enrolling student.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
      return;
    }
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/teacher/students/${studentId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to delete student.");
      } else {
        setSuccessMsg(`Student ${studentName} deleted successfully!`);
        fetchTeacherData();
      }
    } catch (err) {
      setError("Network error while deleting student.");
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

      if (!data.success) {
        setError(data.error || "Failed to generate QR session.");
      } else {
        setGeneratedImageUrl(data.qrImageUrl);
        setSuccessMsg(`Unique QR Code generated successfully for Time ${qrType}!`);
      }
    } catch (err) {
      setError("Network error while generating QR session.");
    } finally {
      setQrLoading(false);
    }
  };

  const triggerLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    else if (onLogOut) onLogOut();
  };

  const pendingApprovalRecords = records.filter((r) => r.status === 'Pending Approval');

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row select-none">
      <div className="w-full md:w-64 bg-[#0d1322] border-r border-slate-800 p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <div>
            <h1 className="text-base font-bold text-indigo-400">KhlarEskwela</h1>
            <p className="text-[10px] text-slate-400">Instructor Portal</p>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("sections")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "sections" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📚 Class List & Sections
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "logs" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📅 Class Section Scheduled Logs
            </button>
            <button
              onClick={() => setActiveTab("approvals")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer flex justify-between items-center ${
                activeTab === "approvals" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>✅ Attendance Approvals</span>
              {pendingApprovalRecords.length > 0 && (
                <span className="bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full text-[10px]">
                  {pendingApprovalRecords.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "qr" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📡 Attendance QR Code
            </button>
            <button
              onClick={() => setActiveTab("records")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === "records" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📊 Attendance Records
            </button>
          </nav>
        </div>

        <button
          onClick={triggerLogout}
          className="mt-6 w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-medium transition cursor-pointer"
        >
          Log Out
        </button>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        
        {/* TEACHER HEADER */}
        <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="text-center md:text-left">
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide uppercase">
              HELLO GOOD DAY TEACHER <span className="text-indigo-400">{teacher.name || "..."}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Email: <strong className="text-slate-200">{teacher.email || "..."}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#131b2e] border border-slate-800 p-3 rounded-xl shadow-inner">
            <div className="relative">
              {teacher.photoUrl ? (
                <img 
                  src={teacher.photoUrl} 
                  alt="Teacher Profile" 
                  className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-md pointer-events-none"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center text-lg font-bold text-indigo-300 shadow-md pointer-events-none">
                  {teacher.name ? teacher.name.charAt(0).toUpperCase() : "T"}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#131b2e] rounded-full"></span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{teacher.name || "..."}</p>
              <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{teacher.email || "..."}</p>
              <button 
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
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Upload New Profile Picture from Gallery</h3>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleTeacherPhotoUpload}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{error}</p>}
        {successMsg && <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{successMsg}</p>}

        {/* TAB 1: SECTIONS & SCHEDULE MANAGEMENT */}
        {activeTab === "sections" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CREATE CLASS SECTION & SUBJECT */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-indigo-400">📚 Create Section & Subject</h2>
                <form onSubmit={handleCreateSection} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Section (e.g., A-1 / BIT-Elect 2-A)</label>
                      <input
                        type="text"
                        placeholder="e.g. A-1"
                        required
                        value={sectionForm.name}
                        onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Subject (e.g., Electrical)</label>
                      <input
                        type="text"
                        placeholder="e.g. MUSIC"
                        required
                        value={sectionForm.subject}
                        onChange={(e) => setSectionForm({ ...sectionForm, subject: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Initial Room</label>
                      <input
                        type="text"
                        placeholder="e.g. Room 222"
                        required
                        value={sectionForm.room}
                        onChange={(e) => setSectionForm({ ...sectionForm, room: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Initial Scheduled Date</label>
                      <input
                        type="date"
                        required
                        value={sectionForm.date}
                        onChange={(e) => setSectionForm({ ...sectionForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.startTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, startTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Cutoff</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.absentCutoffTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, absentCutoffTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.endTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, endTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 bg-[#131b2e] p-3 rounded-xl border border-slate-700">
                    <input
                      type="checkbox"
                      id="sectionApprovalToggle"
                      checked={sectionForm.requireTeacherApproval}
                      onChange={(e) => setSectionForm({ ...sectionForm, requireTeacherApproval: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                    <label htmlFor="sectionApprovalToggle" className="text-xs font-bold text-slate-200 cursor-pointer">
                      Require Teacher Approval for Remote Attendance
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition cursor-pointer"
                  >
                    {loading ? "Creating..." : "Create Section & Subject"}
                  </button>
                </form>
              </div>

              {/* ENROLL STUDENT */}
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-emerald-400">👤 Enroll Student</h2>
                <form onSubmit={handleCreateStudent} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Select Section & Subject</label>
                    <select
                      value={studentForm.sectionId}
                      onChange={(e) => setStudentForm({ ...studentForm, sectionId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500 font-bold text-emerald-300"
                      required
                    >
                      {sections.length === 0 ? (
                        <option value="">Create a section first</option>
                      ) : (
                        sections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            Section: {sec.name} {sec.subject ? `— Subject: ${sec.subject}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      required
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Username"
                      required
                      value={studentForm.username}
                      onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="relative">
                    <input
                      type={showStudentPassword ? "text" : "password"}
                      placeholder="Password (min 8 chars)"
                      required
                      minLength={8}
                      value={studentForm.password}
                      onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(!showStudentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Student Reference Photo (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || sections.length === 0}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition cursor-pointer"
                  >
                    {loading ? "Enrolling..." : "Enroll Student"}
                  </button>
                </form>
              </div>
            </div>

            {/* SECTIONS LIST WITH VERIFICATION TOGGLE & DELETE SECTION BUTTON */}
            <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-200">📋 Class Sections & Teacher Approval Toggles</h2>
              {sections.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">No sections found.</p>
              ) : (
                <div className="space-y-4">
                  {sections.map((sec) => {
                    const isExpanded = expandedSections[sec.id] || false;
                    const isAddingToThis = addingScheduleSectionId === sec.id;

                    return (
                      <div key={sec.id} className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-slate-800 pb-3">
                          <div
                            onClick={() => toggleSectionDetails(sec.id)}
                            className="cursor-pointer hover:opacity-80 transition select-none flex-1"
                          >
                            <h3 className="font-semibold text-sm text-indigo-300 flex flex-wrap items-center gap-2">
                              <span>📚 Section: <strong className="text-white">{sec.name}</strong> {sec.subject ? `• Subject: ${sec.subject}` : ""}</span>
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                                📑 {sec.schedules?.length || 0} Schedule Logs
                              </span>
                            </h3>
                            <span className="text-xs text-slate-400 block mt-1">
                              Enrolled Students: <strong className="text-slate-200">{sec.students.length}</strong> | Latest Room: <strong className="text-amber-300">{sec.room || "None"}</strong>
                            </span>
                          </div>

                          {/* TEACHER APPROVAL TOGGLE (ON / OFF) */}
                          <div className="flex items-center gap-3 bg-[#070b14] border border-slate-800 px-3 py-1.5 rounded-xl">
                            <div className="text-[11px]">
                              <span className="font-bold text-slate-200 block">Approval Mode</span>
                              <span className={`text-[10px] ${sec.requireTeacherApproval ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                                {sec.requireTeacherApproval ? 'ON (Strict)' : 'OFF (Auto)'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleApproval(sec.id, Boolean(sec.requireTeacherApproval))}
                              className="text-indigo-400 hover:scale-105 transition cursor-pointer"
                            >
                              {sec.requireTeacherApproval ? (
                                <ToggleRight size={28} className="text-emerald-400" />
                              ) : (
                                <ToggleLeft size={28} className="text-slate-500" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => startAddingSchedule(e, sec)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                            >
                              ➕ Add Date
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(sec.id, sec.name, sec.subject)}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                              title="Delete Section"
                            >
                              🗑️ Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSectionDetails(sec.id)}
                              className="text-slate-400 text-xs ml-1 cursor-pointer"
                            >
                              {isExpanded ? "▲ Hide" : "▼ Details"}
                            </button>
                          </div>
                        </div>

                        {/* ADD SCHEDULE MODAL FORM FOR THIS SECTION */}
                        {isAddingToThis && (
                          <form onSubmit={(e) => handleAddScheduleLog(e, sec.id)} className="bg-[#070b14] border border-emerald-500/40 rounded-xl p-4 space-y-3">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Add New Scheduled Date & Room Log for {sec.name}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] text-slate-400 block mb-1">Date</label>
                                <input
                                  type="date"
                                  required
                                  value={newScheduleForm.date}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, date: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block mb-1">Room / Venue</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Room 402"
                                  required
                                  value={newScheduleForm.room}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, room: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[11px] text-slate-400 block mb-1">Start Time</label>
                                <input
                                  type="time"
                                  required
                                  value={newScheduleForm.startTime}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, startTime: e.target.value })}
                                  className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block mb-1">Cutoff Time</label>
                                <input
                                  type="time"
                                  required
                                  value={newScheduleForm.absentCutoffTime}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, absentCutoffTime: e.target.value })}
                                  className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-slate-400 block mb-1">End Time</label>
                                <input
                                  type="time"
                                  required
                                  value={newScheduleForm.endTime}
                                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, endTime: e.target.value })}
                                  className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setAddingScheduleSectionId(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer"
                              >
                                Save Schedule Log
                              </button>
                            </div>
                          </form>
                        )}

                        {/* EXPANDED SECTION DETAILS (STUDENTS & SCHEDULES) */}
                        {isExpanded && (
                          <div className="space-y-4 pt-2">
                            {/* ENROLLED STUDENTS LIST */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Enrolled Students ({sec.students.length})</h4>
                              {sec.students.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">No students enrolled in this section yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {sec.students.map((st) => {
                                    const stats = getStudentStats(st.id, sec.id);
                                    const isStudentExpanded = expandedStudents[st.id] || false;

                                    return (
                                      <div key={st.id} className="bg-[#070b14] border border-slate-800 rounded-xl p-3 space-y-2">
                                        <div
                                          onClick={() => toggleStudentDetails(st.id)}
                                          className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 cursor-pointer hover:bg-slate-900/40 p-1.5 rounded-lg transition"
                                        >
                                          <div className="flex items-center gap-3">
                                            {st.photoUrl ? (
                                              <img src={st.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-700 pointer-events-none" />
                                            ) : (
                                              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 pointer-events-none">
                                                {st.name.charAt(0).toUpperCase()}
                                              </div>
                                            )}
                                            <div>
                                              <p className="text-xs font-bold text-white">{st.name}</p>
                                              <p className="text-[10px] text-slate-400">Username: <span className="text-indigo-400">@{st.username}</span></p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                                              Present: {stats.present}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                                              Late: {stats.late}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20">
                                              Absent: {stats.absent}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteStudent(st.id, st.name);
                                              }}
                                              className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                                            >
                                              🗑️ Remove
                                            </button>
                                            <span className="text-slate-500 text-[11px]">{isStudentExpanded ? "▲" : "▼"}</span>
                                          </div>
                                        </div>

                                        {/* STUDENT INDIVIDUAL ATTENDANCE RECORDS */}
                                        {isStudentExpanded && (
                                          <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                                            <p className="text-[11px] font-semibold text-slate-400 mb-1">Attendance History for {st.name}:</p>
                                            {records.filter((r) => r.studentId === st.id && r.sectionId === sec.id).length === 0 ? (
                                              <p className="text-[11px] text-slate-500 italic">No attendance records logged yet.</p>
                                            ) : (
                                              records
                                                .filter((r) => r.studentId === st.id && r.sectionId === sec.id)
                                                .map((rec) => (
                                                  <div key={rec.id} className="bg-[#131b2e] px-3 py-1.5 rounded-lg flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-300">
                                                      Type: <strong className="text-indigo-400">{rec.type}</strong> | Date: <strong className="text-slate-200">{rec.date}</strong> | Time: <strong className="text-emerald-400">{rec.time}</strong>
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded font-bold ${
                                                      rec.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300' :
                                                      rec.status === 'Late' ? 'bg-amber-500/20 text-amber-300' :
                                                      rec.status === 'Pending Approval' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' :
                                                      'bg-rose-500/20 text-rose-300'
                                                    }`}>
                                                      {rec.status}
                                                    </span>
                                                  </div>
                                                ))
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULE LOGS HISTORY */}
        {activeTab === "logs" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-semibold text-indigo-400">📅 Class Section Scheduled Logs History</h2>
                <p className="text-xs text-slate-400">Manage all scheduled dates, room assignments, and active cutoff times across your sections.</p>
              </div>
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition cursor-pointer"
              >
                Clear All Schedule Logs History
              </button>
            </div>

            {sections.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">No sections or schedule logs available.</p>
            ) : (
              <div className="space-y-4">
                {sections.map((sec) => (
                  <div key={sec.id} className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-sm text-indigo-300">
                        📚 Section: <strong className="text-white">{sec.name}</strong> {sec.subject ? `• Subject: ${sec.subject}` : ""}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => startAddingSchedule(e, sec)}
                        className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        ➕ Add Schedule Log
                      </button>
                    </div>

                    {sec.schedules && sec.schedules.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {sec.schedules.map((sch) => (
                          <div key={sch.id} className="bg-[#070b14] border border-slate-800 rounded-xl p-3 space-y-2 relative group">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-bold text-amber-300">📅 Date: {sch.date}</p>
                                <p className="text-xs text-slate-300">📍 Room: <strong className="text-white">{sch.room}</strong></p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteScheduleLog(sch.id)}
                                className="text-rose-400 hover:text-rose-300 text-xs bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20 transition cursor-pointer"
                                title="Delete Schedule Log"
                              >
                                🗑️
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                              <p>🕒 Start Time: <strong className="text-slate-200">{sch.startTime}</strong></p>
                              <p>⏰ Absent Cutoff: <strong className="text-amber-400">{sch.absentCutoffTime}</strong></p>
                              <p>🏁 End Time: <strong className="text-slate-200">{sch.endTime}</strong></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">No individual schedule logs added yet for this section.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ATTENDANCE APPROVALS (PENDING APPROVAL FROM HOME) */}
        {activeTab === "approvals" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-semibold text-indigo-400">✅ Pending Student Attendance Approvals</h2>
                <p className="text-xs text-slate-400">Review and approve or reject attendance submitted by students from home when approval mode is ON.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
                {pendingApprovalRecords.length} Pending
              </span>
            </div>

            {pendingApprovalRecords.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8 italic">No pending attendance requests to approve at this time.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Student ID / Name</th>
                      <th className="pb-3 font-semibold">Section</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Date & Time-Stamp</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pendingApprovalRecords.map((rec) => {
                      const sec = sections.find((s) => s.id === rec.sectionId);
                      const st = sec?.students?.find((s) => s.id === rec.studentId);

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 font-bold text-white flex items-center gap-2">
                            {st?.photoUrl ? (
                              <img src={st.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                                {st?.name ? st.name.charAt(0).toUpperCase() : 'S'}
                              </div>
                            )}
                            <div>
                              <span>{st?.name || rec.studentId}</span>
                              <span className="block text-[10px] text-slate-400">@{st?.username || 'unknown'}</span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-300">{sec?.name || 'Unknown Section'}</td>
                          <td className="py-3 font-semibold text-indigo-400">{rec.type}</td>
                          <td className="py-3">
                            <span className="text-slate-300 block">{rec.date}</span>
                            <span className="font-mono font-bold text-emerald-400">{rec.time}</span>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleApproveAttendance(rec.id, 'Present')}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveAttendance(rec.id, 'Absent')}
                              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer shadow"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ATTENDANCE QR CODE GENERATOR */}
        {activeTab === "qr" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4 max-w-xl mx-auto">
            <h2 className="text-base font-semibold text-indigo-400">📡 Generate Attendance QR Code</h2>
            <p className="text-xs text-slate-400">Generate a secure live QR code for students to scan when timing in or out.</p>

            <form onSubmit={handleGenerateQR} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Section & Subject</label>
                <select
                  value={qrSectionId}
                  onChange={(e) => setQrSectionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500 font-bold text-indigo-300"
                  required
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section: {sec.name} {sec.subject ? `— Subject: ${sec.subject}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Attendance Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQrType("In")}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      qrType === "In" ? "bg-indigo-600 text-white" : "bg-[#131b2e] text-slate-400 border border-slate-700"
                    }`}
                  >
                    Time In
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrType("Out")}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      qrType === "Out" ? "bg-indigo-600 text-white" : "bg-[#131b2e] text-slate-400 border border-slate-700"
                    }`}
                  >
                    Time Out
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={qrLoading || sections.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition cursor-pointer"
              >
                {qrLoading ? "Generating..." : `Generate QR Code for Time ${qrType}`}
              </button>
            </form>

            {generatedImageUrl && (
              <div className="mt-6 text-center bg-[#131b2e] border border-slate-800 p-5 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Live QR Code ready for scanning</h3>
                <div className="inline-block bg-white p-3 rounded-2xl shadow-xl">
                  <img src={generatedImageUrl} alt="Attendance QR Code" className="w-56 h-56 object-contain pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-400">Students can open their Student Portal and scan this code via camera or upload.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ATTENDANCE RECORDS */}
        {activeTab === "records" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-indigo-400">📊 Overall Attendance Records</h2>
            {records.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">No attendance logs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Student ID</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Time-Stamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 text-slate-300 font-mono">{rec.studentId}</td>
                        <td className="py-3 font-semibold text-indigo-400">{rec.type}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            rec.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            rec.status === 'Late' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            rec.status === 'Pending Approval' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">{rec.date}</td>
                        <td className="py-3 font-mono font-bold text-emerald-400">{rec.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}