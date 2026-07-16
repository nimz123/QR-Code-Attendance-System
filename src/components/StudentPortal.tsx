import React, { useState, useEffect } from 'react';
import { Section, formatTimeToAMPM } from '../types';
import { BookOpen, Calendar, Clock, RefreshCw, Send } from 'lucide-react';
import AttendanceBanner from './AttendanceBanner';
import StudentNamePicker from './StudentNamePicker';
import AttendanceResultModal, { AttendancePopupData } from './AttendanceResultModal';

interface StudentPortalProps {
  sections: Section[];
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
  sections,
  preselectedSectionId,
  onSubmitAttendance,
  onUpdateStudentPhoto,
  onGoToLogin
}: StudentPortalProps) {
  // Current date & time helper functions
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

  // Form State
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [arrivalDate, setArrivalDate] = useState(getTodayLocalDateStr());
  const [arrivalTime, setArrivalTime] = useState(getNowLocalTimeStr());

  // Check if we are in "Time Out" mode from URL query parameters
  const params = new URLSearchParams(window.location.search);
  const isTimeOut = params.get('type') === 'out';

  // Success / Lateness / Time Out Feedback Modal State
  const [popupData, setPopupData] = useState<AttendancePopupData | null>(null);

  // Effect to pre-select section based on props or initial sections
  useEffect(() => {
    if (preselectedSectionId && sections.find(s => s.id === preselectedSectionId)) {
      setSelectedSectionId(preselectedSectionId);
    } else if (sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [preselectedSectionId, sections]);

  // Reset student selection when section changes
  useEffect(() => {
    setSelectedStudentId('');
  }, [selectedSectionId]);

  // Get current active section
  const activeSection = sections.find(s => s.id === selectedSectionId);
  const studentsList = activeSection?.students || [];
  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // Set current time helper
  const handleSetToCurrentTime = () => {
    setArrivalDate(getTodayLocalDateStr());
    setArrivalTime(getNowLocalTimeStr());
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId || !selectedStudentId || !activeSection) return;

    const student = studentsList.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Submit attendance and get lateness evaluation
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

  // Close popup modal and reset for the next student
  const handleClosePopupAndReset = () => {
    setPopupData(null);
    setSelectedStudentId('');
    // Refresh time for the next student
    setArrivalDate(getTodayLocalDateStr());
    setArrivalTime(getNowLocalTimeStr());
  };

  return (
    <div id="student-portal-root" className="max-w-2xl mx-auto">

      <AttendanceBanner isTimeOut={isTimeOut} activeSection={activeSection} onGoToLogin={onGoToLogin} />

      {sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 shadow-sm">
          <p className="font-semibold">Attendance is currently closed</p>
          <p className="text-xs text-gray-400 mt-1">The teacher hasn't created any sections yet. Please ask your instructor to set up classes.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} id="student-attendance-form" className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">

          {/* Section dropdown */}
          <div className="space-y-2">
            <label htmlFor="student-section-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <BookOpen size={14} className="text-gray-400" />
              <span>1. Choose Class Section</span>
            </label>

            <select
              id="student-section-select"
              required
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            >
              <option value="" disabled>Select Section</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} (Start: {formatTimeToAMPM(s.startTime)})</option>
              ))}
            </select>
          </div>

          <StudentNamePicker
            studentsList={studentsList}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onUpdateStudentPhoto={onUpdateStudentPhoto ? (studentId, photoUrl) => onUpdateStudentPhoto(selectedSectionId, studentId, photoUrl) : undefined}
          />

          {/* Time and Date input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-5">

            <div className="space-y-2">
              <label htmlFor="arrival-date-input" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={14} className="text-gray-400" />
                <span>Arrival Date</span>
              </label>
              <input
                id="arrival-date-input"
                type="date"
                required
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="arrival-time-input" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Clock size={14} className="text-gray-400" />
                <span>Arrival Time</span>
              </label>
              <input
                id="arrival-time-input"
                type="time"
                required
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

          </div>

          {/* Quick sync clock action */}
          <div className="flex justify-end pt-1">
            <button
              id="btn-sync-time"
              type="button"
              onClick={handleSetToCurrentTime}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer py-1"
            >
              <RefreshCw size={12} />
              <span>Reset to Current Clock</span>
            </button>
          </div>

          {/* Submit button */}
          <button
            id="btn-submit-attendance"
            type="submit"
            disabled={!selectedSectionId || !selectedStudentId}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm py-3 px-4 rounded-xl transition duration-150 shadow-xs cursor-pointer"
          >
            <Send size={16} />
            <span>Submit Arrival Records</span>
          </button>

        </form>
      )}

      <AttendanceResultModal
        popupData={popupData}
        studentPhotoUrl={selectedStudent?.photoUrl}
        onClose={handleClosePopupAndReset}
      />

    </div>
  );
}
