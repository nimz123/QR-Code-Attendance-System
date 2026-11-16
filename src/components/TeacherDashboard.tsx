import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Student {
  id: string;
  name: string;
  username: string;
  photoUrl?: string;
  isVerified?: boolean;
  sectionId: string;
}

interface Section {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  absentCutoffTime: string;
  students: Student[];
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
  const [activeTab, setActiveTab] = useState<"sections" | "qr" | "records">("sections");
  const [sections, setSections] = useState<Section[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [expandedStudents, setExpandedStudents] = useState<{ [key: string]: boolean }>({});

  const [teacher, setTeacher] = useState({
    id: "",
    name: "",
    username: "",
    email: "",
    photoUrl: ""
  });
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  const [sectionForm, setSectionForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    absentCutoffTime: "08:30",
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
  const [generatedToken, setGeneratedToken] = useState("");
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

  const fetchTeacherData = async () => {
    try {
      const currentToken = getAuthToken();
      if (!currentToken) return;

      const profileRes = await fetch("http://localhost:5001/api/auth/me", {
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

      const res = await fetch("http://localhost:5001/api/state/teacher", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        const formattedSections = (data.sections || []).map((sec: any) => ({
          ...sec,
          students: sec.students || []
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
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setTeacher({
            id: parsed.id || "",
            name: parsed.name || "",
            username: parsed.username || "",
            email: parsed.email || "",
            photoUrl: parsed.photoUrl || ""
          });
        } catch (e) {}
      }
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
          await fetch("http://localhost:5001/api/teacher/profile", {
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
      const res = await fetch("http://localhost:5001/api/sections", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(sectionForm),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to create section.");
      } else {
        setSuccessMsg("Section created successfully!");
        setSectionForm({ name: "", startTime: "08:00", endTime: "17:00", absentCutoffTime: "08:30" });
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
      const res = await fetch("http://localhost:5001/api/teacher/students", {
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
      const res = await fetch(`http://localhost:5001/api/teacher/students/${studentId}`, {
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
    setGeneratedToken("");
    setGeneratedImageUrl("");
    setQrLoading(true);

    try {
      const res = await fetch("http://localhost:5001/api/attendance/qr-session", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ sectionId: qrSectionId, type: qrType }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to generate QR session.");
      } else {
        setGeneratedToken(data.qrToken);
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
              onClick={() => setActiveTab("qr")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition pointer-events-auto cursor-pointer ${
                activeTab === "qr" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📡 Attendance QR Code
            </button>
            <button
              onClick={() => setActiveTab("sections")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition pointer-events-auto cursor-pointer ${
                activeTab === "sections" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📚 Class List & Sections
            </button>
            <button
              onClick={() => setActiveTab("records")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition pointer-events-auto cursor-pointer ${
                activeTab === "records" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📊 Attendance Records
            </button>
          </nav>
        </div>

        <button
          onClick={triggerLogout}
          className="mt-6 w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-medium transition pointer-events-auto cursor-pointer"
        >
         Log Out
        </button>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        
        {/* TEACHER HEADER GREETING & FULL NAME / EMAIL */}
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

        {activeTab === "qr" && (
          <div className="max-w-xl mx-auto space-y-5 bg-[#0d1322] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-indigo-400">📡 Generate Attendance QR Session</h2>
            <form onSubmit={handleGenerateQR} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Section / Subject</label>
                <select
                  value={qrSectionId}
                  onChange={(e) => setQrSectionId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                  required
                >
                  {sections.length === 0 ? (
                    <option value="">Please create a section first</option>
                  ) : (
                    sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} ({sec.startTime} - {sec.endTime})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Attendance Type</label>
                <select
                  value={qrType}
                  onChange={(e) => setQrType(e.target.value as "In" | "Out")}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="In">Time In (Arrival)</option>
                  <option value="Out">Time Out (Departure)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={qrLoading || sections.length === 0}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition disabled:opacity-50 pointer-events-auto cursor-pointer"
              >
                {qrLoading ? "Generating..." : "Generate Active QR Code Image"}
              </button>
            </form>

            {generatedImageUrl && (
              <div className="mt-4 p-4 rounded-xl bg-[#131b2e] border border-emerald-500/30 text-center space-y-3">
                <p className="text-xs text-emerald-400 font-semibold">Active Unique QR Code Image:</p>
                <div className="flex justify-center p-3 bg-white rounded-xl w-56 h-56 mx-auto shadow-lg pointer-events-none">
                  <img src={generatedImageUrl} alt="Attendance QR Code" className="w-full h-full object-contain pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sections" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-indigo-400">📚 Create Class Section</h2>
                <form onSubmit={handleCreateSection} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Section Name / Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. BIT-ELECTRICAL 3-5"
                      required
                      value={sectionForm.name}
                      onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                    />
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
                      <label className="text-xs text-slate-400 block mb-1">Absent Cutoff</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.absentCutoffTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, absentCutoffTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">End Time (Out)</label>
                      <input
                        type="time"
                        required
                        value={sectionForm.endTime}
                        onChange={(e) => setSectionForm({ ...sectionForm, endTime: e.target.value })}
                        className="w-full px-2 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition cursor-pointer"
                  >
                    {loading ? "Creating..." : "Add Section"}
                  </button>
                </form>
              </div>

              <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-emerald-400">👤 Enroll Student</h2>
                <form onSubmit={handleCreateStudent} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Select Section</label>
                    <select
                      value={studentForm.sectionId}
                      onChange={(e) => setStudentForm({ ...studentForm, sectionId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#131b2e] border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                      required
                    >
                      {sections.length === 0 ? (
                        <option value="">Create a section first</option>
                      ) : (
                        sections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.name} ({sec.startTime} - {sec.endTime})
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

            {/* ENROLLED STUDENTS PER SECTION - CLICK SECTION OR STUDENT NAME TO SHOW/HIDE DETAILS */}
            <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-200">📋 Enrolled Students per Section (Click Section or Student Name to View/Hide Details)</h2>
              {sections.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-4">No sections found.</p>
              ) : (
                <div className="space-y-4">
                  {sections.map((sec) => {
                    const isExpanded = expandedSections[sec.id] || false;
                    return (
                      <div key={sec.id} className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-3">
                        {/* CLICKABLE SECTION HEADER */}
                        <div
                          onClick={() => toggleSectionDetails(sec.id)}
                          className="flex justify-between items-center border-b border-slate-800 pb-3 cursor-pointer hover:bg-slate-800/40 p-2 rounded-lg transition select-none"
                        >
                          <div>
                            <h3 className="font-semibold text-sm text-indigo-300 flex items-center gap-2">
                              <span>📚 {sec.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {isExpanded ? "(Hide section ▲)" : "(Click to show section ▼)"}
                              </span>
                            </h3>
                            <span className="text-xs text-slate-400">
                              Time In: {sec.startTime} | Cutoff: {sec.absentCutoffTime} | Time Out: {sec.endTime} ({sec.students.length} Students)
                            </span>
                          </div>
                        </div>

                        {/* EXPANDED SECTION DETAILS */}
                        {isExpanded && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Enrolled Students (Click Student Name to Toggle Details):</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {sec.students.length === 0 ? (
                                <p className="text-xs text-slate-500">No students enrolled yet in this section.</p>
                              ) : (
                                sec.students.map((stu) => {
                                  const stats = getStudentStats(stu.id, sec.id);
                                  const isStudentExpanded = expandedStudents[stu.id] || false;
                                  return (
                                    <div key={stu.id} className="bg-[#0d1322] p-3 rounded-xl border border-slate-800 space-y-3 shadow-inner">
                                      {/* CLICKABLE STUDENT HEADER (CLICK NAME TO TOGGLE DETAILS) */}
                                      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => toggleStudentDetails(stu.id)}>
                                        <div className="flex items-center gap-2.5">
                                          {stu.photoUrl ? (
                                            <img src={stu.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-700" />
                                          ) : (
                                            <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-300">
                                              {stu.name.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          <div>
                                            <span className="text-xs font-bold text-white hover:text-indigo-300 transition block flex items-center gap-1.5">
                                              {stu.name}
                                              <span className="text-[9px] text-slate-400 font-normal">
                                                {isStudentExpanded ? "(▲ hide)" : "(▼ details)"}
                                              </span>
                                            </span>
                                            <span className="text-[10px] text-slate-400">@{stu.username}</span>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation(); // prevent toggling student expansion when deleting
                                            handleDeleteStudent(stu.id, stu.name);
                                          }} 
                                          className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer p-1" 
                                          title="Delete Student"
                                        >
                                          🗑️
                                        </button>
                                      </div>

                                      {/* EXPANDED STUDENT DETAILS (Verification & Attendance Stats) */}
                                      {isStudentExpanded && (
                                        <div className="space-y-3 pt-2 border-t border-slate-800/80 animate-fadeIn">
                                          {/* Verification Status */}
                                          <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-400">Verification:</span>
                                            {stu.isVerified ? (
                                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">Fully Verified</span>
                                            ) : (
                                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-semibold">Not Verified</span>
                                            )}
                                          </div>

                                          {/* Attendance Stats (Present / Late / Absent) */}
                                          <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                                            <div className="bg-[#131b2e] p-1.5 rounded-lg border border-slate-800">
                                              <span className="block text-slate-400">Present</span>
                                              <span className="font-bold text-emerald-400 text-xs">{stats.present}</span>
                                            </div>
                                            <div className="bg-[#131b2e] p-1.5 rounded-lg border border-slate-800">
                                              <span className="block text-slate-400">Late</span>
                                              <span className="font-bold text-amber-400 text-xs">{stats.late}</span>
                                            </div>
                                            <div className="bg-[#131b2e] p-1.5 rounded-lg border border-slate-800">
                                              <span className="block text-slate-400">Absent</span>
                                              <span className="font-bold text-rose-400 text-xs">{stats.absent}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
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

        {activeTab === "records" && (
          <div className="bg-[#0d1322] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-200">📊 Attendance Logs & History</h2>
          </div>
        )}
      </div>
    </div>
  );
}