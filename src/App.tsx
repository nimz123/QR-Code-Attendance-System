import React, { useState, useEffect } from 'react';
import { Section, Student, AttendanceRecord } from './types';
import { INITIAL_SECTIONS, INITIAL_RECORDS } from './initialData';
import TeacherDashboard from './components/TeacherDashboard';
import StudentPortal from './components/StudentPortal';
import { 
  School, 
  Lock, 
  Unlock, 
  Sliders, 
  User, 
  Clock, 
  Info, 
  AlertCircle,
  Sparkles,
  Settings,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // State for class sections and student lists
  const [sections, setSections] = useState<Section[]>([]);
  // State for attendance logs
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  
  // Current active view
  const [currentView, setCurrentView] = useState<'student' | 'teacher'>('student');
  
  // Pre-selected section from QR code query parameter
  const [preselectedSectionId, setPreselectedSectionId] = useState<string | null>(null);

  // Security states for entering teacher console
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [pinError, setPinError] = useState(false);
  
  // Registration state
  const [signUpName, setSignUpName] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPhoto, setSignUpPhoto] = useState('');
  const [signUpRoom, setSignUpRoom] = useState('');
  const [signUpSubject, setSignUpSubject] = useState('');
  
  // State for setting custom Password and Teacher Profile
  const [teacherName, setTeacherName] = useState('Instructor');
  const [newTeacherName, setNewTeacherName] = useState('Instructor');
  const [teacherPhoto, setTeacherPhoto] = useState('');
  const [newTeacherPhoto, setNewTeacherPhoto] = useState('');
  const [teacherRoom, setTeacherRoom] = useState('');
  const [newTeacherRoom, setNewTeacherRoom] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Live clock display state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch overall state from Express backend
  const fetchStateFromServer = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        
        // 1. Sync Sections
        if (data.sections) {
          const fetchedSectionsStr = JSON.stringify(data.sections);
          const cachedSectionsStr = localStorage.getItem('attendance_sections') || '[]';
          if (fetchedSectionsStr !== cachedSectionsStr) {
            setSections(data.sections);
            localStorage.setItem('attendance_sections', fetchedSectionsStr);
          }
        }

        // 2. Sync Records
        if (data.records) {
          const fetchedRecordsStr = JSON.stringify(data.records);
          const cachedRecordsStr = localStorage.getItem('attendance_records') || '[]';
          if (fetchedRecordsStr !== cachedRecordsStr) {
            setRecords(data.records);
            localStorage.setItem('attendance_records', fetchedRecordsStr);
          }
        }

        // 3. Sync Teacher Profile
        if (data.teacher) {
          const t = data.teacher;
          const cachedTeacherStr = localStorage.getItem('teacher_profile_cached') || '{}';
          const fetchedTeacherStr = JSON.stringify(t);

          if (fetchedTeacherStr !== cachedTeacherStr) {
            localStorage.setItem('teacher_profile_cached', fetchedTeacherStr);
            if (t.isRegistered) {
              setIsRegistered(true);
              setTeacherPassword(t.password || '');
              setTeacherName(t.name || '');
              setNewTeacherName(t.name || '');
              setTeacherPhoto(t.photo || '');
              setNewTeacherPhoto(t.photo || '');
              setTeacherRoom(t.room || '');
              setNewTeacherRoom(t.room || '');
              setTeacherSubject(t.subject || '');
              setNewTeacherSubject(t.subject || '');

              localStorage.setItem('teacher_registered', 'true');
              localStorage.setItem('teacher_password', t.password || '');
              localStorage.setItem('teacher_name', t.name || '');
              localStorage.setItem('teacher_photo', t.photo || '');
              localStorage.setItem('teacher_room', t.room || '');
              localStorage.setItem('teacher_subject', t.subject || '');
            } else {
              setIsRegistered(false);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Express backend state fetch failed, falling back to local storage:", err);
    }
  };

  // Helper to push modified sections to the server
  const syncSectionsToServer = async (updatedSections: Section[]) => {
    try {
      await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSections)
      });
    } catch (e) {
      console.error("Failed to sync sections to server:", e);
    }
  };

  // Helper to push modified records to the server
  const syncRecordsToServer = async (updatedRecords: AttendanceRecord[]) => {
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecords)
      });
    } catch (e) {
      console.error("Failed to sync records to server:", e);
    }
  };

  // On mount: Load state from Local Storage OR fallback, and setup periodic backend polling
  useEffect(() => {
    // 1. First, load fallbacks from LocalStorage
    const savedSections = localStorage.getItem('attendance_sections');
    if (savedSections) {
      try { setSections(JSON.parse(savedSections)); } catch (e) {}
    }
    const savedRecords = localStorage.getItem('attendance_records');
    if (savedRecords) {
      try { setRecords(JSON.parse(savedRecords)); } catch (e) {}
    }
    const savedRegistered = localStorage.getItem('teacher_registered');
    const savedPassword = localStorage.getItem('teacher_password');
    const savedName = localStorage.getItem('teacher_name');
    const savedPhoto = localStorage.getItem('teacher_photo');
    const savedRoom = localStorage.getItem('teacher_room');
    const savedSubject = localStorage.getItem('teacher_subject');

    if (savedRegistered === 'true' && savedPassword) {
      setIsRegistered(true);
      setTeacherPassword(savedPassword);
      if (savedName) { setTeacherName(savedName); setNewTeacherName(savedName); }
      if (savedPhoto) { setTeacherPhoto(savedPhoto); setNewTeacherPhoto(savedPhoto); }
      if (savedRoom) { setTeacherRoom(savedRoom); setNewTeacherRoom(savedRoom); }
      if (savedSubject) { setTeacherSubject(savedSubject); setNewTeacherSubject(savedSubject); }
    }

    // 2. Load the actual fresh values from server
    fetchStateFromServer();

    // 3. Set up a polling interval every 5 seconds to sync data across devices
    const syncInterval = setInterval(fetchStateFromServer, 5000);

    // 4. Parse URL parameters for student portal role or selected section
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    const sectionParam = params.get('sectionId');
    if (roleParam === 'student') {
      setCurrentView('student');
    }
    if (sectionParam) {
      setPreselectedSectionId(sectionParam);
    }

    return () => clearInterval(syncInterval);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (sections.length > 0) {
      localStorage.setItem('attendance_sections', JSON.stringify(sections));
    }
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('attendance_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('teacher_name', teacherName);
  }, [teacherName]);

  useEffect(() => {
    localStorage.setItem('teacher_photo', teacherPhoto);
  }, [teacherPhoto]);

  useEffect(() => {
    localStorage.setItem('teacher_room', teacherRoom);
  }, [teacherRoom]);

  useEffect(() => {
    localStorage.setItem('teacher_subject', teacherSubject);
  }, [teacherSubject]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to generate unique short IDs
  const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

  // Core functions called by Teacher Dashboard
  const handleAddSection = (name: string, startTime: string) => {
    const newSection: Section = {
      id: generateId('sec'),
      name,
      startTime,
      students: []
    };
    const updated = [...sections, newSection];
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));
    syncSectionsToServer(updated);
  };

  const handleDeleteSection = (id: string) => {
    const updated = sections.filter(s => s.id !== id);
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));
    syncSectionsToServer(updated);
    // Also clear associated attendance records if section is deleted
    const updatedRecords = records.filter(r => r.sectionId !== id);
    setRecords(updatedRecords);
    syncRecordsToServer(updatedRecords);
  };

  const handleUpdateSectionTime = (sectionId: string, startTime: string) => {
    const updated = sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, startTime };
      }
      return s;
    });
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));
    syncSectionsToServer(updated);
  };

  const handleAddStudents = (sectionId: string, studentNames: string[]) => {
    const updated = sections.map(s => {
      if (s.id === sectionId) {
        const newStudents: Student[] = studentNames.map(name => ({
          id: generateId('std'),
          name
        }));
        // Avoid duplicate student names in same section
        const existingNames = new Set(s.students.map(st => st.name.toLowerCase()));
        const uniqueNewStudents = newStudents.filter(st => !existingNames.has(st.name.toLowerCase()));
        
        return {
          ...s,
          students: [...s.students, ...uniqueNewStudents]
        };
      }
      return s;
    });
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));
    syncSectionsToServer(updated);
  };

  const handleDeleteStudent = (sectionId: string, studentId: string) => {
    const updated = sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          students: s.students.filter(st => st.id !== studentId)
        };
      }
      return s;
    });
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));
    syncSectionsToServer(updated);
  };

  const handleUpdateStudentPhoto = (sectionId: string, studentId: string, photoUrl: string) => {
    const updated = sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          students: s.students.map(st => {
            if (st.id === studentId) {
              return { ...st, photoUrl };
            }
            return st;
          })
        };
      }
      return s;
    });
    setSections(updated);
    localStorage.setItem('attendance_sections', JSON.stringify(updated));

    // Update photoUrl in records matching this student as well
    const updatedRecords = records.map(r => {
      if (r.studentId === studentId && r.sectionId === sectionId) {
        return { ...r, studentPhotoUrl: photoUrl };
      }
      return r;
    });
    setRecords(updatedRecords);
    localStorage.setItem('attendance_records', JSON.stringify(updatedRecords));

    // Push photo update to server
    fetch('/api/student/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, studentId, photoUrl })
    }).catch(e => console.error("Failed to upload student photo to server:", e));
  };

  const handleClearRecords = () => {
    setRecords([]);
    localStorage.setItem('attendance_records', JSON.stringify([]));
    fetch('/api/records/clear', { method: 'POST' }).catch(e => console.error("Failed to clear records on server:", e));
  };

  // Student Attendance Submission logic (compares arrival time to section startTime)
  const handleSubmitAttendance =async (
    studentId: string, 
    studentName: string, 
    sectionId: string, 
    sectionName: string, 
    date: string, 
    time: string,
    type?: 'In' | 'Out'
  ): { status: 'Present' | 'Late' | 'Time Out'; startTime: string } => {
    // 1. Retrieve the designated start time of this class
    const section = sections.find(s => s.id === sectionId);
    const startTime = section?.startTime || '08:00';
    const student = section?.students.find(st => st.id === studentId);

    // 2. Evaluate if Student is Late or Checked Out
    let status: 'Present' | 'Late' | 'Time Out' = 'Present';
    if (type === 'Out') {
      status = 'Time Out';
    } else {
      const [arrHours, arrMins] = time.split(':').map(Number);
      const [startHours, startMins] = startTime.split(':').map(Number);
      
      const arrivalMinutes = arrHours * 60 + arrMins;
      const startMinutes = startHours * 60 + startMins;
      
      // Auto-calculates LATE status
      status = arrivalMinutes > startMinutes ? 'Late' : 'Present';
    }

    // 3. Create a clean attendance log
    const newRecord: AttendanceRecord = {
      id: generateId('rec'),
      studentId,
      studentName,
      studentPhotoUrl: student?.photoUrl,
      sectionId,
      sectionName,
      date,
      time,
      status,
      type,
      timestamp: new Date().toISOString()
    };

    setRecords(prev => [newRecord, ...prev]);
try {
  const response = await fetch("/api/records/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newRecord),
  });

  const result = await response.json();
  console.log(result);

} catch (e) {
  console.error(e);
}

