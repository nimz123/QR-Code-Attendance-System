import React, { useState, useEffect } from 'react';
import { Section, Student, formatTimeToAMPM } from '../types';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  User, 
  BookOpen, 
  Send, 
  RefreshCw,
  Search,
  School,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentPortalProps {
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

  teacherName?: string;
  teacherPhotoUrl?: string;
  roomName?: string;
  subjectName?: string;
  onUpdateStudentPhoto?: (
    sectionId: string,
    studentId: string,
    photoUrl: string
  ) => void;
}

export default function StudentPortal({
  sections,
  preselectedSectionId,
  onSubmitAttendance,
  teacherName = 'Instructor',
  teacherPhotoUrl,
  roomName,
  subjectName,
  onUpdateStudentPhoto
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
  
  // Name filter search state
  const [studentSearch, setStudentSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Check if we are in "Time Out" mode from URL query parameters
  const params = new URLSearchParams(window.location.search);
  const isTimeOut = params.get('type') === 'out';

  // Success / Lateness / Time Out Feedback Modal State
  const [popupData, setPopupData] = useState<{
    isOpen: boolean;
    studentName: string;
    sectionName: string;
    arrivalDate: string;
    arrivalTime: string;
    status: 'Present' | 'Late' | 'Time Out';
    startTime: string;
  } | null>(null);

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
    setStudentSearch('');
    setIsDropdownOpen(false);
  }, [selectedSectionId]);

  // Get current active section
  const activeSection = sections.find(s => s.id === selectedSectionId);
  const studentsList = activeSection?.students || [];
  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // Filter students by search input
  const filteredStudents = studentsList.filter(student =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

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


  // Close popup modal and reset for the next student
  const handleClosePopupAndReset = () => {
    setPopupData(null);
    setSelectedStudentId('');
    setStudentSearch('');
    // Refresh time for the next student
    setArrivalDate(getTodayLocalDateStr());
    setArrivalTime(getNowLocalTimeStr());
  };
}
return (
    <div id="student-portal-root" className="max-w-2xl mx-auto">
      
      {/* Banner info */}
      <div className={`rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden mb-6 ${isTimeOut ? 'bg-rose-600' : 'bg-indigo-600'}`}>
        {/* Background blobs for premium feel */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl -translate-x-6 translate-y-6"></div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {roomName && (
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs">
                <School size={12} />
                <span>Room: {roomName}</span>
              </div>
            )}
            {teacherName && teacherName !== 'Instructor' && (
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/20">
                {teacherPhotoUrl && (
                  <img 
                    src={teacherPhotoUrl} 
                    alt={teacherName} 
                    referrerPolicy="no-referrer"
                    className="w-3.5 h-3.5 rounded-full object-cover border border-white/30" 
                  />
                )}
                <span>Teacher: {teacherName}</span>
              </div>
            )}
            {subjectName && (
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/20">
                <span>Subject: {subjectName}</span>
              </div>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
            {isTimeOut ? 'Student Time-Out Portal' : 'Student Attendance Portal'}
          </h1>
          <p className="text-white/90 text-sm max-w-md leading-relaxed">
            {isTimeOut 
              ? 'Quick, open access to log class departure. Please choose your Section, find your Name, and specify your checkout details below.'
              : 'Quick, open access to log class arrival. Please choose your Section, find your Name, and specify your arrival details below.'}
          </p>
        </div>
      </div>

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

          {/* Student searchable input */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <User size={14} className="text-gray-400" />
              <span>2. Select Your Name</span>
            </label>

            {/* Custom Searchable Select Dropdown */}
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="student-name-search"
                  type="text"
                  placeholder={
                    selectedStudentId 
                      ? studentsList.find(s => s.id === selectedStudentId)?.name 
                      : "Type to search your name..."
                  }
                  value={studentSearch}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                {selectedStudentId && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                    Selected
                  </span>
                )}
              </div>

              {/* Suggestions Overlay */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-20 w-full bg-white border border-gray-200 mt-1.5 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50"
                  >
                    {filteredStudents.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 italic">
                        No students found matching "{studentSearch}"
                      </div>
                    ) : (
                      filteredStudents.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          id={`dropdown-student-item-${student.id}`}
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setStudentSearch(''); // Clear search so input shows the placeholder/selection
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-between ${
                            selectedStudentId === student.id ? 'bg-indigo-50/50 text-indigo-700' : 'text-gray-700'
                          }`}
                        >
                          <span>{student.name}</span>
                          {selectedStudentId === student.id && <CheckCircle size={14} className="text-indigo-600" />}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Click away from dropdown listener overlay */}
            {isDropdownOpen && (
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsDropdownOpen(false)}
              />
            )}
          </div>

          {/* Optional Student Photo */}
          {selectedStudentId && selectedStudent && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  {selectedStudent.photoUrl ? (
                    <img 
                      src={selectedStudent.photoUrl} 
                      alt={selectedStudent.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <User className="text-gray-400" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Your Profile Picture</span>
                  <p className="text-xs text-gray-500 font-semibold truncate">
                    {selectedStudent.photoUrl ? "Your photo is configured" : "Add your photo to your profile (Optional)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-2xs">
                    <span>{selectedStudent.photoUrl ? "Change" : "Upload"}</span>
                    <input
                      id="student-photo-upload-input"
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
                            if (typeof reader.result === 'string' && onUpdateStudentPhoto) {
                              onUpdateStudentPhoto(selectedSectionId, selectedStudentId, reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {selectedStudent.photoUrl && (
                    <button
                      id="btn-remove-student-photo"
                      type="button"
                      onClick={() => onUpdateStudentPhoto && onUpdateStudentPhoto(selectedSectionId, selectedStudentId, '')}
                      className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs px-2.5 py-1.5 rounded-xl transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

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

      {/* SYSTEM LATE OR ON-TIME MODAL POPUP */}
      <AnimatePresence>
        {popupData?.isOpen && (
          <div id="attendance-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100"
            >
              
              {/* Conditional Banner styling based on status (Late vs Time Out vs On Time) */}
              {popupData.status === 'Time Out' ? (
                <div id="modal-banner-timeout" className="bg-blue-600 text-white p-6 text-center space-y-2 relative">
                  <div className="absolute top-3 right-3 opacity-15">
                    <Clock size={100} />
                  </div>
                  <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                    <Clock size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold font-display tracking-tight uppercase">DEPARTURE RECORDED</h3>
                  <p className="text-blue-100 text-xs">Checkout time registered successfully</p>
                </div>
              ) : popupData.status === 'Late' ? (
                <div id="modal-banner-late" className="bg-rose-600 text-white p-6 text-center space-y-2 relative">
                  <div className="absolute top-3 right-3 opacity-15">
                    <XCircle size={100} />
                  </div>
                  <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                    <AlertTriangle size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold font-display tracking-tight uppercase">SYSTEM WARNING: LATE</h3>
                  <p className="text-rose-100 text-xs">Your arrival is logged past the scheduled class start time</p>
                </div>
              ) : (
                <div id="modal-banner-present" className="bg-emerald-600 text-white p-6 text-center space-y-2 relative">
                  <div className="absolute top-3 right-3 opacity-15">
                    <CheckCircle size={100} />
                  </div>
                  <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                    <CheckCircle size={32} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold font-display tracking-tight uppercase">PRESENT & ON TIME</h3>
                  <p className="text-emerald-100 text-xs">Punctuality record logged successfully</p>
                </div>
              )}
 
              {/* Modal Body Info */}
              <div id="modal-body-details" className="p-6 space-y-4">
                
                <div className="text-center">
                  {selectedStudent?.photoUrl && (
                    <div className="flex justify-center mb-2.5">
                      <img 
                        src={selectedStudent.photoUrl} 
                        alt={selectedStudent.name} 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-xs" 
                      />
                    </div>
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Student Identity</span>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{popupData.studentName}</p>
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 py-1 px-3 rounded-md inline-block border border-gray-100">
                    {popupData.sectionName}
                  </p>
                </div>

                <div className="border-t border-b border-gray-100 py-3 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      {popupData.status === 'Time Out' ? 'Departure Time' : 'Arrival Time'}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 font-mono mt-1">
                      {formatTimeToAMPM(popupData.arrivalTime)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Scheduled Start</span>
                    <p className="text-sm font-semibold text-gray-800 font-mono mt-1">
                      {formatTimeToAMPM(popupData.startTime)}
                    </p>
                  </div>
                </div>

                {popupData.status === 'Time Out' ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
                    <Clock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Departure Logged Successfully.</p>
                      <p className="mt-0.5 text-blue-700/90 leading-relaxed">
                        Have a wonderful day ahead! Keep up the hard work and review your materials before the next class.
                      </p>
                    </div>
                  </div>
                ) : popupData.status === 'Late' ? (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 flex gap-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Automatic Lateness Marker triggered.</p>
                      <p className="mt-0.5 text-rose-700/90 leading-relaxed">
                        Please proceed into the classroom quietly to minimize disruption. Remember, punctuality matters!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex gap-2">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Fantastic job arriving early!</p>
                      <p className="mt-0.5 text-emerald-700/90 leading-relaxed">
                        Your on-time attendance is securely logged. Grab your study materials and prepare for the lesson.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  id="btn-close-attendance-modal"
                  type="button"
                  onClick={handleClosePopupAndReset}
                  className={`w-full font-bold text-sm py-2.5 rounded-xl transition text-white shadow-xs ${
                    popupData.status === 'Time Out'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : popupData.status === 'Late' 
                        ? 'bg-rose-600 hover:bg-rose-700' 
                        : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Done (Ready for Next Student)
                </button>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}