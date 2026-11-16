
import React from 'react';
import { CheckCircle2, Clock, LogOut, XCircle, ShieldAlert } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface AttendanceRecordRowProps {
  record: AttendanceRecord;
}

const statusStyles: Record<
  AttendanceRecord['status'],
  { label: string; className: string; icon: React.ReactNode }
> = {
  Present: {
    label: 'Present',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 size={14} />,
  },
  Late: {
    label: 'Late',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Clock size={14} />,
  },
  'Time Out': {
    label: 'Time Out',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <LogOut size={14} />,
  },
  Absent: {
    label: 'Absent',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: <XCircle size={14} />,
  },
  'Failed Verification': {
    label: 'Failed Verification',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    icon: <ShieldAlert size={14} />,
  },
};

export default function AttendanceRecordRow({
  record,
}: AttendanceRecordRowProps) {
  const status = statusStyles[record.status] ?? statusStyles.Absent;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
          {record.studentName}
        </h3>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {record.sectionName}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{record.date}</span>
          <span>{record.time}</span>
          {record.type && (
            <span className="font-medium">
              {record.type === 'In' ? 'Time In' : 'Time Out'}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}
        >
          {status.icon}
          {status.label}
        </span>
      </div>
    </div>
  );
}
