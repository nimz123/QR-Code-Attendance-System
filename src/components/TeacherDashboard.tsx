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
  LogOut
} from 'lucide-react';

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
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'qr' | 'sections' | 'records'>('qr');
  const [enlargedQR, setEnlargedQR] = useState<{ url: string; title: string; subtitle: string; type: 'in' | 'out' } | null>(null);

  // Section form state
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionTime, setNewSectionTime] = useState('08:30');

  // QR code state
  const [selectedSectionForQR, setSelectedSectionForQR] = useState<string>('all');
  
  // Records filter state
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSectionFilter, setRecordSectionFilter] = useState('all');
  const [recordStatusFilter, setRecordStatusFilter] = useState('all');
  const [recordDateFilter, setRecordDateFilter] = useState('');

  // Handle adding new section
  const handleAddSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    onAddSection(newSectionName.trim(), newSectionTime);
    setNewSectionName('');
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

  // Print QR Code helper
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

  // Export Records as CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    
    // Headers
    const headers = ['Student Name', 'Section', 'Arrive Date', 'Arrive Time', 'Status', 'Timestamp'];
    const rows = records.map(r => [
      r.studentName,
      r.sectionName,
      r.date,
      r.time,
      r.status,
      r.timestamp
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter records
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.studentName.toLowerCase().includes(recordSearch.toLowerCase());
    const matchesSection = recordSectionFilter === 'all' || record.sectionId === recordSectionFilter;
    const matchesStatus = recordStatusFilter === 'all' || record.status === recordStatusFilter;
    const matchesDate = !recordDateFilter || record.date === recordDateFilter;
    return matchesSearch && matchesSection && matchesStatus && matchesDate;
  });

  // Calculate statistics
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
            activeTab === 'qr'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <QrCode size={18} />
          <span>Attendance QR Code</span>
        </button>

        <button
          id="tab-btn-sections"
          onClick={() => setActiveTab('sections')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'sections'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Users size={18} />
          <span>Class List & Sections</span>
        </button>

        <button
          id="tab-btn-records"
          onClick={() => setActiveTab('records')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'records'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border-l-4 border-indigo-600'
              : 'text-gray-600 hover:bg-gray-50'
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
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2.5">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Student Accounts</p>
              <p className="mt-1 text-amber-700/90 leading-normal">
                Student accounts are created by an administrator. You can remove a student from your roster below, but new accounts must be added via the Admin Dashboard.
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
        
        {/* STATS OVERVIEW (Compact top banner) */}
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

            {/* DUAL QR CODES CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* QR CARD 1: TIME IN (ARRIVAL) */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100/80 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Entry / Check-In
                    </span>
                    <span className="text-xs text-gray-400 font-medium font-mono">Type: In</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-3">Time In QR Code</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Designed for students arriving to class. Evaluation is based on designated start times to flag on-time or late arrivals.
                  </p>
                </div>

                <div className="flex flex-col items-center py-2">
                  <button
                    type="button"
                    title="Click to enlarge"
                    onClick={() => setEnlargedQR({
                      url: qrUrlIn,
                      title: 'Time In QR Code',
                      subtitle: selectedSectionForQR === 'all' 
                        ? 'Universal Code (All Sections)' 
                        : (sections.find(s => s.id === selectedSectionForQR)?.name || 'Class Specific'),
                      type: 'in'
                    })}
                    className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 cursor-pointer hover:scale-105 hover:shadow-md transition duration-200 group"
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
                  <span className="text-[11px] font-semibold text-gray-600 mt-3 font-mono bg-white px-3 py-1 rounded-full border border-gray-100">
                    {selectedSectionForQR === 'all' 
                      ? 'Universal Link' 
                      : `${sections.find(s => s.id === selectedSectionForQR)?.name || 'Class'} (Arrival)`}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-white/80 border border-gray-100 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Entry Link:</span>
                    <code className="text-[10px] font-mono break-all text-gray-600 select-all block mt-0.5">{qrUrlIn}</code>
                  </div>
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

              {/* QR CARD 2: TIME OUT (DEPARTURE) */}
              <div className="bg-gradient-to-br from-rose-50/50 to-white border border-rose-100/80 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Exit / Check-Out
                    </span>
                    <span className="text-xs text-gray-400 font-medium font-mono">Type: Out</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-3">Time Out QR Code</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Designed for students leaving class or checking out. Helps monitor who left and records their precise checkout times.
                  </p>
                </div>

                <div className="flex flex-col items-center py-2">
                  <button
                    type="button"
                    title="Click to enlarge"
                    onClick={() => setEnlargedQR({
                      url: qrUrlOut,
                      title: 'Time Out QR Code',
                      subtitle: selectedSectionForQR === 'all' 
                        ? 'Universal Code (All Sections)' 
                        : (sections.find(s => s.id === selectedSectionForQR)?.name || 'Class Specific'),
                      type: 'out'
                    })}
                    className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 cursor-pointer hover:scale-105 hover:shadow-md transition duration-200 group"
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
                  <span className="text-[11px] font-semibold text-gray-600 mt-3 font-mono bg-white px-3 py-1 rounded-full border border-gray-100">
                    {selectedSectionForQR === 'all' 
                      ? 'Universal Link' 
                      : `${sections.find(s => s.id === selectedSectionForQR)?.name || 'Class'} (Departure)`}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-white/80 border border-gray-100 rounded-xl p-3">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Exit Link:</span>
                    <code className="text-[10px] font-mono break-all text-gray-600 select-all block mt-0.5">{qrUrlOut}</code>
                  </div>
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

            {/* General instructions bar */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-start gap-3">
              <Sparkles className="text-indigo-500 mt-0.5 shrink-0" size={16} />
              <div className="text-xs text-gray-600 leading-relaxed">
                <p className="font-bold text-gray-800">Presentation Tip</p>
                <p className="mt-0.5 text-gray-500">
                  Project these codes on your classroom screen. Students can scan their device camera directly from the screen while remaining seated. The Time Out code is perfect to present during the last 5 minutes of class for efficient dismissal!
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CLASS LIST & SECTIONS CUSTOMIZATION */}
        {activeTab === 'sections' && (
          <div id="tab-pane-sections" className="space-y-6">
            
            {/* Create new section and customize start time */}
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
                    placeholder=" "
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
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 h-[42px]"
                >
                  <Plus size={16} />
                  <span>Create Class Section</span>
                </button>
              </form>
            </div>

            {/* Class list preview (student accounts are created via the Admin Dashboard) */}
            <div id="student-list-manager" className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
              <div id="section-lists-preview" className="space-y-4">
                <h3 className="text-base font-bold text-gray-900">Current Class Lists</h3>

                {sections.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No sections created yet. Create a class section first!
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {sections.map((section) => (
                      <div key={section.id} id={`section-card-${section.id}`} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-gray-800 block">{section.name}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock size={10} />
                                Start Time: {formatTimeToAMPM(section.startTime)}
                              </span>
                              <span className="text-[10px] bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-md">
                                {section.students.length} Students
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={section.startTime}
                              onChange={(e) => onUpdateSectionTime(section.id, e.target.value)}
                              title="Update start time"
                              className="bg-white border border-gray-200 text-xs rounded-md px-1.5 py-0.5 w-[75px] focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              id={`btn-delete-section-${section.id}`}
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${section.name}? This will also delete all students in this section.`)) {
                                  onDeleteSection(section.id);
                                }
                              }}
                              className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                              title="Delete Class Section"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* List of students */}
                        {section.students.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No students in this class yet. Ask an admin to create student accounts for this section.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
                            {section.students.map((student) => (
                              <div
                                key={student.id}
                                id={`student-badge-${student.id}`}
                                className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-700 group hover:border-indigo-200 hover:shadow-2xs transition"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Student Photo */}
                                  <div className="relative group/photo shrink-0">
                                    {student.photoUrl ? (
                                      <img 
                                        src={student.photoUrl} 
                                        alt={student.name} 
                                        referrerPolicy="no-referrer"
                                        className="w-7 h-7 rounded-full object-cover border border-gray-200" 
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400">
                                        <span className="text-[9px] font-bold font-mono">ID</span>
                                      </div>
                                    )}
                                    {/* Upload/Overlay trigger on hover */}
                                    <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition cursor-pointer text-[8px] text-white font-bold font-mono">
                                      <span>UP</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                              alert('File is too large. Max is 2MB.');
                                              return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              if (typeof reader.result === 'string' && onUpdateStudentPhoto) {
                                                onUpdateStudentPhoto(section.id, student.id, reader.result);
                                              }
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold block truncate text-gray-800" title={student.name}>{student.name}</span>
                                    {student.photoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => onUpdateStudentPhoto && onUpdateStudentPhoto(section.id, student.id, '')}
                                        className="text-[9px] text-rose-500 hover:text-rose-700 font-bold block"
                                      >
                                        Remove Photo
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  id={`btn-delete-student-${student.id}`}
                                  onClick={() => onDeleteStudent(section.id, student.id)}
                                  className="text-gray-300 hover:text-rose-600 p-1 hover:bg-gray-50 rounded-md transition"
                                  title="Delete Student"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: ATTENDANCE RECORDS LOGS */}
        {activeTab === 'records' && (
          <div id="tab-pane-records" className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
            
            {/* Header & Export/Clear Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900">Attendance Log Registry</h2>
                <p className="text-sm text-gray-500 mt-1">Review student arrival times and status indicators.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-export-csv"
                  onClick={handleExportCSV}
                  disabled={records.length === 0}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-medium text-xs px-3.5 py-2 rounded-xl transition"
                >
                  <Download size={14} />
                  <span>CSV Export</span>
                </button>
                <button
                  id="btn-clear-logs"
                  onClick={() => {
                    if (confirm('Are you sure you want to permanently delete all attendance logs? This cannot be undone.')) {
                      onClearRecords();
                    }
                  }}
                  disabled={records.length === 0}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-600 font-medium text-xs px-3.5 py-2 rounded-xl transition"
                >
                  <Trash2 size={14} />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div id="logs-filters" className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              
              {/* Search */}
              <div className="space-y-1.5">
                <label htmlFor="filter-search" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Search Student</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="filter-search"
                    type="text"
                    placeholder="Search name..."
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Class Section */}
              <div className="space-y-1.5">
                <label htmlFor="filter-section" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Section</label>
                <select
                  id="filter-section"
                  value={recordSectionFilter}
                  onChange={(e) => setRecordSectionFilter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Sections</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Lateness Status */}
              <div className="space-y-1.5">
                <label htmlFor="filter-status" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Status</label>
                <select
                  id="filter-status"
                  value={recordStatusFilter}
                  onChange={(e) => setRecordStatusFilter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Present">Present (On Time)</option>
                  <option value="Late">Late Arrival</option>
                </select>
              </div>

              {/* Specific Date */}
              <div className="space-y-1.5">
                <label htmlFor="filter-date" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Arrival Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="filter-date"
                    type="date"
                    value={recordDateFilter}
                    onChange={(e) => setRecordDateFilter(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

            </div>

            {/* Attendance Table */}
            <div id="attendance-table-container" className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Class Section</th>
                    <th className="py-3 px-4">Arrive Date</th>
                    <th className="py-3 px-4">Arrive Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Log Timestamp</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-gray-700 divide-y divide-gray-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400 italic">
                        No attendance logs match the current filters or no logs submitted yet.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr 
                        key={record.id} 
                        id={`log-row-${record.id}`} 
                        className={`hover:bg-gray-50/50 transition-colors ${record.status === 'Late' ? 'bg-rose-50/10' : ''}`}
                      >
                        <td className="py-2.5 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2.5">
                            {record.studentPhotoUrl ? (
                              <img 
                                src={record.studentPhotoUrl} 
                                alt={record.studentName} 
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover border border-gray-150 shadow-xs shrink-0" 
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-150 flex items-center justify-center text-gray-400 font-mono text-[9px] font-bold shrink-0">
                                ID
                              </div>
                            )}
                            <span className="truncate max-w-[150px]">{record.studentName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">{record.sectionName}</td>
                        <td className="py-3.5 px-4 text-gray-600 font-mono">{record.date}</td>
                        <td className="py-3.5 px-4 text-gray-600 font-mono font-medium">{record.time}</td>
                        <td className="py-3.5 px-4">
                          {record.status === 'Late' ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full border border-rose-100">
                              <AlertTriangle size={11} className="shrink-0" />
                              <span>LATE</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-100">
                              <CheckCircle size={11} className="shrink-0" />
                              <span>On Time</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-400 font-mono text-[11px]">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <p>Showing {filteredRecords.length} of {records.length} total logs</p>
              <div className="flex gap-4">
                <span>Present: <strong>{filteredRecords.filter(r => r.status === 'Present').length}</strong></span>
                <span>Late: <strong className="text-rose-600">{filteredRecords.filter(r => r.status === 'Late').length}</strong></span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* FULL-SCREEN INTERACTIVE ENLARGED QR LIGHTBOX */}
      <AnimatePresence>
        {enlargedQR && (
          <div 
            id="qr-lightbox-overlay" 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[9999]"
            onClick={() => setEnlargedQR(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 text-center space-y-6 relative border border-gray-100 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                id="btn-close-lightbox"
                type="button"
                onClick={() => setEnlargedQR(null)}
                className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full w-8 h-8 flex items-center justify-center transition cursor-pointer font-bold"
              >
                ✕
              </button>

              <div className="space-y-1">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  enlargedQR.type === 'out' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {enlargedQR.type === 'out' ? 'Class Departure / Check-Out' : 'Class Arrival / Check-In'}
                </span>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{enlargedQR.title}</h3>
                <p className="text-xs text-gray-500 font-semibold">{enlargedQR.subtitle}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl inline-block border border-gray-100 shadow-lg mx-auto">
                <QRCodeSVG 
                  id={enlargedQR.type === 'out' ? 'departure-qr-svg-large' : 'attendance-qr-svg-large'}
                  value={enlargedQR.url} 
                  size={260}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-700">Scan code with phone camera to log instant status</p>
                <div className="bg-gray-50 rounded-xl p-3 max-w-sm mx-auto border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Target Address:</span>
                  <code className="text-[10px] font-mono text-gray-500 break-all select-all">{enlargedQR.url}</code>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="btn-lightbox-done"
                  type="button"
                  onClick={() => setEnlargedQR(null)}
                  className={`w-full py-3 font-bold text-sm text-white rounded-xl shadow-xs transition ${
                    enlargedQR.type === 'out' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Done & Close Projection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
