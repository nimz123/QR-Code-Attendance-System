import React, { useEffect, useState } from 'react';
import { AttendanceRecord } from '../types';
import { apiFetch } from '../lib/api';
import AttendanceHistoryHeader from './AttendanceHistoryHeader';
import AttendanceRecordRow from './AttendanceRecordRow';

interface StudentAttendanceHistoryProps {
  studentName: string;
  onLogOut: () => void;
}

export default function StudentAttendanceHistory({ studentName, onLogOut }: StudentAttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/student/records').then(({ data }) => {
      if (data.success) setRecords(data.records);
      setIsLoading(false);
    });
  }, []);

  return (
    <div id="student-history-root" className="max-w-2xl mx-auto">
      <AttendanceHistoryHeader studentName={studentName} onLogOut={onLogOut} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-12">Loading your records...</p>
        ) : records.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">No attendance logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map(record => (
              <AttendanceRecordRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
