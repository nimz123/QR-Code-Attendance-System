import React, { useState, useEffect } from 'react';
import { Section, AttendanceRecord, AuthUser } from './types';
import TeacherDashboard from './components/TeacherDashboard';
import StudentPortal from './components/StudentPortal';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import StudentAttendanceHistory from './components/StudentAttendanceHistory';
import { apiFetch } from './lib/api';
import {
  School,
  Lock,
  Unlock,
  User,
  Clock,
  Sparkles,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewName = 'checkin' | 'login' | 'admin' | 'teacher' | 'my-attendance';

function roleView(role: AuthUser['role']): ViewName {
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'teacher';
  return 'my-attendance';
}

export default function App() {
  // Publicly-visible sections for the anonymous check-in flow (all teachers)
  const [sections, setSections] = useState<Section[]>([]);

  // Teacher-scoped data, only populated while logged in as a teacher
  const [teacherSections, setTeacherSections] = useState<Section[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<AttendanceRecord[]>([]);

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewName>('checkin');

  // Pre-selected section from QR code query parameter
  const [preselectedSectionId, setPreselectedSectionId] = useState<string | null>(null);

  // Teacher "Configure Profile" modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherPhoto, setNewTeacherPhoto] = useState('');
  const [newTeacherRoom, setNewTeacherRoom] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Live clock display state
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchPublicState = async () => {
    const { ok, data } = await apiFetch('/api/state/public');
    if (ok && data.success) setSections(data.sections);
  };

  const fetchTeacherState = async () => {
    const { ok, data } = await apiFetch('/api/state/teacher');
    if (ok && data.success) {
      setTeacherSections(data.sections);
      setTeacherRecords(data.records);
    }
  };

  // On mount: restore session, load public check-in data, parse QR params
  useEffect(() => {
    apiFetch('/api/auth/me').then(({ data }) => {
      if (data.success) {
        setAuthUser(data.user);
        setCurrentView(roleView(data.user.role));
      }
    });

    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('sectionId');
    if (sectionParam) setPreselectedSectionId(sectionParam);
  }, []);

  // Poll the public check-in roster every 5 seconds
  useEffect(() => {
    fetchPublicState();
    const interval = setInterval(fetchPublicState, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll the teacher's own scoped data while logged in as a teacher
  useEffect(() => {
    if (authUser?.role !== 'teacher') return;
    fetchTeacherState();
    const interval = setInterval(fetchTeacherState, 5000);
    return () => clearInterval(interval);
  }, [authUser]);

  // If the session is lost while on a protected view, fall back to check-in
  useEffect(() => {
    if (!authUser && currentView !== 'checkin' && currentView !== 'login') {
      setCurrentView('checkin');
    }
  }, [authUser, currentView]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setCurrentView(roleView(user.role));
  };

  const handleLogOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthUser(null);
    setTeacherSections([]);
    setTeacherRecords([]);
    setCurrentView('checkin');
  };

  // Core functions called by Teacher Dashboard (all teacher-scoped, server derives ownership from the session)
  const handleAddSection = async (name: string, startTime: string) => {
    const { ok, data } = await apiFetch('/api/sections', {
      method: 'POST',
      body: JSON.stringify({ name, startTime }),
    });
    if (ok) setTeacherSections(prev => [...prev, data.section]);
  };

  const handleDeleteSection = async (id: string) => {
    await apiFetch(`/api/sections/${id}`, { method: 'DELETE' });
    setTeacherSections(prev => prev.filter(s => s.id !== id));
    setTeacherRecords(prev => prev.filter(r => r.sectionId !== id));
  };

  const handleUpdateSectionTime = async (sectionId: string, startTime: string) => {
    const { ok, data } = await apiFetch(`/api/sections/${sectionId}`, {
      method: 'PUT',
      body: JSON.stringify({ startTime }),
    });
    if (ok) setTeacherSections(prev => prev.map(s => (s.id === sectionId ? data.section : s)));
  };

  const handleDeleteStudent = async (sectionId: string, studentId: string) => {
    await apiFetch(`/api/students/${studentId}`, { method: 'DELETE' });
    setTeacherSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, students: s.students.filter(st => st.id !== studentId) } : s))
    );
  };

  // Photo capture stays unauthenticated (kiosk check-in flow); used from both StudentPortal and TeacherDashboard
  const handleUpdateStudentPhoto = async (sectionId: string, studentId: string, photoUrl: string) => {
    await apiFetch('/api/student/photo', {
      method: 'POST',
      body: JSON.stringify({ studentId, photoUrl }),
    });
    const patch = (list: Section[]) =>
      list.map(s =>
        s.id === sectionId
          ? { ...s, students: s.students.map(st => (st.id === studentId ? { ...st, photoUrl } : st)) }
          : s
      );
    setSections(patch);
    setTeacherSections(patch);
  };

  const handleClearRecords = async () => {
    await apiFetch('/api/records/clear', { method: 'POST' });
    setTeacherRecords([]);
  };

  // Student Attendance Submission logic (compares arrival time to section startTime); stays unauthenticated
  const handleSubmitAttendance = async (
    studentId: string,
    studentName: string,
    sectionId: string,
    sectionName: string,
    date: string,
    time: string,
    type?: 'In' | 'Out'
  ): Promise<{ status: 'Present' | 'Late' | 'Time Out'; startTime: string }> => {
    const section = sections.find(s => s.id === sectionId);
    const startTime = section?.startTime || '08:00';

    let status: 'Present' | 'Late' | 'Time Out' = 'Present';
    if (type === 'Out') {
      status = 'Time Out';
    } else {
      const [arrHours, arrMins] = time.split(':').map(Number);
      const [startHours, startMins] = startTime.split(':').map(Number);
      status = arrHours * 60 + arrMins > startHours * 60 + startMins ? 'Late' : 'Present';
    }

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      studentId,
      studentName,
      sectionId,
      sectionName,
      date,
      time,
      status,
      type,
      timestamp: new Date().toISOString(),
    };

    try {
      await apiFetch('/api/records/add', { method: 'POST', body: JSON.stringify(newRecord) });
    } catch (e) {
      console.error(e);
    }

    return { status, startTime };
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPassword = newPassword.trim();
    if (trimmedPassword && trimmedPassword.length < 4) {
      alert('Password must be at least 4 characters if you wish to change it.');
      return;
    }

    const { ok, data } = await apiFetch('/api/teacher/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: newTeacherName.trim(),
        photo: newTeacherPhoto,
        room: newTeacherRoom.trim(),
        subject: newTeacherSubject.trim(),
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      }),
    });

    if (ok) {
      setAuthUser(prev => (prev && prev.role === 'teacher' ? { ...prev, ...data.teacher } : prev));
      setIsSettingsOpen(false);
      setNewPassword('');
    } else {
      alert(data.error || 'Failed to save profile.');
    }
  };

  const isTeacher = authUser?.role === 'teacher';
  const isStudent = authUser?.role === 'student';

  return (
    <div id="app-root-container" className="min-h-screen bg-gray-50/70 text-gray-800 font-sans flex flex-col antialiased">

      {/* 1. APP NAVBAR HEADER */}
      <header id="app-navbar" className="bg-white border-b border-gray-100 py-4 px-4 sm:px-6 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-xs">
              <School size={22} className="stroke-2" />
            </div>
            <div>
              <span className="font-display font-black text-lg text-gray-900 tracking-tight block"></span>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-gray-400 font-mono tracking-wider font-semibold uppercase">System Live</span>
                </div>
                {(isTeacher || isStudent) && (
                  <>
                    <span className="text-gray-300 text-[10px] hidden sm:inline">•</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                      {isTeacher && authUser && 'photo' in authUser && authUser.photo && (
                        <img
                          src={authUser.photo}
                          alt={authUser.name}
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-full object-cover border border-indigo-200"
                        />
                      )}
                      {isTeacher ? `Teacher: ${(authUser as any).name}` : `Student: ${(authUser as any).name}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clock Widget */}
          <div id="live-clock-widget" className="hidden md:flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-1.5 text-xs text-gray-500 font-mono font-medium shadow-xs">
            <Clock size={14} className="text-indigo-600 animate-pulse" />
            <span>Classroom Clock:</span>
            <strong className="text-gray-900">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </strong>
          </div>

          {/* Nav Actions / View Switcher Toggle */}
          <div className="flex items-center gap-2.5 bg-gray-100 p-1 rounded-2xl border border-gray-200">

            <button
              id="switch-to-checkin-btn"
              onClick={() => setCurrentView('checkin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                currentView === 'checkin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <User size={14} />
              <span>Check-In</span>
            </button>

            <button
              id="switch-to-dashboard-btn"
              onClick={() => setCurrentView(authUser ? roleView(authUser.role) : 'login')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                currentView !== 'checkin'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-indigo-600'
              }`}
            >
              {authUser ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{authUser ? (isTeacher ? 'Teacher Dashboard' : isStudent ? 'My Attendance' : 'Admin Dashboard') : 'Sign In'}</span>
            </button>

          </div>

        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main id="app-main-workspace" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

        <AnimatePresence mode="wait">
          {currentView === 'checkin' && (
            <motion.div key="checkin-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
              <StudentPortal
                sections={sections}
                preselectedSectionId={preselectedSectionId}
                onSubmitAttendance={handleSubmitAttendance}
                onUpdateStudentPhoto={handleUpdateStudentPhoto}
                onGoToLogin={() => setCurrentView('login')}
              />
            </motion.div>
          )}

          {currentView === 'login' && (
            <motion.div key="login-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
              <LoginPage onLoginSuccess={handleLoginSuccess} onBackToCheckin={() => setCurrentView('checkin')} />
            </motion.div>
          )}

          {currentView === 'admin' && authUser?.role === 'admin' && (
            <motion.div key="admin-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
              <AdminDashboard onLogOut={handleLogOut} />
            </motion.div>
          )}

          {currentView === 'my-attendance' && authUser?.role === 'student' && (
            <motion.div key="student-history-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
              <StudentAttendanceHistory studentName={authUser.name} onLogOut={handleLogOut} />
            </motion.div>
          )}

          {currentView === 'teacher' && authUser?.role === 'teacher' && (
            <motion.div key="teacher-dashboard-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }} className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Sparkles size={10} />
                    <span>Instructor Access</span>
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 tracking-tight mt-1">Teacher Dashboard</h1>
                </div>

                <button
                  id="btn-settings-pin"
                  onClick={() => {
                    setNewTeacherName(authUser.name);
                    setNewTeacherPhoto(authUser.photo || '');
                    setNewTeacherRoom(authUser.room || '');
                    setNewTeacherSubject(authUser.subject || '');
                    setNewPassword('');
                    setIsSettingsOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Settings size={14} />
                  <span>Configure Profile</span>
                </button>
              </div>

              <TeacherDashboard
                sections={teacherSections}
                records={teacherRecords}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onDeleteStudent={handleDeleteStudent}
                onUpdateSectionTime={handleUpdateSectionTime}
                onClearRecords={handleClearRecords}
                onUpdateStudentPhoto={handleUpdateStudentPhoto}
                onLogOut={handleLogOut}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 3. SETTINGS CHANGE PROFILE MODAL (teacher only) */}
      <AnimatePresence>
        {isSettingsOpen && authUser?.role === 'teacher' && (
          <div id="settings-modal-overlay" className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-base font-bold text-gray-900">Configure Profile & Security</h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Settings</span>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="settings-teacher-name" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Teacher Name / Title</label>
                  <input
                    id="settings-teacher-name"
                    type="text"
                    required
                    placeholder="Mr. Smith"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-gray-400">This name appears on the student portal and report receipts.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Teacher Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {newTeacherPhoto ? (
                        <img
                          src={newTeacherPhoto}
                          alt="Teacher Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400 font-bold text-xs uppercase text-center font-mono p-1">No Pic</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 font-semibold text-[11px] px-3 py-1.5 rounded-lg transition text-center shadow-2xs">
                        <span>Upload Photo</span>
                        <input
                          id="settings-teacher-photo-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                alert('File is too large. Max size is 2MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                  setNewTeacherPhoto(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {newTeacherPhoto && (
                        <button
                          id="btn-remove-teacher-photo"
                          type="button"
                          onClick={() => setNewTeacherPhoto('')}
                          className="text-rose-600 hover:text-rose-800 font-bold text-[10px] uppercase text-left tracking-wider"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-teacher-room" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">ROOM (Optional)</label>
                  <input
                    id="settings-teacher-room"
                    type="text"
                    placeholder="Room 101, Science Lab"
                    value={newTeacherRoom}
                    onChange={(e) => setNewTeacherRoom(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-teacher-subject" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">SUBJECT (Optional)</label>
                  <input
                    id="settings-teacher-subject"
                    type="text"
                    placeholder="Mathematics, Science"
                    value={newTeacherSubject}
                    onChange={(e) => setNewTeacherSubject(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="settings-new-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Change Security Password (Optional)</label>
                  <input
                    id="settings-new-password"
                    type="password"
                    minLength={4}
                    placeholder="Leave blank to keep existing"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-gray-400">At least 4 characters. This password restricts entry to reports and class customization.</p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    id="btn-cancel-settings"
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-save-settings"
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. APP FOOTER */}
      <footer id="app-footer" className="bg-white border-t border-gray-100 py-6 px-4 mt-12 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto space-y-1.5">
          <p className="font-semibold text-gray-500">QR Attendance Portal — Secure School Management</p>
          <p>Developed by Nimrold Albaracin for students to log student arrival punctuality.</p>
        </div>
      </footer>

    </div>
  );
}
