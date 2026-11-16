import React, { useState, useEffect } from 'react';
import AboutUs from './components/AboutUs';
import { Section, AttendanceRecord, AuthUser } from './types';
import TeacherDashboard from './components/TeacherDashboard';
import StudentPortal from './components/StudentPortal';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import StudentAttendanceHistory from './components/StudentAttendanceHistory';
import { apiFetch } from './lib/api';
import {
  Sun,
  Moon,
  School,
  Lock,
  Unlock,
  User,
  Clock,
  Settings,
  Eye,
  EyeOff,
  LoaderCircle,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewName =
  | 'checkin'
  | 'login'
  | 'admin'
  | 'teacher'
  | 'my-attendance'
  | 'about';

// Helper function to map user roles to their respective view names
function roleView(role: AuthUser['role']): ViewName {
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'teacher';
  return 'my-attendance';
}

// Dark Mode Toggle Component
function DarkModeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    const root = document.documentElement;

    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={() => setIsDarkMode((prev) => !prev)}
      className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle Theme"
    >
      {isDarkMode ? (
        <Sun
          size={18}
          className="text-amber-400 fill-amber-400 shrink-0 block"
        />
      ) : (
        <Moon
          size={18}
          className="text-slate-700 dark:text-slate-200 fill-slate-700 shrink-0 block"
        />
      )}
    </button>
  );
}

