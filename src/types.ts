export interface Student {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface Section {
  id: string;
  name: string;
  students: Student[];
  startTime: string; // "HH:MM" e.g., "08:30"
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string;
  sectionId: string;
  sectionName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  status: 'Present' | 'Late' | 'Time Out';
  type?: 'In' | 'Out';
  timestamp: string; // ISO string of submission
}

export function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

