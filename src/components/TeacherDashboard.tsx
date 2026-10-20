import React, { useState } from 'react';
import { Section, Student, AttendanceRecord, formatTimeToAMPM } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Clock, 
  QrCode, 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  Search, 
  Download, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Sliders,
  Sparkles,
  LogOut,
  UserPlus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TeacherDashboardProps {
  sections: Section[];
  records: AttendanceRecord[];
  onAddSection: (name: string, startTime: string) => void;
  onDeleteSection: (id: string) => void;
  onDeleteStudent: (sectionId: string, studentId: string) => void;
  onUpdateSectionTime: (sectionId: string, startTime: string) => void;
  onClearRecords: () => void;
  onUpdateStudentPhoto?: (sectionId: string, studentId: string, photoUrl: string) => void;
  onLogOut: () => void;
}

export default function TeacherDashboard({
  sections,
  records,
  onAddSection,
  onDeleteSection,
  onDeleteStudent,
  onUpdateSectionTime,
  onClearRecords,
  onUpdateStudentPhoto,
  onLogOut
}: TeacherDashboardProps) {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'qr' | 'sections' | 'records'>('qr');
  const [enlargedQR, setEnlargedQR] = useState<{ url: string; title: string; subtitle: string; type: 'in' | 'out' } | null>(null);

  // Section form state
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionTime, setNewSectionTime] = useState('08:30');

  // Expanded section state for student management UI
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  // New student form states
  const [studentName, setStudentName] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // QR code filter state
  const [selectedSectionForQR, setSelectedSectionForQR] = useState<string>('all');
  
  // Attendance records filter states
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSectionFilter, setRecordSectionFilter] = useState('all');
  const [recordStatusFilter, setRecordStatusFilter] = useState('all');
  const [recordDateFilter, setRecordDateFilter] = useState('');

  // Handle adding a new section
  const handleAddSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    onAddSection(newSectionName.trim(), newSectionTime);
    setNewSectionName('');
  };

  // Handle student account creation by teacher without page reload
  const handleAddStudent = async (e: React.FormEvent, sectionId: string) => {
    e.preventDefault();
    if (!studentName.trim() || !studentUsername.trim() || !studentPassword.trim()) {
      alert('Please complete all student information fields.');
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const { ok, data } = await apiFetch('/api/teacher/students', {
        method: 'POST',
        body: JSON.stringify({
          sectionId,
          name: studentName.trim(),
          username: studentUsername.trim(),
          password: studentPassword.trim(),
        }),
      });

      if (ok && data.success) {
        alert(`Student account created successfully for ${studentName}!`);
        
        // Directly push new student to the local section array to avoid full page reload
        const targetSection = sections.find(s => s.id === sectionId);
        if (targetSection) {
          targetSection.students = [...(targetSection.students || []), data.student];
        }

        // Reset form inputs
        setStudentName('');
        setStudentUsername('');
        setStudentPassword('');
      } else {
        alert(data.error || 'Failed to create student account.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while creating the student account.');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  // Generate target URL for QR Code scanning
  const getQRUrlForType = (type?: 'in' | 'out') => {
    const origin = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('role', 'student');
    if (selectedSectionForQR !== 'all') {
      params.set('sectionId', selectedSectionForQR);
    }
    if (type === 'out') {
      params.set('type', 'out');
    }
    return `${origin}?${params.toString()}`;
  };

  const qrUrlIn = getQRUrlForType('in');
  const qrUrlOut = getQRUrlForType('out');

  // Helper function to print QR flyers
  const handlePrintQR = (type: 'in' | 'out' = 'in') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const sectionName = selectedSectionForQR === 'all' 
      ? 'All Sections' 
      : (sections.find(s => s.id === selectedSectionForQR)?.name || 'Class');

    const titleText = type === 'out' ? 'Scan to Log Departure (Time Out)' : 'Scan to Log Attendance (Time In)';
    const instructionsText = type === 'out' 
      ? `1. Open your smartphone camera or QR Scanner.<br/>
         2. Scan the code to open the Student Time-Out Portal.<br/>
         3. Select your name and submit your departure/checkout details.`
      : `1. Open your smartphone camera or QR Scanner.<br/>
         2. Scan the code to open the Student Attendance Portal.<br/>
         3. Select your name and submit your arrival/entry details.`;

    const qrSvg = document.getElementById(type === 'out' ? 'departure-qr-svg' : 'attendance-qr-svg');
    let svgHTML = '';
    if (qrSvg) {
      const clone = qrSvg.cloneNode(true) as SVGElement;
      clone.setAttribute('width', '350');
      clone.setAttribute('height', '350');
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(clone);
      svgHTML = tempDiv.innerHTML;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleText} - ${sectionName}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px;
              color: #1f2937;
              background-color: #ffffff;
            }
            .container {
              border: 3px double #e5e7eb;
              padding: 40px;
              display: inline-block;
              border-radius: 24px;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
              max-width: 500px;
            }
            h1 { font-size: 28px; margin-bottom: 8px; color: #111827; font-weight: 800; }
            p { font-size: 16px; color: #4b5563; margin-bottom: 30px; }
            .qr-placeholder {
              margin: 30px auto;
              padding: 20px;
              background: white;
              border-radius: 16px;
              display: inline-block;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .instructions {
              font-size: 14px;
              color: #4b5563;
              margin-top: 30px;
              max-width: 440px;
              line-height: 1.6;
              text-align: left;
              background: #f9fafb;
              padding: 16px 20px;
              border-radius: 12px;
              border: 1px solid #f3f4f6;
            }
            .footer {
              margin-top: 50px;
              font-size: 12px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${titleText}</h1>
            <p>Section: <strong>${sectionName}</strong></p>
            <div class="qr-placeholder" id="qr-container">
              ${svgHTML}
            </div>
            <div class="instructions">
              <strong>Instructions:</strong><br/>
              <div style="margin-top: 6px;">
                ${instructionsText}
              </div>
            </div>
            <div class="footer">QR Attendance Portal • No Login Required</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter attendance records based on current search and filter criteria
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.studentName.toLowerCase().includes(recordSearch.toLowerCase());
    const matchesSection = recordSectionFilter === 'all' || record.sectionId === recordSectionFilter;
    const matchesStatus = recordStatusFilter === 'all' || record.status === recordStatusFilter;
    const matchesDate = !recordDateFilter || record.date === recordDateFilter;
    return matchesSearch && matchesSection && matchesStatus && matchesDate;
  });

  // Calculate statistics metrics
  const totalLogs = records.length;
  const lateLogs = records.filter(r => r.status === 'Late').length;
  const presentLogs = totalLogs - lateLogs;
  const latePercentage = totalLogs > 0 ? Math.round((lateLogs / totalLogs) * 100) : 0;
  const presentPercentage = totalLogs > 0 ? Math.round((presentLogs / totalLogs) * 100) : 0;

  return (
    <div id="teacher-dashboard-root" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar Navigation */}
      <div id="teacher-sidebar" className="lg:col-span-1 bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 p-5 shadow-sm space-y-2 h-fit">
        <div className="px-3 py-2 mb-4">
          <div className="flex items-center gap-2 text-indigo-600 font-display font-bold text-lg">
            <Sliders size={20} className="stroke-2" />
            <span>Teacher Console</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Configure classes and logs</p>
        </div>

        <button
          id="tab-btn-qr"
          onClick={() => setActiveTab('qr')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'qr' ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <QrCode size={18} />
          <span>Attendance QR Code</span>
        </button>

        <button
          id="tab-btn-sections"
          onClick={() => setActiveTab('sections')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'sections' ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Users size={18} />
          <span>Class List & Sections</span>
        </button>

        <button
          id="tab-btn-records"
          onClick={() => setActiveTab('records')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'records' ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileSpreadsheet size={18} />
          <span>Attendance Records</span>
          {records.length > 0 && (
            <span className="ml-auto bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {records.length}
            </span>
          )}
        </button>

        <div className="pt-6 border-t border-gray-100 mt-6 space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 flex gap-2.5">
            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Student Management</p>
              <p className="mt-1 text-indigo-700/90 leading-normal">
                Expand any class section below to register new students directly into your roster.
              </p>
            </div>
          </div>

          <button
            id="sidebar-logout-btn"
            type="button"
            onClick={onLogOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-100 transition duration-150 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Lock & Log Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div id="teacher-main-content" className="lg:col-span-3 space-y-6">
        
        {/* Statistics Banner Overview */}
        <div id="stats-banner" className="grid grid-cols-3 gap-4 bg-white/75 backdrop-blur-md p-4 rounded-2xl border border-gray-100 shadow-xs">
          <div className="text-center p-2 border-r border-gray-100">
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold">Total Logs</span>
            <span className="text-2xl font-bold font-display text-gray-900 mt-1 block">{totalLogs}</span>
          </div>
          <div className="text-center p-2 border-r border-gray-100">
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold text-green-600">On Time</span>
            <span className="text-2xl font-bold font-display text-green-600 mt-1 block">{presentLogs} <span className="text-xs text-gray-400 font-normal">({presentPercentage}%)</span></span>
          </div>
          <div className="text-center p-2">
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold text-rose-600">Late Arrivals</span>
            <span className="text-2xl font-bold font-display text-rose-600 mt-1 block">{lateLogs} <span className="text-xs text-gray-400 font-normal">({latePercentage}%)</span></span>
          </div>
        </div>

        {/* TAB 1: ATTENDANCE QR CODE */}
        {activeTab === 'qr' && (
          <div id="tab-pane-qr" className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-5 gap-4">
              <div>
                <h2 className="text-2xl font-bold font-display text-gray-900 tracking-tight">Interactive Classroom QR Codes</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Students scan these code tiles to log arrival or departure. Tap any QR code to enlarge it for your projector screen!
                </p>
              </div>
              
              <div className="flex items-center gap-2.5 shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter Section:</span>
                <select
                  id="qr-section-select"
                  value={selectedSectionForQR}
                  onChange={(e) => setSelectedSectionForQR(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Sections (Universal QR)</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* QR CARD 1: TIME IN (CHECK-IN) */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100/80 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Entry / Check-In
                    </span>
                    <span className="text-xs text-gray-400 font-medium font-mono">Type: In</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-3">Time In QR Code</h3>
                </div>

                <div className="flex flex-col items-center py-2">
                  <button
                    type="button"
                    onClick={() => setEnlargedQR({
                      url: qrUrlIn,
                      title: 'Time In QR Code',
                      subtitle: selectedSectionForQR === 'all' ? 'Universal Code (All Sections)' : (sections.find(s => s.id === selectedSectionForQR)?.name || 'Class Specific'),
                      type: 'in'
                    })}
                    className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 cursor-pointer hover:scale-105 transition duration-200 group"
                  >
                    <QRCodeSVG 
                      id="attendance-qr-svg"
                      value={qrUrlIn} 
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                    <span className="text-[10px] font-bold text-indigo-600 block text-center mt-2 group-hover:underline">
                      🔎 Click to Enlarge Code
                    </span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-print-qr-in"
                      onClick={() => handlePrintQR('in')}
                      className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Print Flyer</span>
                    </button>
                    <a
                      href={qrUrlIn}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs py-2.5 px-3 rounded-xl transition text-center"
                    >
                      <span>Open Link</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* QR CARD 2: TIME OUT (CHECK-OUT) */}
              <div className="bg-gradient-to-br from-rose-50/50 to-white border border-rose-100/80 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Exit / Check-Out
                    </span>
                    <span className="text-xs text-gray-400 font-medium font-mono">Type: Out</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-3">Time Out QR Code</h3>
                </div>

                <div className="flex flex-col items-center py-2">
                  <button
                    type="button"
                    onClick={() => setEnlargedQR({
                      url: qrUrlOut,
                      title: 'Time Out QR Code',
                      subtitle: selectedSectionForQR === 'all' ? 'Universal Code (All Sections)' : (sections.find(s => s.id === selectedSectionForQR)?.name || 'Class Specific'),
                      type: 'out'
                    })}
                    className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 cursor-pointer hover:scale-105 transition duration-200 group"
                  >
                    <QRCodeSVG 
                      id="departure-qr-svg"
                      value={qrUrlOut} 
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                    <span className="text-[10px] font-bold text-rose-600 block text-center mt-2 group-hover:underline">
                      🔎 Click to Enlarge Code
                    </span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-print-qr-out"
                      onClick={() => handlePrintQR('out')}
                      className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Print Flyer</span>
                    </button>
                    <a
                      href={qrUrlOut}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs py-2.5 px-3 rounded-xl transition text-center"
                    >
                      <span>Open Link</span>
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: CLASS LIST & SECTIONS MANAGEMENT */}
        {activeTab === 'sections' && (
          <div id="tab-pane-sections" className="space-y-6">
            
            {/* Create Section Form */}
            <div id="section-creator" className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
              <h3 className="text-lg font-bold font-display text-gray-900 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                <span>Create New Section & Class Time</span>
              </h3>
              
              <form onSubmit={handleAddSectionSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label htmlFor="input-section-name" className="text-xs font-bold text-gray-600 uppercase tracking-wider">Section Name</label>
                  <input
                    id="input-section-name"
                    type="text"
                    required
                    placeholder=""
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="input-section-time" className="text-xs font-bold text-gray-600 uppercase tracking-wider">Designated Start Time</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="input-section-time"
                      type="time"
                      required
                      value={newSectionTime}
                      onChange={(e) => setNewSectionTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  id="btn-add-section"
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 h-[42px] cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Create Class Section</span>
                </button>
              </form>
            </div>

            {/* Class List & Direct Student Account Creation */}
            <div id="student-list-manager" className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
              <div id="section-lists-preview" className="space-y-4">
                <h3 className="text-base font-bold text-gray-900">Current Class Lists</h3>

                {sections.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No class sections created yet. Create a section using the form above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sections.map((section) => {
                      const isExpanded = expandedSectionId === section.id;
                      const studentCount = section.students?.length || 0;

                      return (
                        <div key={section.id} id={`section-card-${section.id}`} className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-base text-gray-900">{section.name}</span>
                                <button
                                  onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                                  className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-lg hover:bg-indigo-100 cursor-pointer"
                                >
                                  <UserPlus size={14} />
                                  <span>{isExpanded ? 'Hide Form' : '+ Add / View Students'}</span>
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </div>

                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} /> Start Time: {formatTimeToAMPM(section.startTime)}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Users size={12} /> {studentCount} {studentCount === 1 ? 'Student' : 'Students'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={section.startTime}
                                onChange={(e) => onUpdateSectionTime(section.id, e.target.value)}
                                className="bg-white border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 text-gray-800 font-medium"
                              />
                              <button
                                id={`btn-delete-section-${section.id}`}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete section ${section.name}?`)) {
                                    onDeleteSection(section.id);
                                  }
                                }}
                                className="p-2 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete Class Section"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* EXPANDED SECTION: TEACHER STUDENT CREATION FORM & ROSTER */}
                          {isExpanded && (
                            <div className="border-t border-gray-200/60 pt-4 space-y-4">
                              <form
                                onSubmit={(e) => handleAddStudent(e, section.id)}
                                className="bg-white p-4 rounded-xl border border-gray-200 space-y-3"
                              >
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                  <UserPlus size={14} />
                                  <span>Register Student to {section.name}</span>
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Full Name</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Juan Dela Cruz"
                                      value={studentName}
                                      onChange={(e) => setStudentName(e.target.value)}
                                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Username</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="juan123"
                                      value={studentUsername}
                                      onChange={(e) => setStudentUsername(e.target.value)}
                                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900"
                                    />
                                  </div>

                                  <div className="relative">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Password</label>
                                    <div className="relative">
                                      <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        placeholder="••••••••"
                                        value={studentPassword}
                                        onChange={(e) => setStudentPassword(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-gray-900"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                      >
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    type="submit"
                                    disabled={isSubmittingStudent}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <UserPlus size={14} />
                                    <span>{isSubmittingStudent ? 'Creating...' : 'Save Student Account'}</span>
                                  </button>
                                </div>
                              </form>

                              {/* Student Roster List */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registered Roster</h4>

                                {studentCount === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No students registered in this section yet. Use the form above to add students.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {section.students?.map((st) => (
                                      <div
                                        key={st.id}
                                        id={`student-badge-${st.id}`}
                                        className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl text-xs"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center uppercase">
                                            {st.name.charAt(0)}
                                          </div>
                                          <div>
                                            <span className="font-bold text-gray-900 block">{st.name}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">@{st.username}</span>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => onDeleteStudent(section.id, st.id)}
                                          className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                                          title="Remove Student"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
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
          </div>
        )}

        {/* TAB 3: ATTENDANCE RECORDS */}
        {activeTab === 'records' && (
          <div id="tab-pane-records" className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-5 gap-4">
              <div>
                <h2 className="text-2xl font-bold font-display text-gray-900 tracking-tight">Attendance Records</h2>
                <p className="text-sm text-gray-500 mt-1">Filter, review, and export student attendance logs.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (records.length === 0) return;
                    const headers = ['Student Name', 'Section', 'Arrive Date', 'Arrive Time', 'Status', 'Timestamp'];
                    const rows = records.map(r => [r.studentName, r.sectionName, r.date, r.time, r.status, r.timestamp]);
                    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
                    const link = document.createElement("a");
                    link.setAttribute("href", encodeURI(csvContent));
                    link.setAttribute("download", `Attendance_Records_${new Date().toISOString().slice(0,10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  disabled={records.length === 0}
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all attendance records?')) {
                      onClearRecords();
                    }
                  }}
                  disabled={records.length === 0}
                  className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Filter tools */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student name..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={recordSectionFilter}
                onChange={(e) => setRecordSectionFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Sections</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={recordStatusFilter}
                onChange={(e) => setRecordStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="Present">Present (On Time)</option>
                <option value="Late">Late</option>
              </select>

              <input
                type="date"
                value={recordDateFilter}
                onChange={(e) => setRecordDateFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Attendance logs table */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold sticky top-0 border-b border-gray-100">
                    <tr>
                      <th className="p-3.5">Student Name</th>
                      <th className="p-3.5">Section</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Time Logged</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">
                          No attendance records found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50/50">
                          <td className="p-3.5 font-bold text-gray-800">{rec.studentName}</td>
                          <td className="p-3.5 text-gray-600">{rec.sectionName}</td>
                          <td className="p-3.5 text-gray-600">{rec.date}</td>
                          <td className="p-3.5 font-mono text-gray-600">{rec.time}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              rec.status === 'Late' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Enlarged QR Code Modal */}
      <AnimatePresence>
        {enlargedQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEnlargedQR(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 ${
                  enlargedQR.type === 'out' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {enlargedQR.title}
                </span>
                <h3 className="text-xl font-bold text-gray-900">{enlargedQR.subtitle}</h3>
                <p className="text-xs text-gray-500 mt-1">Scan using smartphone camera to access portal.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 inline-block mx-auto">
                <QRCodeSVG value={enlargedQR.url} size={260} level="H" includeMargin={true} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePrintQR(enlargedQR.type)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  <span>Print Flyer</span>
                </button>
                <button
                  onClick={() => setEnlargedQR(null)}
                  className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}