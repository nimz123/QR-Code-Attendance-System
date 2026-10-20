import React, { useState, useEffect, useMemo } from 'react';
import { Section, formatTimeToAMPM } from '../types';
import { BookOpen, Calendar, Clock, RefreshCw, Send, User, MapPin } from 'lucide-react';
import AttendanceBanner from './AttendanceBanner';
import StudentNamePicker from './StudentNamePicker';
import AttendanceResultModal, { AttendancePopupData } from './AttendanceResultModal';
import { apiFetch } from '../lib/api';

interface StudentPortalProps {
  sections?: Section[];
  teachers?: any[];
  preselectedSectionId?: string | null;
  onSubmitAttendance: (
    studentId: string,
    studentName: string,
    sectionId: string,
    sectionName: string,
    date: string,
    time: string,
    type?: "In" | "Out"
  ) => Promise<{
    status: "Present" | "Late" | "Time Out";
    startTime: string;
  }>;

  onUpdateStudentPhoto?: (
    sectionId: string,
    studentId: string,
    photoUrl: string
  ) => void;
  onGoToLogin: () => void;
}

export default function StudentPortal({
  sections: propSections = [],
  teachers: propTeachers = [],
  preselectedSectionId,
  onSubmitAttendance,
  onUpdateStudentPhoto,
  onGoToLogin
}: StudentPortalProps) {
  // Helper functions to retrieve local date and time strings
  const getTodayLocalDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getNowLocalTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // State initializations
  const [sections, setSections] = useState<Section[]>(propSections);
  const [teachers, setTeachers] = useState<any[]>(propTeachers);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [arrivalDate, setArrivalDate] = useState(getTodayLocalDateStr());
  const [arrivalTime, setArrivalTime] = useState(getNowLocalTimeStr());

  // URL search parameter check for Time In or Time Out mode
  const params = new URLSearchParams(window.location.search);
  const isTimeOut = params.get('type') === 'out';

  // Result popup state
  const [popupData, setPopupData] = useState<AttendancePopupData | null>(null);

  // Keep local states synced if props change from parent
  useEffect(() => {
    if (propSections.length > 0) setSections(propSections);
  }, [propSections]);

  useEffect(() => {
    if (propTeachers.length > 0) setTeachers(propTeachers);
  }, [propTeachers]);

  // Dynamic API fetching on mount
  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        const resSections = await apiFetch('/api/sections');
        if (resSections.ok) {
          if (Array.isArray(resSections.data)) setSections(resSections.data);
          else if (resSections.data.sections) setSections(resSections.data.sections);
        }

        // Fetch teachers list from admin or fallback teacher endpoints
        const resTeachers = await apiFetch('/api/admin/teachers');
        if (resTeachers.ok) {
          if (Array.isArray(resTeachers.data)) setTeachers(resTeachers.data);
          else if (resTeachers.data.teachers) setTeachers(resTeachers.data.teachers);
        } else {
          const resPubTeachers = await apiFetch('/api/teachers');
          if (resPubTeachers.ok) {
            if (Array.isArray(resPubTeachers.data)) setTeachers(resPubTeachers.data);
            else if (resPubTeachers.data.teachers) setTeachers(resPubTeachers.data.teachers);
          }
        }
      } catch (err) {
        console.error('Failed to fetch portal data:', err);
      }
    };

    fetchPortalData();
  }, []);

  // Consolidate unique teachers list
  const teachersList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; username?: string; photo?: string }>();
    
    teachers.forEach(t => {
      const id = String(t.id || t._id || t.username || '');
      const name = t.name || t.username;
      if (id && name) {
        map.set(id, { id, name, username: t.username, photo: t.photo || t.teacherPhoto });
      }
    });

    sections.forEach(sec => {
      const tId = String(sec.teacherId || (sec as any).teacher_id || '');
      const tName = sec.teacherName || (sec as any).teacher_name;
      if (tId && tName && !map.has(tId)) {
        map.set(tId, {
          id: tId,
          name: tName,
          photo: (sec as any).teacherPhoto || (sec as any).photo
        });
      }
    });

    return Array.from(map.values());
  }, [teachers, sections]);

  // Robust section filtering matching ID, username, or teacher name
  const filteredSections = useMemo(() => {
    if (!selectedTeacherId) return [];

    const currentTeacher = teachersList.find(t => String(t.id) === String(selectedTeacherId));

    return sections.filter(s => {
      const sTeacherId = String(s.teacherId || (s as any).teacher_id || '');
      const sTeacherName = String(s.teacherName || (s as any).teacher_name || '').toLowerCase();
      const selId = String(selectedTeacherId).toLowerCase();
      
      const selName = currentTeacher ? currentTeacher.name.toLowerCase() : '';
      const selUsername = currentTeacher && currentTeacher.username ? currentTeacher.username.toLowerCase() : '';

      return (
        sTeacherId === selId ||
        (selName && sTeacherName === selName) ||
        (selUsername && sTeacherName === selUsername) ||
        (!sTeacherId && !sTeacherName) // Show unassigned sections as fallback
      );
    });
  }, [sections, selectedTeacherId, teachersList]);

  // Preselect section when directed via QR code URL
  useEffect(() => {
    if (preselectedSectionId) {
      const found = sections.find(s => s.id === preselectedSectionId);
      if (found) {
        const foundTeacherId = String(found.teacherId || (found as any).teacher_id || '');
        setSelectedTeacherId(foundTeacherId);
        setSelectedSectionId(found.id);
      }
    }
  }, [preselectedSectionId, sections]);

  // Reset student selection when section selection changes
  useEffect(() => {
    setSelectedStudentId('');
  }, [selectedSectionId]);

  const activeSection = sections.find(s => s.id === selectedSectionId);
  const studentsList = activeSection?.students || [];
  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // Sync inputs with current system time
  const handleSetToCurrentTime = () => {
    setArrivalDate(getTodayLocalDateStr());
    setArrivalTime(getNowLocalTimeStr());
  };

  // Submit student attendance record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId || !selectedStudentId || !activeSection) return;

    const student = studentsList.find(s => s.id === selectedStudentId);
    if (!student) return;

    const result = await onSubmitAttendance(
      student.id,
      student.name,
      activeSection.id,
      activeSection.name,
      arrivalDate,
      arrivalTime,
      isTimeOut ? "Out" : "In"
    );

    setPopupData({
      isOpen: true,
      studentName: student.name,
      sectionName: activeSection.name,
      arrivalDate,
      arrivalTime,
      status: result.status,
      startTime: result.startTime,
    });
  };

  // Reset popup and selection states
  const handleClosePopupAndReset = () => {
    setPopupData(null);
    setSelectedStudentId('');
    setArrivalDate(getTodayLocalDateStr());
    setArrivalTime(getNowLocalTimeStr());
  };

  return (
    <div id="student-portal-root" className="max-w-2xl mx-auto space-y-6">

      <AttendanceBanner isTimeOut={isTimeOut} activeSection={activeSection} onGoToLogin={onGoToLogin} />

      <form onSubmit={handleSubmit} id="student-attendance-form" className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 shadow-sm space-y-6 transition-colors">

        {/* 1. SELECT TEACHER FIRST */}
        <div className="space-y-2">
          <label htmlFor="student-teacher-select" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <User size={14} className="text-gray-400" />
            <span>1. Select Teacher</span>
          </label>

          <select
            id="student-teacher-select"
            required
            value={selectedTeacherId}
            onChange={(e) => {
              setSelectedTeacherId(e.target.value);
              setSelectedSectionId(''); 
            }}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="" disabled>-- Choose Teacher --</option>
            {teachersList.length > 0 ? (
              teachersList.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            ) : (
              <option value="" disabled>No teachers available</option>
            )}
          </select>
        </div>

        {/* 2. CHOOSE CLASS SECTION */}
        <div className="space-y-2">
          <label htmlFor="student-section-select" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <BookOpen size={14} className="text-gray-400" />
            <span>2. Choose Class Section</span>
          </label>

          <select
            id="student-section-select"
            required
            disabled={!selectedTeacherId}
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition disabled:opacity-50 cursor-pointer"
          >
            <option value="" disabled>
              {selectedTeacherId 
                ? (filteredSections.length > 0 ? "-- Select Section --" : "No sections found for this teacher") 
                : "Select a teacher first"}
            </option>
            {filteredSections.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.startTime ? `(Start: ${formatTimeToAMPM(s.startTime)})` : ''}
                {s.room ? ` • Room: ${s.room}` : ''}
                {s.subject ? ` • Subject: ${s.subject}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. SELECT STUDENT NAME */}
        <div className={!selectedSectionId ? "opacity-50 pointer-events-none" : ""}>
          <StudentNamePicker
            studentsList={studentsList}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onUpdateStudentPhoto={onUpdateStudentPhoto ? (studentId, photoUrl) => onUpdateStudentPhoto(selectedSectionId, studentId, photoUrl) : undefined}
          />
        </div>

        {/* Time and Date input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-5">
          <div className="space-y-2">
            <label htmlFor="arrival-date-input" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={14} className="text-gray-400" />
              <span>Arrival Date</span>
            </label>
            <input
              id="arrival-date-input"
              type="date"
              required
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="arrival-time-input" className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={14} className="text-gray-400" />
              <span>Arrival Time</span>
            </label>
            <input
              id="arrival-time-input"
              type="time"
              required
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            id="btn-sync-time"
            type="button"
            onClick={handleSetToCurrentTime}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-semibold cursor-pointer py-1"
          >
            <RefreshCw size={12} />
            <span>Reset to Current Clock</span>
          </button>
        </div>

        <button
          id="btn-submit-attendance"
          type="submit"
          disabled={!selectedSectionId || !selectedStudentId}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-bold text-sm py-3 px-4 rounded-xl transition duration-150 shadow-xs cursor-pointer"
        >
          <Send size={16} />
          <span>Submit Arrival Records</span>
        </button>

      </form>

      <AttendanceResultModal
        popupData={popupData}
        studentPhotoUrl={selectedStudent?.photoUrl}
        onClose={handleClosePopupAndReset}
      />

    </div>
  );
}