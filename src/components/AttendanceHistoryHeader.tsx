import React from 'react';
import { CalendarClock, LogOut } from 'lucide-react';

interface AttendanceHistoryHeaderProps {
  studentName: string;
  onLogOut: () => void;
}

export default function AttendanceHistoryHeader({ studentName, onLogOut }: AttendanceHistoryHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          <CalendarClock size={10} />
          <span>My Attendance</span>
        </span>
        <h1 className="text-2xl font-bold font-display text-gray-900 tracking-tight mt-1">Hi, {studentName}</h1>
      </div>
      <button
        id="student-logout-btn"
        onClick={onLogOut}
        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
      >
        <LogOut size={14} />
        <span>Log Out</span>
      </button>
    </div>
  );
}
