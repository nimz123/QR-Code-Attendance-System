import React from 'react';
import { AttendanceRecord } from '../types';
import AttendanceStatusBadge from './AttendanceStatusBadge';

interface AttendanceRecordRowProps {
  record: AttendanceRecord;
}

export default function AttendanceRecordRow({ record }: AttendanceRecordRowProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <span className="font-semibold text-sm text-gray-800 block">{record.sectionName}</span>
        <span className="text-xs text-gray-400 font-mono">{record.date} &middot; {record.time}</span>
      </div>
      <AttendanceStatusBadge status={record.status} />
    </div>
  );
}