export default function App() {
  const [sections, setSections] = useState<Section[]>([]);
  const [teacherSections, setTeacherSections] = useState<Section[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<AttendanceRecord[]>([]);

  // Immediately initialize auth user from localStorage to prevent check-in flashing on reload
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const savedUser = localStorage.getItem('authUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  // Immediately initialize current view based on saved user role if available
  const [currentView, setCurrentView] = useState<ViewName>(() => {
    try {
      const savedUser = localStorage.getItem('authUser');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        return roleView(user.role);
      }
    } catch (e) {}
    return 'checkin';
  });

  const [preselectedSectionId, setPreselectedSectionId] =
    useState<string | null>(null);

  // Teacher security modal settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  // ===================== PUBLIC STATE =====================

  const fetchPublicState = async () => {
    try {
      const { ok, data } = await apiFetch('/api/state/public');

      if (ok && data.success) {
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Failed to load public state:', error);
    }
  };

  // ===================== TEACHER STATE =====================

  const fetchTeacherState = async () => {
    try {
      const { ok, data } = await apiFetch('/api/state/teacher');

      if (ok && data.success) {
        setTeacherSections(data.sections);
        setTeacherRecords(data.records);

        if (data.teacher) {
          setAuthUser((prev) => {
            if (!prev || prev.role !== 'teacher') return prev;

            return {
              ...prev,
              ...data.teacher,
              role: 'teacher',
            };
          });
        }
      }
    } catch (error) {
      console.error('Failed to load teacher state:', error);
    }
  };

  // ===================== INITIAL AUTHENTICATION & TOKEN VALIDATION =====================

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Verify token with backend server
        const { ok, data } = await apiFetch('/api/auth/me');

        if (!active || !ok || !data.success || !data.user) {
          return;
        }

        setAuthUser(data.user);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        setCurrentView(roleView(data.user.role));
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };

    initializeAuth();

    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('sectionId');

    if (sectionParam) {
      setPreselectedSectionId(sectionParam);
    }

    return () => {
      active = false;
    };
  }, []);

  // Fetch public states periodically
  useEffect(() => {
    fetchPublicState();
    const interval = window.setInterval(fetchPublicState, 5000);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch teacher states periodically if logged in as teacher
  useEffect(() => {
    if (authUser?.role !== 'teacher') return;

    fetchTeacherState();
    const interval = window.setInterval(fetchTeacherState, 5000);
    return () => window.clearInterval(interval);
  }, [authUser?.role]);

  // Live classroom clock update timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ===================== LOGIN / LOGOUT =====================

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setCurrentView(roleView(user.role));
  };

  const handleLogOut = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage session credentials
      localStorage.removeItem('authUser');
      localStorage.removeItem('token');
      localStorage.removeItem('teacher_username');

      setAuthUser(null);
      setTeacherSections([]);
      setTeacherRecords([]);
      setIsSettingsOpen(false);
      setNewPassword('');
      setNewTeacherUsername('');
      setShowPassword(false);

      setCurrentView('login');
    }
  };

  // ===================== SECTION MANAGEMENT =====================

  const handleAddSection = async (name: string, startTime: string) => {
    try {
      const { ok, data } = await apiFetch('/api/sections', {
        method: 'POST',
        body: JSON.stringify({ name, startTime }),
      });

      if (ok) {
        setTeacherSections((prev) => [...prev, data.section]);
      } else {
        alert(data.error || 'Failed to create section.');
      }
    } catch (error) {
      console.error('Add section error:', error);
      alert('Unable to create section. Please try again.');
    }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      const { ok, data } = await apiFetch(`/api/sections/${id}`, {
        method: 'DELETE',
      });

      if (!ok) {
        alert(data.error || 'Failed to delete section.');
        return;
      }

      setTeacherSections((prev) => prev.filter((s) => s.id !== id));
      setTeacherRecords((prev) =>
        prev.filter((record) => record.sectionId !== id)
      );
    } catch (error) {
      console.error('Delete section error:', error);
      alert('Unable to delete section.');
    }
  };

  const handleUpdateSectionTime = async (
    sectionId: string,
    startTime: string
  ) => {
    try {
      const { ok, data } = await apiFetch(`/api/sections/${sectionId}`, {
        method: 'PUT',
        body: JSON.stringify({ startTime }),
      });

      if (ok) {
        setTeacherSections((prev) =>
          prev.map((section) =>
            section.id === sectionId ? data.section : section
          )
        );
      } else {
        alert(data.error || 'Failed to update section time.');
      }
    } catch (error) {
      console.error('Update section time error:', error);
      alert('Unable to update section time.');
    }
  };

  // ===================== STUDENT MANAGEMENT =====================

  const handleDeleteStudent = async (
    sectionId: string,
    studentId: string
  ) => {
    try {
      const { ok, data } = await apiFetch(`/api/students/${studentId}`, {
        method: 'DELETE',
      });

      if (!ok) {
        alert(data.error || 'Failed to delete student.');
        return;
      }

      setTeacherSections((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                students: section.students.filter(
                  (student) => student.id !== studentId
                ),
              }
            : section
        )
      );
    } catch (error) {
      console.error('Delete student error:', error);
      alert('Unable to delete student.');
    }
  };

  const handleUpdateStudentPhoto = async (
    sectionId: string,
    studentId: string,
    photoUrl: string
  ) => {
    try {
      const { ok, data } = await apiFetch('/api/student/photo', {
        method: 'POST',
        body: JSON.stringify({ studentId, photoUrl }),
      });

      if (!ok) {
        alert(data.error || 'Failed to update student photo.');
        return;
      }

      const patch = (list: Section[]) =>
        list.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                students: section.students.map((student) =>
                  student.id === studentId
                    ? { ...student, photoUrl }
                    : student
                ),
              }
            : section
        );

      setSections(patch);
      setTeacherSections(patch);
    } catch (error) {
      console.error('Update student photo error:', error);
      alert('Unable to update student photo.');
    }
  };

  // ===================== ATTENDANCE =====================

  const handleClearRecords = async () => {
    if (!window.confirm('Are you sure you want to clear all attendance records?')) {
      return;
    }

    try {
      const { ok, data } = await apiFetch('/api/records/clear', {
        method: 'POST',
      });

      if (ok) {
        setTeacherRecords([]);
      } else {
        alert(data.error || 'Failed to clear attendance records.');
      }
    } catch (error) {
      console.error('Clear records error:', error);
      alert('Unable to clear attendance records.');
    }
  };

  const handleSubmitAttendance = async (
    studentId: string,
    studentName: string,
    sectionId: string,
    sectionName: string,
    date: string,
    time: string,
    type?: 'In' | 'Out'
  ): Promise<{
    status: 'Present' | 'Late' | 'Time Out';
    startTime: string;
  }> => {
    const section = sections.find((s) => s.id === sectionId);
    const startTime = section?.startTime || '08:00';

    let status: 'Present' | 'Late' | 'Time Out' = 'Present';

    if (type === 'Out') {
      status = 'Time Out';
    } else {
      const [arrHours, arrMins] = time.split(':').map(Number);
      const [startHours, startMins] = startTime.split(':').map(Number);

      status =
        arrHours * 60 + arrMins > startHours * 60 + startMins
          ? 'Late'
          : 'Present';
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
      const { ok, data } = await apiFetch('/api/records/add', {
        method: 'POST',
        body: JSON.stringify(newRecord),
      });

      if (!ok) {
        console.error(
          'Attendance was not saved:',
          data.error || 'Unknown error'
        );
      }
    } catch (error) {
      console.error('Attendance request failed:', error);
    }

    return { status, startTime };
  };

  // ===================== TEACHER SECURITY SETTINGS =====================

  const openSecuritySettings = () => {
    if (authUser?.role !== 'teacher') return;

    setNewTeacherUsername(authUser.username || '');
    setNewPassword('');
    setShowPassword(false);
    setIsSettingsOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (authUser?.role !== 'teacher') return;

    const trimmedUsername = newTeacherUsername.trim();
    const passwordToSave = newPassword;

    if (!trimmedUsername) {
      alert('Please enter a username.');
      return;
    }

    if (passwordToSave && passwordToSave.length < 4) {
      alert('Password must be at least 4 characters.');
      return;
    }

    setIsSavingSecurity(true);

    try {
      const { ok, data } = await apiFetch('/api/teacher/me', {
        method: 'PUT',
        body: JSON.stringify({
          username: trimmedUsername,
          ...(passwordToSave ? { password: passwordToSave } : {}),
        }),
      });

      if (!ok || !data.success) {
        alert(data.error || 'Failed to save security settings.');
        return;
      }

      const savedUsername =
        data.teacher?.username || trimmedUsername;

      setAuthUser((prev) => {
        if (!prev || prev.role !== 'teacher') return prev;

        return {
          ...prev,
          username: savedUsername,
        };
      });

      localStorage.setItem('teacher_username', savedUsername);

      setIsSettingsOpen(false);
      setNewPassword('');
      setShowPassword(false);

      alert(
        'Security settings updated successfully. Use your new credentials the next time you log in.'
      );
    } catch (error) {
      console.error('Security settings error:', error);
      alert('An error occurred while saving security settings.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const isTeacher = authUser?.role === 'teacher';
  const isStudent = authUser?.role === 'student';
  const isPublicView = currentView === 'checkin' || currentView === 'login' || currentView === 'about';

  return (
    <div
      id="app-root-container"
      className={`min-h-screen text-gray-800 dark:text-gray-100 font-sans flex flex-col antialiased transition-colors ${
        isPublicView
          ? 'bg-cover bg-center bg-no-repeat bg-fixed'
          : 'bg-gray-50/70 dark:bg-gray-950'
      }`}
      style={
        isPublicView
          ? {
              backgroundImage: `url('/900332001_2170304707029405_3282073779059589943_n.jpg')`,
            }
          : {}
      }
    >
      <header
        id="app-navbar"
        className={`border-b border-gray-100/20 dark:border-gray-800/20 py-4 px-4 sm:px-6 sticky top-0 z-40 backdrop-blur-md transition-colors ${
          isPublicView
            ? 'bg-white/70 dark:bg-gray-900/70'
            : 'bg-white dark:bg-gray-900'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
  <img 
    src="/Ctulogo.jpg" 
    alt="CTU Logo" 
    className="w-10 h-10 object-contain rounded-lg" 
  />
</div>

            <div>
              <span className="font-display font-black text-lg text-gray-900 dark:text-white tracking-tight block">
                EDULECTRICAL-ATTENDANCE-SYSTEM
              </span>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-wider font-semibold uppercase">
                    System Live
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            id="live-clock-widget"
            className="hidden md:flex items-center gap-2.5 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono font-medium shadow-xs backdrop-blur-xs"
          >
            <Clock size={14} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span>Classroom Clock:</span>
            <strong className="text-gray-900 dark:text-gray-100">
              {currentTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </strong>
          </div>

          <div className="flex items-center gap-3">
            {/* ABOUT US BUTTON */}
            <button
              type="button"
              onClick={() => setCurrentView('about')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                currentView === 'about'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900'
              }`}
            >
              <Info size={14} />
              <span>About Us</span>
            </button>

            <DarkModeToggle />

            <div className="flex items-center gap-2.5 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-xs">
              <button
                id="switch-to-checkin-btn"
                type="button"
                onClick={() => setCurrentView('checkin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  currentView === 'checkin'
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <User size={14} />
                <span>Check-In</span>
              </button>

              <button
                id="switch-to-dashboard-btn"
                type="button"
                onClick={() =>
                  setCurrentView(
                    authUser ? roleView(authUser.role) : 'login'
                  )
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  currentView !== 'checkin' && currentView !== 'about'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                {authUser ? <Unlock size={14} /> : <Lock size={14} />}
                <span>
                  {authUser
                    ? isTeacher
                      ? 'Teacher Dashboard'
                      : isStudent
                        ? 'My Attendance'
                        : 'Admin Dashboard'
                    : 'Sign In'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        id="app-main-workspace"
        className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center"
      >
        <AnimatePresence mode="wait">
          {currentView === 'checkin' && (
            <motion.div
              key="checkin-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl my-auto"
            >
              <StudentPortal
                sections={sections}
                preselectedSectionId={preselectedSectionId}
                onSubmitAttendance={handleSubmitAttendance}
                onUpdateStudentPhoto={handleUpdateStudentPhoto}
                onGoToLogin={() => setCurrentView('login')}
              />
            </motion.div>
          )}

          {currentView === 'about' && (
            <motion.div
              key="about-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <AboutUs onBackToHome={() => setCurrentView('checkin')} />
            </motion.div>
          )}

          {currentView === 'login' && (
            <motion.div
              key="login-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl my-auto"
            >
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onBackToCheckin={() => setCurrentView('checkin')}
              />
            </motion.div>
          )}

          {currentView === 'admin' && authUser?.role === 'admin' && (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <AdminDashboard onLogout={handleLogOut} />
            </motion.div>
          )}

          {currentView === 'my-attendance' &&
            authUser?.role === 'student' && (
              <motion.div
                key="student-history-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <StudentAttendanceHistory
                  studentName={authUser.name}
                  onLogOut={handleLogOut}
                />
              </motion.div>
            )}

          {currentView === 'teacher' && authUser?.role === 'teacher' && (
            <motion.div
              key="teacher-dashboard-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full"
            >
              <div className="flex items-center justify-end mb-4">
                <button
                  id="btn-settings-pin"
                  type="button"
                  onClick={openSecuritySettings}
                  className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Settings size={14} />
                  <span>Configure Security</span>
                </button>
              </div>

              <TeacherDashboard
                teacher={{
                  name: authUser.name,
                  username: authUser.username,
                  photo: authUser.photo || undefined,
                  role: authUser.role,
                }}
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

      {/* ===================== TEACHER SECURITY MODAL ===================== */}

      <AnimatePresence>
        {isSettingsOpen && authUser?.role === 'teacher' && (
          <div
            id="settings-modal-overlay"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Configure Security
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Change your login credentials without changing your profile name.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSavingSecurity}
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 transition cursor-pointer font-bold disabled:opacity-50"
                  aria-label="Close settings"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="settings-teacher-username"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wider block"
                  >
                    LOGIN USERNAME
                  </label>

                  <input
                    id="settings-teacher-username"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={100}
                    placeholder="Enter new username"
                    value={newTeacherUsername}
                    onChange={(e) => setNewTeacherUsername(e.target.value)}
                    disabled={isSavingSecurity}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600 transition disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="settings-new-password"
                    className="text-xs font-bold text-gray-500 uppercase tracking-wider block"
                  >
                    NEW PASSWORD (OPTIONAL)
                  </label>

                  <div className="relative">
                    <input
                      id="settings-new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={4}
                      maxLength={128}
                      placeholder="Leave blank to keep current password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSavingSecurity}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 pr-12 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600 transition font-mono disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isSavingSecurity}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer disabled:opacity-50"
                      title={showPassword ? 'Hide Password' : 'Show Password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Use at least 4 characters. Leave blank if you do not want to change your password.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    id="btn-cancel-settings"
                    type="button"
                    disabled={isSavingSecurity}
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    id="btn-save-settings"
                    type="submit"
                    disabled={isSavingSecurity}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingSecurity && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    {isSavingSecurity ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer
        id="app-footer"
        className={`border-t border-gray-100/20 dark:border-gray-800/20 py-6 px-4 mt-12 text-center text-xs text-gray-600 dark:text-gray-300 transition-colors ${
          isPublicView
            ? 'bg-white/70 dark:bg-gray-900/70 backdrop-blur-md'
            : 'bg-white dark:bg-gray-900'
        }`}
      >
        <div className="max-w-7xl mx-auto space-y-1.5">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            QR Attendance Portal — Secure School Management
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            Developed by BIT-ELECTRICAL 3-5 for students to log student arrival
            punctuality.
          </p>
        </div>
      </footer>
    </div>
  );
}