return {
  status,
  startTime,
};
}
  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === teacherPassword) {
      setCurrentView('teacher');
      setIsPinModalOpen(false);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleLogOut = () => {
    setCurrentView('student');
    setIsPinModalOpen(false);
  };

  const handleTeacherSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = signUpName.trim();
    const trimmedPassword = signUpPassword.trim();
    const trimmedRoom = signUpRoom.trim();
    const trimmedSubject = signUpSubject.trim();

    if (!trimmedName) {
      alert('Please enter your name.');
      return;
    }
    if (trimmedPassword.length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    setTeacherName(trimmedName);
    setTeacherPassword(trimmedPassword);
    setTeacherPhoto(signUpPhoto);
    setTeacherRoom(trimmedRoom);
    setTeacherSubject(trimmedSubject);
    setIsRegistered(true);

    localStorage.setItem('teacher_name', trimmedName);
    localStorage.setItem('teacher_password', trimmedPassword);
    localStorage.setItem('teacher_photo', signUpPhoto);
    localStorage.setItem('teacher_room', trimmedRoom);
    localStorage.setItem('teacher_subject', trimmedSubject);
    localStorage.setItem('teacher_registered', 'true');

    // Clear old PIN data if present
    localStorage.removeItem('teacher_pin_code');

    // Save profile to server
    fetch('/api/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        photo: signUpPhoto,
        password: trimmedPassword,
        isRegistered: true,
        room: trimmedRoom,
        subject: trimmedSubject
      })
    }).catch(e => console.error("Failed to sync registration to server:", e));

    // Automatically transition to teacher view
    setCurrentView('teacher');
    setIsPinModalOpen(false);

    // Clear form
    setSignUpName('');
    setSignUpPassword('');
    setSignUpPhoto('');
    setSignUpRoom('');
    setSignUpSubject('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update Teacher Name
    const trimmedName = newTeacherName.trim();
    if (trimmedName) {
      setTeacherName(trimmedName);
      localStorage.setItem('teacher_name', trimmedName);
    }

    // Update Teacher Photo
    setTeacherPhoto(newTeacherPhoto);
    localStorage.setItem('teacher_photo', newTeacherPhoto);

    // Update Room and Subject
    const trimmedRoom = newTeacherRoom.trim();
    setTeacherRoom(trimmedRoom);
    localStorage.setItem('teacher_room', trimmedRoom);

    const trimmedSubject = newTeacherSubject.trim();
    setTeacherSubject(trimmedSubject);
    localStorage.setItem('teacher_subject', trimmedSubject);

    // Update Password if a new one is specified
    const trimmedPassword = newPassword.trim();
    let finalPassword = teacherPassword;
    if (trimmedPassword.length > 0) {
      if (trimmedPassword.length >= 4) {
        setTeacherPassword(trimmedPassword);
        finalPassword = trimmedPassword;
        localStorage.setItem('teacher_password', trimmedPassword);
        localStorage.setItem('teacher_registered', 'true');
      } else {
        alert('Password must be at least 4 characters if you wish to change it.');
        return;
      }
    }

    // Save teacher to server
    fetch('/api/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName || teacherName,
        photo: newTeacherPhoto,
        password: finalPassword,
        isRegistered: true,
        room: trimmedRoom,
        subject: trimmedSubject
      })
    }).catch(e => console.error("Failed to sync profile changes to server:", e));
    
    setIsSettingsOpen(false);
    setNewPassword('');
  };

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
                {teacherName && teacherName !== 'Instructor' && (
                  <>
                    <span className="text-gray-300 text-[10px] hidden sm:inline">•</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                      {teacherPhoto && (
                        <img 
                          src={teacherPhoto} 
                          alt={teacherName} 
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded-full object-cover border border-indigo-200" 
                        />
                      )}
                      Teacher: {teacherName}
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
            
            {/* Student View Button */}
            <button
              id="switch-to-student-btn"
              onClick={() => setCurrentView('student')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                currentView === 'student'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <User size={14} />
              <span>Student Portal</span>
            </button>

            {/* Teacher View Button */}
            <button
              id="switch-to-teacher-btn"
              onClick={() => {
                if (currentView === 'teacher') return;
                handleTryEnterTeacherView();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                currentView === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-indigo-600'
              }`}
            >
              {currentView === 'teacher' ? <Unlock size={14} /> : <Lock size={14} />}
              <span>Teacher Panel</span>
            </button>

          </div>

        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main id="app-main-workspace" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* VIEW CONDITIONAL RENDERING */}
        <AnimatePresence mode="wait">
          {currentView === 'student' ? (
            <motion.div
              key="student-portal-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <StudentPortal
                sections={sections}
                preselectedSectionId={preselectedSectionId}
                onSubmitAttendance={handleSubmitAttendance}
                teacherName={teacherName}
                teacherPhotoUrl={teacherPhoto}
                roomName={teacherRoom}
                subjectName={teacherSubject}
                onUpdateStudentPhoto={handleUpdateStudentPhoto}
              />
            </motion.div>
          ) : (
            <motion.div
              key="teacher-dashboard-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {/* Teacher Console Config Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Sparkles size={10} />
                    <span>Instructor Access</span>
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 tracking-tight mt-1">Teacher Dashboard</h1>
                </div>
 
                {/* Settings PIN Button */}
                <button
                  id="btn-settings-pin"
                  onClick={() => {
                    setNewTeacherName(teacherName);
                    setNewTeacherPhoto(teacherPhoto);
                    setNewTeacherRoom(teacherRoom);
                    setNewTeacherSubject(teacherSubject);
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
                sections={sections}
                records={records}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onAddStudents={handleAddStudents}
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

      {/* 3. SECURITY & SIGN UP POPUP DIALOG */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div id="pin-modal-overlay" className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100"
            >
              {!isRegistered ? (
                // Setup / Sign Up Form
                <div className="space-y-4">
                  <div className="text-center space-y-2 mb-4">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-full inline-flex">
                      <Sparkles size={24} className="stroke-2" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Teacher Account Setup</h3>
                    <p className="text-xs text-gray-500">Create your instructor profile and choose a password to secure your reports.</p>
                  </div>

                   <form onSubmit={handleTeacherSignUp} className="space-y-4">
                    {/* Name Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="signup-teacher-name" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Teacher Name / Title</label>
                      <input
                        id="signup-teacher-name"
                        type="text"
                        required
                        placeholder=" "
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        autoFocus
                      />
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="signup-teacher-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Security Password</label>
                      <input
                        id="signup-teacher-password"
                        type="password"
                        required
                        minLength={4}
                        placeholder="Choose at least 4 characters"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      />
                    </div>

                    {/* Room Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="signup-teacher-room" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">ROOM (Optional)</label>
                      <input
                        id="signup-teacher-room"
                        type="text"
                        placeholder=" "
                        value={signUpRoom}
                        onChange={(e) => setSignUpRoom(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {/* Subject Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="signup-teacher-subject" className="text-xs font-bold text-gray-600 uppercase tracking-wider block">SUBJECT (Optional)</label>
                      <input
                        id="signup-teacher-subject"
                        type="text"
                        placeholder=" "
                        value={signUpSubject}
                        onChange={(e) => setSignUpSubject(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {/* Optional Photo upload right in signup */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Profile Photo (Optional)</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                          {signUpPhoto ? (
                            <img 
                              src={signUpPhoto} 
                              alt="Teacher Preview" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <User className="text-gray-400" size={20} />
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 font-semibold text-[10px] px-3 py-1.5 rounded-lg transition text-center shadow-2xs">
                            <span>Upload Photo</span>
                            <input
                              id="signup-teacher-photo-input"
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
                                      setSignUpPhoto(reader.result);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          {signUpPhoto && (
                            <button
                              id="btn-remove-signup-photo"
                              type="button"
                              onClick={() => setSignUpPhoto('')}
                              className="text-rose-600 hover:text-rose-800 font-bold text-[9px] uppercase text-left tracking-wider"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        id="btn-cancel-signup-modal"
                        type="button"
                        onClick={() => setIsPinModalOpen(false)}
                        className="w-1/2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 font-semibold text-xs py-2.5 rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-submit-signup"
                        type="submit"
                        className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs"
                      >
                        Register & Enter
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                // Verify Password / Sign In Form
                <div className="space-y-4">
                  <div className="text-center space-y-2 mb-4">
                    {teacherPhoto ? (
                      <div className="flex justify-center mb-1">
                        <img 
                          src={teacherPhoto} 
                          alt={teacherName} 
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-md" 
                        />
                      </div>
                    ) : (
                      <div className="bg-indigo-50 text-indigo-600 p-3 rounded-full inline-flex">
                        <Lock size={24} className="stroke-2" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900">Teacher Verification</h3>
                    <p className="text-xs text-gray-500">Hello, <strong className="text-indigo-600">{teacherName}</strong>! Enter your security password to access reports.</p>
                  </div>

                  <form onSubmit={handleVerifyPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <input
                        id="teacher-password-field"
                        type="password"
                        required
                        placeholder="Enter Password"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setPinError(false);
                        }}
                        className="w-full text-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        autoFocus
                      />
                      {pinError && (
                        <span id="password-error-warning" className="text-[11px] font-bold text-rose-600 flex items-center gap-1 justify-center mt-1">
                          <AlertCircle size={12} />
                          <span>Incorrect password. Please try again.</span>
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        id="btn-cancel-pin-modal"
                        type="button"
                        onClick={() => setIsPinModalOpen(false)}
                        className="w-1/2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 font-semibold text-xs py-2.5 rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button
                        id="btn-verify-password"
                        type="submit"
                        className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs"
                      >
                        Enter Console
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. SETTINGS CHANGE PROFILE MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
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
                {/* Teacher Name Input */}
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

                {/* Teacher Photo Input */}
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

                                            {/* Room Input */}
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

                                            {/* Subject Input */}
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

                                            {/* Optional Password Input */}
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

      {/* 5. APP FOOTER */}
      <footer id="app-footer" className="bg-white border-t border-gray-100 py-6 px-4 mt-12 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto space-y-1.5">
          <p className="font-semibold text-gray-500">QR Attendance Portal — Secure School Management</p>
          <p>Developed by Nimrold Albaracin for students to log student arrival punctuality.</p>
        </div>
      </footer>

    </div>
  );
}
