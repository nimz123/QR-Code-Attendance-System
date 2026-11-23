import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Settings,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  Calendar,
  User,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  WifiOff,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle
} from 'lucide-react';
import { readTeacherPhotoGlobal, readStudentPhotoGlobal } from './photoSync';

interface StudentAttendanceHistoryProps {
  studentName: string;
  onLogOut: () => void;
}

type AttendanceStatusType = 'Present' | 'Late' | 'Absent' | 'No Class' | 'Time Out';

interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  sectionName: string;
  type: 'In' | 'Out';
  status: AttendanceStatusType;
  subject?: string;
}

interface RegisteredTeacherInfo {
  id: string;
  name: string;
  email: string;
  avatar: string;
  sectionName: string;
  subjectName: string;
}

const TEACHER_API_ENDPOINTS = [
  '/api/student/my-teacher',
  '/api/student/teacher',
  '/api/teachers',
  '/api/admin/teachers',
  '/api/auth/me'
];

export default function StudentAttendanceHistory({ studentName, onLogOut }: StudentAttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>('');
  const [isBypassSafe, setIsBypassSafe] = useState<boolean>(true);

  // Per-section Hide Details / Show Details toggles
  const [showTeacherDetails, setShowTeacherDetails] = useState<boolean>(true);
  const [showCalendarDetails, setShowCalendarDetails] = useState<boolean>(true);
  const [showLogsDetails, setShowLogsDetails] = useState<boolean>(true);

  // Teacher info assigned by Admin for this student
  const [myTeacher, setMyTeacher] = useState<RegisteredTeacherInfo>({
    id: 'lorenzo',
    name: 'Lorenzo Birao',
    email: 'Lorenzo@edu.com',
    avatar: '',
    sectionName: 'A-1',
    subjectName: 'PE'
  });

  // Opens when student clicks the teacher's name (shows ONLY teacher circle picture + student's assigned subject & section)
  const [isTeacherFullViewOpen, setIsTeacherFullViewOpen] = useState<boolean>(false);

  // Clickable calendar state
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Profile & Security modal states
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [modalError, setModalError] = useState('');

  // Validate image source
  const isValidImageSource = useCallback((val: unknown): val is string => {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim().replace(/^"+|"+$/g, '');
    if (!trimmed || trimmed.length < 5 || trimmed.toLowerCase().includes('text/html')) return false;
    return (
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/')
    );
  }, []);

  // Extract photo from any nested teacher object
  const extractPhoto = useCallback(
    (obj: any): string => {
      if (!obj || typeof obj !== 'object') return '';
      const candidates = [
        obj.photoUrl,
        obj.photoURL,
        obj.avatar,
        obj.avatarUrl,
        obj.teacherPhotoUrl,
        obj.teacherAvatar,
        obj.picture,
        obj.image,
        obj.photo,
        obj.profilePic,
        obj.profilePicture,
        obj.user?.photoUrl,
        obj.user?.avatar,
        obj.teacher?.photoUrl,
        obj.teacher?.avatar
      ];
      for (const c of candidates) {
        if (isValidImageSource(c)) return c.trim().replace(/^"+|"+$/g, '');
      }
      return '';
    },
    [isValidImageSource]
  );

  // Deep scan across photoSync + all localStorage/sessionStorage keys so teacher photo never misses
  const resolveTeacherPhotoEverywhere = useCallback(
    (teacherId?: string, teacherName?: string, teacherEmail?: string, candidateObj?: any) => {
      // 1. Direct object check
      const direct = extractPhoto(candidateObj);
      if (direct) return direct;

      // 2. Global photoSync helper
      try {
        const synced = readTeacherPhotoGlobal({
          id: teacherId,
          name: teacherName,
          email: teacherEmail
        });
        if (isValidImageSource(synced)) return synced.trim();
      } catch {}

      // 3. Scan every key in localStorage and sessionStorage
      const cleanId = String(teacherId || '').trim().toLowerCase();
      const cleanName = String(teacherName || '')
        .replace(/^Teacher\s+/i, '')
        .trim()
        .toLowerCase();
      const cleanEmail = String(teacherEmail || '').trim().toLowerCase();

      let exactPhoto = '';
      let anyTeacherPhoto = '';

      const inspectNode = (node: any, keyHint = '') => {
        if (!node) return;
        if (typeof node === 'string') {
          if (isValidImageSource(node) && keyHint.toLowerCase().includes('teacher') && !exactPhoto) {
            exactPhoto = node.trim().replace(/^"+|"+$/g, '');
          }
          return;
        }
        if (Array.isArray(node)) {
          for (const entry of node) inspectNode(entry, keyHint);
          return;
        }
        if (typeof node === 'object') {
          const role = String(node.role || '').trim().toLowerCase();
          const nId = String(node.teacherId || node.id || '').trim().toLowerCase();
          const nName = String(node.teacherName || node.name || node.username || '')
            .replace(/^Teacher\s+/i, '')
            .trim()
            .toLowerCase();
          const nEmail = String(node.teacherEmail || node.email || '').trim().toLowerCase();
          const foundImg = extractPhoto(node);

          const isMatch =
            (cleanId && nId && cleanId === nId) ||
            (cleanEmail && nEmail && cleanEmail === nEmail) ||
            (cleanName &&
              nName &&
              (cleanName === nName || nName.includes(cleanName) || cleanName.includes(nName)));

          if (foundImg) {
            if (isMatch) {
              exactPhoto = foundImg;
            } else if (
              (role === 'teacher' || keyHint.toLowerCase().includes('teacher')) &&
              !anyTeacherPhoto
            ) {
              anyTeacherPhoto = foundImg;
            }
          }

          for (const [k, v] of Object.entries(node)) {
            if (v && typeof v === 'object') inspectNode(v, `${keyHint}.${k}`);
          }
        }
      };

      for (const store of [localStorage, sessionStorage]) {
        try {
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (!k) continue;
            const raw = store.getItem(k);
            if (!raw) continue;
            if (isValidImageSource(raw)) {
              inspectNode(raw, k);
              continue;
            }
            try {
              inspectNode(JSON.parse(raw), k);
            } catch {}
          }
        } catch {}
      }

      return exactPhoto || anyTeacherPhoto || '';
    },
    [extractPhoto, isValidImageSource]
  );

  // Sync teacher profile picture, subject, and section from storage + backend API
  const syncTeacherAndStudentData = useCallback(async () => {
    // Sync student photo if stored
    try {
      const stuPhoto = readStudentPhotoGlobal({ name: studentName });
      if (isValidImageSource(stuPhoto)) {
        setCurrentPhotoUrl((prev) => prev || stuPhoto);
      }
    } catch {}

    // Scan storage for assigned teacher, subject, section, and teacher photo
    const cleanStudent = String(studentName || '').trim().toLowerCase();
    let foundTeacher: any = null;
    let assignedSubject = '';
    let assignedSection = '';

    for (const store of [localStorage, sessionStorage]) {
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          const raw = store.getItem(k);
          if (!raw) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            continue;
          }

          const items = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.assignments)
            ? parsed.assignments
            : Array.isArray(parsed?.students)
            ? parsed.students
            : Array.isArray(parsed?.teachers)
            ? parsed.teachers
            : [];

          for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const itemStudent = String(
              item.studentName || item.student?.name || item.username || ''
            )
              .trim()
              .toLowerCase();

            if (cleanStudent && itemStudent === cleanStudent) {
              foundTeacher = item.teacher || item;
              if (!assignedSubject) assignedSubject = item.subjectName || item.subject || '';
              if (!assignedSection) assignedSection = item.sectionName || item.section || '';
            } else if (
              !foundTeacher &&
              (String(item.role || '').toLowerCase() === 'teacher' ||
                k.toLowerCase().includes('teacher'))
            ) {
              foundTeacher = item;
            }
          }
        }
      } catch {}
    }

    setMyTeacher((prev) => {
      const nextId = foundTeacher?.teacherId || foundTeacher?.id || prev.id;
      const nextName =
        String(foundTeacher?.teacherName || foundTeacher?.name || prev.name)
          .replace(/^Teacher\s+/i, '')
          .trim() || prev.name;
      const nextEmail = foundTeacher?.teacherEmail || foundTeacher?.email || prev.email;
      const resolvedPhoto =
        resolveTeacherPhotoEverywhere(nextId, nextName, nextEmail, foundTeacher) || prev.avatar;

      return {
        id: nextId,
        name: nextName,
        email: nextEmail,
        avatar: resolvedPhoto,
        sectionName: assignedSection || foundTeacher?.sectionName || prev.sectionName,
        subjectName: assignedSubject || foundTeacher?.subjectName || prev.subjectName
      };
    });

    // Also query backend endpoints (works with or without token if public/session-authenticated)
    const token = localStorage.getItem('token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    for (const endpoint of TEACHER_API_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, { headers });
        if (!res.ok) continue;
        const data = await res.json();

        const list = Array.isArray(data?.teachers)
          ? data.teachers
          : Array.isArray(data)
          ? data
          : [];
        const teacherObj =
          data?.teacher ||
          list.find((t: any) =>
            String(t?.name || '')
              .toLowerCase()
              .includes('lorenzo')
          ) ||
          list[0] ||
          data;

        const apiPhoto =
          extractPhoto(teacherObj) ||
          (isValidImageSource(data?.teacherPhotoUrl) ? data.teacherPhotoUrl.trim() : '');

        if (apiPhoto || data?.subjectName || data?.sectionName || teacherObj?.name) {
          setMyTeacher((prev) => ({
            ...prev,
            id: teacherObj?.id || prev.id,
            name:
              String(teacherObj?.name || teacherObj?.teacherName || prev.name)
                .replace(/^Teacher\s+/i, '')
                .trim() || prev.name,
            email: teacherObj?.email || teacherObj?.teacherEmail || prev.email,
            avatar: apiPhoto || prev.avatar,
            subjectName: data?.subjectName || teacherObj?.subjectName || prev.subjectName,
            sectionName: data?.sectionName || teacherObj?.sectionName || prev.sectionName
          }));
          if (apiPhoto) break;
        }
      } catch {}
    }
  }, [studentName, extractPhoto, isValidImageSource, resolveTeacherPhotoEverywhere]);

  useEffect(() => {
    syncTeacherAndStudentData();
    const handleSync = () => syncTeacherAndStudentData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('teacher-profile-updated', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('teacher-profile-updated', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [syncTeacherAndStudentData]);

  // Robust API fetch helper with automatic Bearer Token attachment
  const secureApiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });
    const data = await response.json();
    return { ok: response.ok, data };
  };

  // Load real records only; if unverified/no records yet or in bypass mode, keep empty [] with zero network error banner
  const fetchHistory = async () => {
    setError('');
    syncTeacherAndStudentData();
    const token = localStorage.getItem('token') || '';

    let localSaved: AttendanceRecord[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('student_attendance_records') || '[]');
      if (Array.isArray(parsed)) {
        localSaved = parsed;
      }
    } catch {}

    if (!token) {
      setIsBypassSafe(true);
      setRecords(localSaved);
      setLoading(false);
      return;
    }

    try {
      const { ok, data } = await secureApiFetch('/api/student/records');
      if (ok && data.success) {
        setIsBypassSafe(false);
        const list = Array.isArray(data.records) ? data.records : [];
        setRecords(list);

        const apiTeacherPhoto =
          extractPhoto(data.teacher) ||
          (isValidImageSource(data.teacherPhotoUrl) ? data.teacherPhotoUrl.trim() : '');

        if (apiTeacherPhoto || list.length > 0 || data.subjectName || data.sectionName) {
          setMyTeacher((prev) => ({
            ...prev,
            avatar: apiTeacherPhoto || prev.avatar,
            sectionName: data.sectionName || list[0]?.sectionName || prev.sectionName,
            subjectName: data.subjectName || list[0]?.subject || prev.subjectName,
          }));
        }

        if (data.studentPhotoUrl) {
          setCurrentPhotoUrl(data.studentPhotoUrl);
          setNewPhotoUrl(data.studentPhotoUrl);
        }
      } else {
        setIsBypassSafe(true);
        setRecords(localSaved);
      }
    } catch {
      setIsBypassSafe(true);
      setRecords(localSaved);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 4000);
    return () => clearInterval(interval);
  }, []);

  // Calendar mapping & counts for Present, Late, Absent, No Class
  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach((r) => {
      if (r?.date) {
        map[r.date] = r;
      }
    });
    return map;
  }, [records]);

  const statusCounts = useMemo(() => {
    return records.reduce(
      (acc, item) => {
        if (item.status === 'Present') acc.present += 1;
        else if (item.status === 'Late') acc.late += 1;
        else if (item.status === 'Absent') acc.absent += 1;
        else if (item.status === 'No Class') acc.noClass += 1;
        return acc;
      },
      { present: 0, late: 0, absent: 0, noClass: 0 }
    );
  }, [records]);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calMonthTitle = calendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const calStartWeekday = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const list: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < calStartWeekday; i++) {
      list.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= calDaysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({ day: d, dateStr });
    }
    return list;
  }, [calYear, calMonth, calStartWeekday, calDaysInMonth]);

  const selectedDayRecord = selectedDateStr ? recordsByDate[selectedDateStr] : null;

  const getStatusBadgeClasses = (status?: AttendanceStatusType) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40';
      case 'Late':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/40';
      case 'Absent':
        return 'bg-rose-500/15 text-rose-500 border-rose-500/40';
      case 'No Class':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/40';
      case 'Time Out':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40';
      default:
        return 'bg-gray-50 dark:bg-gray-800/60 text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  // Validate image brightness to reject dark or unclear uploads
  const validateImageBrightness = (dataUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(true);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let colorSum = 0;

        for (let i = 0; i < data.length; i += 4 * 10) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const avg = r * 0.299 + g * 0.587 + b * 0.114;
          colorSum += avg;
        }

        const brightness = colorSum / (data.length / 4 / 10);
        if (brightness < 45) {
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => resolve(false);
    });
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setModalError('');
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultString = reader.result as string;
        const isBrightEnough = await validateImageBrightness(resultString);
        if (!isBrightEnough) {
          setModalError('The uploaded image is too dark or unclear. Please choose a clear, well-lit photo.');
          return;
        }
        setNewPhotoUrl(resultString);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSecurityAndProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setModalError('');

    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.length < 4) {
        setModalError('Password must be at least 4 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setModalError('Passwords do not match.');
        return;
      }
    }

    setIsSavingSecurity(true);
    try {
      const payload: any = { photoUrl: newPhotoUrl };
      if (newPassword && newPassword.trim() !== '') {
        payload.password = newPassword;
      }

      const token = localStorage.getItem('token') || '';
      if (!token) {
        setSuccessMsg('Profile updated locally (Bypass Mode)!');
        setCurrentPhotoUrl(newPhotoUrl);
        setNewPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setTimeout(() => {
          setIsSecurityOpen(false);
          setSuccessMsg('');
        }, 1200);
        return;
      }

      const { ok, data } = await secureApiFetch('/api/student/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (ok && data.success) {
        setSuccessMsg('Profile updated successfully!');
        setCurrentPhotoUrl(newPhotoUrl);
        setNewPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setTimeout(() => {
          setIsSecurityOpen(false);
          setSuccessMsg('');
        }, 1500);
      } else {
        setModalError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setModalError('Network error or server unavailable.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Student Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          {currentPhotoUrl ? (
            <img src={currentPhotoUrl} alt={studentName} className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-md" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              {studentName ? studentName.charAt(0) : 'S'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Welcome, {studentName}!</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Student Portal • Set up your profile &amp; security settings</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {isBypassSafe ? <WifiOff size={11} /> : <Sparkles size={11} />}
                {isBypassSafe ? 'Temp Bypass Safe Mode' : 'Live Synced'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setNewPassword('');
              setConfirmPassword('');
              setShowPassword(false);
              setSuccessMsg('');
              setModalError('');
              setIsSecurityOpen(true);
            }}
            className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:text-indigo-600 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Settings size={14} />
            <span>Configure Profile &amp; Security</span>
          </button>

          <button
            type="button"
            onClick={onLogOut}
            className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* TEACHER CARD (Clicking teacher name opens circle teacher picture + student subject & section) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              <span>Teacher</span>
            </h2>
            <p className="text-xs text-gray-500">Click the teacher&apos;s name to view circle picture, subject, and section.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowTeacherDetails((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition shrink-0"
          >
            {showTeacherDetails ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showTeacherDetails ? 'Hide Details' : 'Show Details'}</span>
          </button>
        </div>

        {showTeacherDetails && (
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-indigo-500 bg-indigo-600 flex items-center justify-center font-black text-white text-lg shrink-0">
              {isValidImageSource(myTeacher.avatar) ? (
                <img src={myTeacher.avatar} alt={myTeacher.name} className="w-full h-full object-cover" />
              ) : (
                <span>{myTeacher.name ? myTeacher.name.charAt(0).toUpperCase() : 'L'}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsTeacherFullViewOpen(true)}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-indigo-400 transition">
                {myTeacher.name}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">{myTeacher.email}</p>
            </button>
          </div>
        )}
      </div>

      {/* ATTENDANCE CALENDAR */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              <span>Attendance Calendar</span>
            </h2>
            <p className="text-xs text-gray-500">Click any date to inspect Present, Late, Absent, or No Class status.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {showCalendarDetails && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs font-black text-gray-900 dark:text-white min-w-[120px] text-center">{calMonthTitle}</span>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCalendarDetails((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition shrink-0"
            >
              {showCalendarDetails ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showCalendarDetails ? 'Hide Details' : 'Show Details'}</span>
            </button>
          </div>
        </div>

        {showCalendarDetails && (
          <>
            {/* Status Labels: Present, Late, Absent, No Class */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300">Present</span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-200">{statusCounts.present}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-300">Late</span>
                <span className="text-xs font-black text-amber-700 dark:text-amber-200">{statusCounts.late}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-300">Absent</span>
                <span className="text-xs font-black text-rose-700 dark:text-rose-200">{statusCounts.absent}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-500/10 border border-slate-500/30">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">No Class</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{statusCounts.noClass}</span>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase text-gray-400">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Clickable Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => {
                if (!cell.day || !cell.dateStr) {
                  return <div key={`empty-${idx}`} className="h-16 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20 border border-transparent" />;
                }
                const rec = recordsByDate[cell.dateStr];
                const isSelected = selectedDateStr === cell.dateStr;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={`h-16 rounded-2xl border p-2 flex flex-col justify-between text-left transition cursor-pointer ${getStatusBadgeClasses(
                      rec?.status
                    )} ${isSelected ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''}`}
                  >
                    <span className="text-xs font-black">{cell.day}</span>
                    <span className="text-[10px] font-extrabold truncate">
                      {rec ? rec.status : '--'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Date Details */}
            {selectedDateStr && (
              <div className="bg-gray-50 dark:bg-gray-800/70 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="font-black text-indigo-600 dark:text-indigo-300">Selected Date: {selectedDateStr}</p>
                  {selectedDayRecord ? (
                    <p className="text-gray-700 dark:text-gray-200">
                      Status: <span className="font-black">{selectedDayRecord.status}</span> • Time:{' '}
                      <span className="font-bold">{selectedDayRecord.time || '--'}</span>
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No attendance record on this date yet (Pending Face Verification / Check-In).</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDateStr(null)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer self-start sm:self-auto"
                >
                  Hide Details
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MY ATTENDANCE LOGS */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">My Attendance Logs</h2>
            <p className="text-xs text-gray-500">Real-time history of your time-in and time-out records.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowLogsDetails((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer transition shrink-0"
          >
            {showLogsDetails ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showLogsDetails ? 'Hide Details' : 'Show Details'}</span>
          </button>
        </div>

        {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl font-bold text-xs text-center">{error}</div>}

        {showLogsDetails && (
          loading ? (
            <div className="py-12 flex justify-center items-center">
              <LoaderCircle className="animate-spin text-indigo-600" size={28} />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-medium">
              No attendance records found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="pb-3">Date &amp; Time</th>
                    <th className="pb-3">Section</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="py-3.5 font-medium text-gray-900 dark:text-gray-200 flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-500" />
                        {rec.date} {rec.time}
                      </td>
                      <td className="py-3.5 font-bold text-indigo-600">{rec.sectionName || myTeacher.sectionName}</td>
                      <td className="py-3.5 font-semibold">Time {rec.type || 'In'}</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] border ${getStatusBadgeClasses(
                            rec.status
                          )}`}
                        >
                          {rec.status === 'Present' && <CheckCircle2 size={11} />}
                          {rec.status === 'Late' && <Clock size={11} />}
                          {rec.status === 'Absent' && <XCircle size={11} />}
                          {rec.status === 'No Class' && <MinusCircle size={11} />}
                          <span>{rec.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* CLICKING TEACHER NAME SHOWS ONLY TEACHER CIRCLE PICTURE + STUDENT'S ASSIGNED SUBJECT & SECTION */}
      {isTeacherFullViewOpen && (
        <div
          onClick={() => setIsTeacherFullViewOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-5 text-xs"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsTeacherFullViewOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center py-1">
              <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-indigo-500 shadow-lg bg-indigo-600 flex items-center justify-center">
                {isValidImageSource(myTeacher.avatar) ? (
                  <img
                    src={myTeacher.avatar}
                    alt={myTeacher.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-black text-white">
                    {myTeacher.name ? myTeacher.name.charAt(0).toUpperCase() : 'T'}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-semibold">Subject</span>
                <span className="font-black text-gray-900 dark:text-white">{myTeacher.subjectName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-semibold">Section</span>
                <span className="font-black text-indigo-600 dark:text-indigo-300">{myTeacher.sectionName}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE & SECURITY MODAL */}
      {isSecurityOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-5 text-xs">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
              <span className="font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Configure Profile &amp; Security
              </span>
              <button
                type="button"
                onClick={() => setIsSecurityOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveSecurityAndProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Profile Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoChange}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 pr-10 font-bold text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 font-bold text-gray-900 dark:text-white"
                />
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 rounded-2xl font-bold flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-2xl font-bold flex items-center gap-2">
                  <Check size={15} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingSecurity}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition cursor-pointer disabled:opacity-50"
              >
                {isSavingSecurity ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}