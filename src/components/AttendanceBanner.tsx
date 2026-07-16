import React from 'react';
import { School } from 'lucide-react';
import { Section } from '../types';

interface AttendanceBannerProps {
  isTimeOut: boolean;
  activeSection?: Section;
  onGoToLogin: () => void;
}

export default function AttendanceBanner({ isTimeOut, activeSection, onGoToLogin }: AttendanceBannerProps) {
  return (
    <div className={`rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden mb-6 ${isTimeOut ? 'bg-rose-600' : 'bg-indigo-600'}`}>
      {/* Background blobs for premium feel */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl translate-x-12 -translate-y-12"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl -translate-x-6 translate-y-6"></div>

      <div className="relative z-10 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {activeSection?.room && (
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs">
              <School size={12} />
              <span>Room: {activeSection.room}</span>
            </div>
          )}
          {activeSection?.teacherName && (
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/20">
              {activeSection.teacherPhotoUrl && (
                <img
                  src={activeSection.teacherPhotoUrl}
                  alt={activeSection.teacherName}
                  referrerPolicy="no-referrer"
                  className="w-3.5 h-3.5 rounded-full object-cover border border-white/30"
                />
              )}
              <span>Teacher: {activeSection.teacherName}</span>
            </div>
          )}
          {activeSection?.subject && (
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs border border-white/20">
              <span>Subject: {activeSection.subject}</span>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
          {isTimeOut ? 'Student Time-Out Portal' : 'Student Attendance Portal'}
        </h1>
        <p className="text-white/90 text-sm max-w-md leading-relaxed">
          {isTimeOut
            ? 'Quick, open access to log class departure. Please choose your Section, find your Name, and specify your checkout details below.'
            : 'Quick, open access to log class arrival. Please choose your Section, find your Name, and specify your arrival details below.'}
        </p>
        <button
          id="btn-goto-login"
          type="button"
          onClick={onGoToLogin}
          className="text-xs font-bold text-white/90 hover:text-white underline underline-offset-2"
        >
          Sign in to view your attendance history
        </button>
      </div>
    </div>
  );
}
