import React from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface AttendanceStatusBadgeProps {
  status: 'Present' | 'Late' | 'Time Out';
}

export default function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  if (status === 'Late') {
    return (
      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-rose-100">
        <AlertTriangle size={11} /><span>LATE</span>
      </span>
    );
  }
  if (status === 'Time Out') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-blue-100">
        <Clock size={11} /><span>TIME OUT</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-100">
      <CheckCircle size={11} /><span>ON TIME</span>
    </span>
  );
}
