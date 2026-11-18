import React, { useState, useEffect } from 'react';
import { Users, BookOpen, ShieldCheck, AlertCircle, Search, RefreshCw, UserPlus, CheckCircle, CheckCircle2, XCircle, X, ChevronDown, ChevronUp, LogOut, Trash2, Eye, EyeOff, Calendar, FileText, Wifi, WifiOff } from 'lucide-react';
import { apiFetch } from '../services/api'; 

interface Student {
  id: string;
  name: string;
  username: string;
  isVerified: boolean;
  photoUrl?: string;
  records?: any[];
  sectionName?: string;
}

interface Section {
  id: string;
  name: string;
  subject?: string;
  room?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string; // Date when the section was created/updated
  date?: string; // Specific date for today's classes if applicable
  students?: Student[];
}

interface Teacher {
  id: number | string;
  name: string;
  username: string;
  email: string;
  room?: string;
  subject?: string;
  sections: Section[];
  logs?: any[];
}

interface AdminDashboardProps {
  onLogout?: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  // Main tab state: 'teachers' or 'students'
  const [activeMainTab, setActiveMainTab] = useState<"teachers" | "students">("teachers");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Register Teacher Modal States
  const [showAddTeacherModal, setShowAddTeacherModal] = useState<boolean>(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherUsername, setTeacherUsername] = useState<string>('');
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [showTeacherPassword, setShowTeacherPassword] = useState<boolean>(false);
  const [teacherSubject, setTeacherSubject] = useState<string>('');
  const [teacherRoom, setTeacherRoom] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);

  // Fetch teachers, sections, and students data from backend API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await apiFetch('/api/admin/teachers');
      
      if (res.ok && res.data.success) {
        const fetchedTeachers = res.data.teachers || [];
        setTeachers(fetchedTeachers);
        
        const studentMap = new Map<string, Student>();
        fetchedTeachers.forEach((t: Teacher) => {
          (t.sections || []).forEach((sec: Section) => {
            (sec.students || []).forEach((st: Student) => {
              if (st && st.id) {
                studentMap.set(st.id, { ...st, sectionName: `${sec.name} (${sec.subject || t.subject || 'General'})` });
              }
            });
          });
        });
        setAllStudents(Array.from(studentMap.values()));
      } else {
        const pubRes = await apiFetch('/api/state/public');
        if (pubRes.ok && pubRes.data.success) {
          const fetchedTeachers = pubRes.data.teachers || [];
          setTeachers(fetchedTeachers);
          const studentMap = new Map<string, Student>();
          fetchedTeachers.forEach((t: Teacher) => {
            (t.sections || []).forEach((sec: Section) => {
              (sec.students || []).forEach((st: Student) => {
                if (st && st.id) studentMap.set(st.id, { ...st, sectionName: `${sec.name} (${sec.subject || t.subject || 'General'})` });
              });
            });
          });
          setAllStudents(Array.from(studentMap.values()));
        } else {
          setError(res.data.error || 'Failed to fetch dashboard data');
        }
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle admin logout action
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
  };

  // Delete teacher record
  const handleDeleteTeacher = async (teacherId: string | number, teacherName: string) => {
    if (window.confirm(`Are you sure you want to delete teacher ${teacherName}? This action cannot be undone.`)) {
      try {
        setError(null);
        const res = await apiFetch(`/api/admin/teachers/${teacherId}`, {
          method: 'DELETE',
        });
        
        if (res.ok && (res.data.success !== false)) {
          setTeachers(teachers.filter(t => t.id !== teacherId));
          if (selectedTeacher?.id === teacherId) {
            setSelectedTeacher(null);
            setSelectedSection(null);
          }
          setSuccessMsg(`Teacher ${teacherName} deleted successfully!`);
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setError(res.data.error || 'Failed to delete teacher.');
        }
      } catch (err) {
        console.error('Error deleting teacher:', err);
        setError('Error connecting to server while deleting teacher.');
      }
    }
  };

  // Register new teacher
  const handleRegisterTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherUsername || !teacherPassword) {
      setError('Please fill in all required teacher fields.');
      return;
    }

    try {
      setRegistering(true);
      setError(null);
      
      const res = await apiFetch('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          name: teacherName,
          username: teacherUsername,
          email: teacherEmail || `${teacherUsername}@school.edu`,
          password: teacherPassword,
          subject: teacherSubject,
          room: teacherRoom
        })
      });

      if (res.ok && res.data.success) {
        setSuccessMsg('Teacher registered successfully!');
        setShowAddTeacherModal(false);
        setTeacherName('');
        setTeacherUsername('');
        setTeacherEmail('');
        setTeacherPassword('');
        setTeacherSubject('');
        setTeacherRoom('');
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(res.data.error || 'Failed to register teacher');
      }
    } catch (err) {
      console.error('Error registering teacher:', err);
      setError('Server error while registering teacher.');
    } finally {
      setRegistering(false);
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.name?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.username?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.subject?.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const filteredStudents = allStudents.filter(st =>
    st.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    st.username?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 p-6 font-sans select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0d1322] border border-slate-800 p-6 rounded-2xl shadow-lg gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 tracking-wide">
              <ShieldCheck className="text-indigo-400" /> Admin Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">Manage college instructors, monitor real-time online/absent status within the day, and inspect student logs.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAddTeacherModal(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition font-medium text-xs shadow-md cursor-pointer"
            >
              <UserPlus size={16} /> Register Teacher
            </button>
            <button 
              onClick={fetchData} 
              className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] text-indigo-300 rounded-xl hover:bg-[#1a233a] transition font-medium text-xs border border-slate-700 cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition font-medium text-xs border border-rose-500/20 cursor-pointer"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => { setActiveMainTab("teachers"); setSelectedStudent(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeMainTab === "teachers" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                : "bg-[#0d1322] text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <BookOpen size={16} /> Teachers &amp; Multi-Subject Sections ({teachers.length})
          </button>
          <button
            onClick={() => { setActiveMainTab("students"); setSelectedTeacher(null); setSelectedSection(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeMainTab === "students" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                : "bg-[#0d1322] text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users size={16} /> Students &amp; Attendance Logs ({allStudents.length})
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-950/80 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between text-emerald-200 text-xs">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-400" size={16} />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 font-bold cursor-pointer">Dismiss</button>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border-l-4 border-rose-500 p-4 rounded-xl flex items-center justify-between text-rose-200 text-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-rose-400" size={16} />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 font-bold cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* SECTION 1: TEACHERS & SUBJECTS TAB */}
        {activeMainTab === "teachers" && (
          <div className="space-y-4">
            <div className="bg-[#0d1322] border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-md">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search teachers by name, username, or subject..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-400"
                />
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Teachers List Column */}
              <div className="lg:col-span-1 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-400" /> Instructors List
                </h2>

                {loading ? (
                  <div className="text-center py-12 text-slate-500 text-xs">Loading teachers...</div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No teachers found matching your search.</div>
                ) : (
                  <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                    {filteredTeachers.map((teacher) => {
                      const isSelectedTeacher = selectedTeacher?.id === teacher.id;
                      
                      // Check if the teacher has active sections created/logged TODAY (within the day)
                      const todayStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
                      const hasSectionsToday = (teacher.sections || []).some((sec: Section) => {
                        if (!sec.createdAt && !sec.date) return true; // Fallback if timestamp missing but sections exist
                        const secDate = (sec.createdAt || sec.date || '').split('T')[0];
                        return secDate === todayStr || sec.sections?.length !== 0;
                      });

                      const isOnlineToday = teacher.sections && teacher.sections.length > 0 && hasSectionsToday;

                      return (
                        <div
                          key={teacher.id}
                          onClick={() => {
                            // Toggle/deselect if clicking the already selected teacher, otherwise select them
                            if (selectedTeacher?.id === teacher.id) {
                              setSelectedTeacher(null);
                              setSelectedSection(null);
                            } else {
                              setSelectedTeacher(teacher);
                              setSelectedSection(null);
                            }
                          }}
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelectedTeacher
                              ? "bg-indigo-600/20 border-indigo-500 shadow-md"
                              : "bg-[#131b2e] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-indigo-300 text-sm">
                                {teacher.name ? teacher.name.charAt(0).toUpperCase() : "T"}
                              </div>
                              {/* Online / Offline status indicator dot badge for today */}
                              <span 
                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#131b2e] ${
                                  isOnlineToday ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                }`} 
                                title={isOnlineToday ? 'Online Today (Active Sections Created)' : 'Offline / Absent Today (No Sections Created)'}
                              />
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                <span>{teacher.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">@{teacher.username} • {teacher.sections?.length || 0} sections</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Today's status badge */}
                            {isOnlineToday ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <Wifi size={10} /> Online
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <WifiOff size={10} /> Absent
                              </span>
                            )}

                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(teacher.id, teacher.name); }}
                              title="Delete Teacher"
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sections & Subjects Column */}
              <div className="lg:col-span-2 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-lg space-y-4">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" /> 
                  {selectedTeacher ? `Sections & Subjects for "${selectedTeacher.name}"` : 'Select a Teacher to View Sections & Subjects'}
                </h2>

                {!selectedTeacher ? (
                  <div className="text-center py-28 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-[#131b2e]/30 text-xs">
                    <BookOpen size={40} className="mx-auto text-slate-600 mb-2" />
                    <p className="font-medium text-slate-400">No teacher selected.</p>
                    <p className="text-[11px] text-slate-600 mt-1">Click on any teacher on the left to inspect their multi-subject sections and students.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const hasSectionsToday = (selectedTeacher.sections || []).some((sec: Section) => {
                        if (!sec.createdAt && !sec.date) return true;
                        const secDate = (sec.createdAt || sec.date || '').split('T')[0];
                        return secDate === todayStr || sec.sections?.length !== 0;
                      });
                      const isOnlineToday = selectedTeacher.sections && selectedTeacher.sections.length > 0 && hasSectionsToday;

                      return (
                        <>
                          {/* Teacher Details Header with dynamic handled count and today's online/absent status */}
                          <div className="bg-[#131b2e] border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-white">{selectedTeacher.name}</h3>
                                {isOnlineToday ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <Wifi size={10} /> Online 
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                    <WifiOff size={10} /> Offline
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Email: {selectedTeacher.email} • Handled {selectedTeacher.sections?.length || 0} Section{(selectedTeacher.sections?.length || 0) > 1 ? 's' : ''} &amp; Subject{(selectedTeacher.sections?.length || 0) > 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Active Instructor
                            </span>
                          </div>

                          {/* Assigned Sections Cards */}
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-400">Assigned Sections &amp; Subjects (Click to view enrolled students)</div>
                            {(!selectedTeacher.sections || selectedTeacher.sections.length === 0) ? (
                              <div className="text-xs text-rose-400 italic p-3 bg-rose-950/20 rounded-xl border border-rose-500/30 flex items-center gap-2">
                                <AlertCircle size={16} /> This teacher has not created any sections or subjects for today (Marked as Absent / Offline).
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {selectedTeacher.sections.map((sec) => {
                                  const isSelectedSec = selectedSection?.id === sec.id;
                                  const sectionSubjectName = sec.subject || selectedTeacher.subject || 'General Subject';
                                  return (
                                    <div
                                      key={sec.id}
                                      onClick={() => setSelectedSection(sec)}
                                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                        isSelectedSec
                                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                                          : "bg-[#131b2e] text-slate-200 border-slate-800 hover:border-slate-700"
                                      }`}
                                    >
                                      <div>
                                        <div className="font-extrabold text-xs uppercase text-white flex items-center gap-1.5">
                                          <span>Section: {sec.name}</span>
                                        </div>
                                        <div className={`text-[11px] font-bold mt-0.5 ${isSelectedSec ? "text-indigo-200" : "text-indigo-400"}`}>
                                          📚 Subject: {sectionSubjectName}
                                        </div>
                                        <div className={`text-[10px] mt-1 ${isSelectedSec ? "text-slate-200" : "text-slate-400"}`}>
                                          🕒 {sec.startTime || "08:00"} - {sec.endTime || "17:00"} {sec.room ? `• Room: ${sec.room}` : ''}
                                        </div>
                                      </div>
                                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 ${
                                        isSelectedSec ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-300 border border-slate-700"
                                      }`}>
                                        {sec.students?.length || 0} students
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Students List in Selected Section */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="text-xs font-semibold text-slate-400">
                        {selectedSection ? `Students Enrolled in Section "${selectedSection.name}" (${selectedSection.subject || selectedTeacher.subject || 'Subject'})` : 'Select a section/subject above to view enrolled students'}
                      </div>

                      {!selectedSection ? (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-[#131b2e]/30 text-xs">
                          Please click one of the teacher's sections/subjects above to list the enrolled students.
                        </div>
                      ) : (!selectedSection.students || selectedSection.students.length === 0) ? (
                        <div className="text-center py-10 text-slate-500 bg-[#131b2e] rounded-xl border border-slate-800 text-xs">
                          No students enrolled in this section and subject.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {selectedSection.students.map((stu) => (
                            <div key={stu.id} className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {stu.photoUrl ? (
                                  <img src={stu.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-indigo-300 text-xs">
                                    {stu.name ? stu.name.charAt(0).toUpperCase() : "S"}
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-bold text-white">{stu.name}</div>
                                  <div className="text-[10px] text-slate-400">@{stu.username}</div>
                                </div>
                              </div>
                              <div>
                                {stu.isVerified ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    ✅ Fully Verified
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    ⏳ Pending Verification
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: STUDENTS & ATTENDANCE LOGS TAB */}
        {activeMainTab === "students" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" /> Students Directory
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search student..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#131b2e] border border-slate-700 text-white rounded-xl text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-400"
                />
              </div>

              {allStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No students found in the system.</div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No student matches search.</div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredStudents.map((stu) => {
                    const isSelectedStu = selectedStudent?.id === stu.id;
                    return (
                      <div
                        key={stu.id}
                        onClick={() => {
                          // Toggle/deselect if clicking the already selected student, otherwise select them
                          if (selectedStudent?.id === stu.id) {
                            setSelectedStudent(null);
                          } else {
                            setSelectedStudent(stu);
                          }
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isSelectedStu
                            ? "bg-indigo-600/20 border-indigo-500 shadow-md"
                            : "bg-[#131b2e] border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {stu.photoUrl ? (
                            <img src={stu.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-indigo-300 text-xs">
                              {stu.name ? stu.name.charAt(0).toUpperCase() : "S"}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-xs">{stu.name}</div>
                            <div className="text-[10px] text-slate-400">@{stu.username} • <span className="text-indigo-300">{stu.sectionName}</span></div>
                          </div>
                        </div>
                        <div>
                          {stu.isVerified || stu.photoUrl ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" title="Fully Verified"></span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Pending"></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Student Attendance Logs Column */}
            <div className="lg:col-span-2 bg-[#0d1322] border border-slate-800 p-6 rounded-2xl shadow-lg space-y-5">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" /> Student Verification Status &amp; Attendance Logs
              </h2>

              {!selectedStudent ? (
                <div className="text-center py-28 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-[#131b2e]/30 text-xs">
                  <Users size={40} className="mx-auto text-slate-600 mb-2" />
                  <p className="font-medium text-slate-400">No student selected.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Click on any student on the left to inspect their section, verification status, and logs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Student Header */}
                  <div className="bg-[#131b2e] border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {selectedStudent.photoUrl ? (
                        <img src={selectedStudent.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-500 flex items-center justify-center font-bold text-indigo-300 text-lg">
                          {selectedStudent.name ? selectedStudent.name.charAt(0).toUpperCase() : "S"}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-extrabold text-white">{selectedStudent.name}</h3>
                        <p className="text-xs text-slate-400">Username: @{selectedStudent.username} • Enrolled: <strong className="text-indigo-300">{selectedStudent.sectionName || "N/A"}</strong></p>
                      </div>
                    </div>

                    <div>
                      {selectedStudent.isVerified || selectedStudent.photoUrl ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle size={14} /> Fully Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                          <AlertCircle size={14} /> Pending Verification
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance History & Status Guardrail */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-400" /> Attendance History &amp; Status
                    </div>

                    {!selectedStudent.isVerified && !selectedStudent.photoUrl ? (
                      <div className="text-center py-12 text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs p-4">
                        <AlertCircle size={24} className="mx-auto mb-2 text-amber-400 animate-pulse" />
                        <strong>Pending Facial Verification:</strong> {selectedStudent.name} has not completed the one-time biometric facial registration yet. Attendance status (Present/Late/Absent) and detailed logs are locked until fully registered.
                      </div>
                    ) : (!selectedStudent.records || selectedStudent.records.length === 0) ? (
                      <div className="text-center py-16 text-slate-500 bg-[#131b2e] rounded-xl border border-slate-800 text-xs">
                        No attendance records logged for {selectedStudent.name} yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 bg-[#131b2e]">
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Time-Stamp</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {selectedStudent.records.map((rec: any, idx: number) => (
                              <tr key={idx} className="hover:bg-[#131b2e]/50">
                                <td className="py-2.5 px-3 font-bold text-indigo-300">Time {rec.type}</td>
                                <td className="py-2.5 px-3 text-slate-300">{rec.date || "N/A"}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{rec.time || "N/A"}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 w-fit ${
                                    rec.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    rec.status === 'Late' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                    rec.status === 'Pending Approval' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' :
                                    'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}>
                                    {rec.status === 'Present' && <CheckCircle2 size={12} className="text-emerald-400" />}
                                    {rec.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: REGISTER TEACHER */}
        {showAddTeacherModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus size={16} className="text-indigo-400" /> Register New Teacher Account
                </h3>
                <button onClick={() => setShowAddTeacherModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRegisterTeacher} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="e.g. Dr. Peter H. Calaurian"
                    className="w-full px-3 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    placeholder="e.g. peter"
                    className="w-full px-3 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    placeholder="e.g. peter@school.edu"
                    className="w-full px-3 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="relative">
                  <label className="text-slate-400 block mb-1">Password</label>
                  <input
                    type={showTeacherPassword ? "text" : "password"}
                    required
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                    className="absolute right-3 top-8 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showTeacherPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Default Subject</label>
                    <input
                      type="text"
                      value={teacherSubject}
                      onChange={(e) => setTeacherSubject(e.target.value)}
                      placeholder="e.g. Computer System"
                      className="w-full px-3 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Room</label>
                    <input
                      type="text"
                      value={teacherRoom}
                      onChange={(e) => setTeacherRoom(e.target.value)}
                      placeholder="e.g. Lab 3"
                      className="w-full px-3 py-2.5 bg-[#131b2e] border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddTeacherModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-md cursor-pointer"
                  >
                    {registering ? "Registering..." : "Register Teacher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}