
export interface Student {
  id: string;
  name: string;
  username: string;
  photoUrl?: string;
}

export interface Section {
  id: string;
  name: string;
  startTime: string; // e.g. "08:00"
  endTime?: string; // e.g. "17:00"
  students?: Student[];

  // Room and teacher information for AttendanceBanner
  room?: string | null;
  teacherName?: string;
  teacherPhotoUrl?: string | null;
  subject?: string | null;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss

  status:
    | 'Present'
    | 'Late'
    | 'Time Out'
    | 'Absent'
    | 'Failed Verification';

  type?: 'In' | 'Out';
  timestamp: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  photo?: string | null;
}

export interface SecurityLog {
  id: string;
  teacherId: string;
  teacherName: string;
  action: 'username_change' | 'password_change' | 'both_change';
  details: string;
  timestamp: string;
}

export interface StudentMessage {
  id: string;
  studentId: string;
  teacherId: string;
  message: string;
  note: string;
  timestamp: string;
}

export function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr) return '';

  const [h, m] = timeStr.split(':').map(Number);

  if (
    !Number.isInteger(h) ||
    !Number.isInteger(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return timeStr;
  }

  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
