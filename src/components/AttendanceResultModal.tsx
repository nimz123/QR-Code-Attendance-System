import React from 'react';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeToAMPM } from '../types';

export interface AttendancePopupData {
  isOpen: boolean;
  studentName: string;
  sectionName: string;
  arrivalDate: string;
  arrivalTime: string;
  status: 'Present' | 'Late' | 'Time Out';
  startTime: string;
}

interface AttendanceResultModalProps {
  popupData: AttendancePopupData | null;
  studentPhotoUrl?: string;
  onClose: () => void;
}

export default function AttendanceResultModal({ popupData, studentPhotoUrl, onClose }: AttendanceResultModalProps) {
  return (
    <AnimatePresence>
      {popupData?.isOpen && (
        <div id="attendance-modal-overlay" className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100"
          >

            {/* Conditional Banner styling based on status (Late vs Time Out vs On Time) */}
            {popupData.status === 'Time Out' ? (
              <div id="modal-banner-timeout" className="bg-blue-600 text-white p-6 text-center space-y-2 relative">
                <div className="absolute top-3 right-3 opacity-15">
                  <Clock size={100} />
                </div>
                <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                  <Clock size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold font-display tracking-tight uppercase">DEPARTURE RECORDED</h3>
                <p className="text-blue-100 text-xs">Checkout time registered successfully</p>
              </div>
            ) : popupData.status === 'Late' ? (
              <div id="modal-banner-late" className="bg-rose-600 text-white p-6 text-center space-y-2 relative">
                <div className="absolute top-3 right-3 opacity-15">
                  <XCircle size={100} />
                </div>
                <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                  <AlertTriangle size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold font-display tracking-tight uppercase">SYSTEM WARNING: LATE</h3>
                <p className="text-rose-100 text-xs">Your arrival is logged past the scheduled class start time</p>
              </div>
            ) : (
              <div id="modal-banner-present" className="bg-emerald-600 text-white p-6 text-center space-y-2 relative">
                <div className="absolute top-3 right-3 opacity-15">
                  <CheckCircle size={100} />
                </div>
                <div className="bg-white/20 p-3 rounded-full inline-flex mx-auto border border-white/30">
                  <CheckCircle size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold font-display tracking-tight uppercase">PRESENT & ON TIME</h3>
                <p className="text-emerald-100 text-xs">Punctuality record logged successfully</p>
              </div>
            )}

            {/* Modal Body Info */}
            <div id="modal-body-details" className="p-6 space-y-4">

              <div className="text-center">
                {studentPhotoUrl && (
                  <div className="flex justify-center mb-2.5">
                    <img
                      src={studentPhotoUrl}
                      alt={popupData.studentName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-xs"
                    />
                  </div>
                )}
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Student Identity</span>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{popupData.studentName}</p>
                <p className="text-xs text-gray-500 mt-1 bg-gray-50 py-1 px-3 rounded-md inline-block border border-gray-100">
                  {popupData.sectionName}
                </p>
              </div>

              <div className="border-t border-b border-gray-100 py-3 grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    {popupData.status === 'Time Out' ? 'Departure Time' : 'Arrival Time'}
                  </span>
                  <p className="text-sm font-semibold text-gray-800 font-mono mt-1">
                    {formatTimeToAMPM(popupData.arrivalTime)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Scheduled Start</span>
                  <p className="text-sm font-semibold text-gray-800 font-mono mt-1">
                    {formatTimeToAMPM(popupData.startTime)}
                  </p>
                </div>
              </div>

              {popupData.status === 'Time Out' ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
                  <Clock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Departure Logged Successfully.</p>
                    <p className="mt-0.5 text-blue-700/90 leading-relaxed">
                      Have a wonderful day ahead! Keep up the hard work and review your materials before the next class.
                    </p>
                  </div>
                </div>
              ) : popupData.status === 'Late' ? (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 flex gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Automatic Lateness Marker triggered.</p>
                    <p className="mt-0.5 text-rose-700/90 leading-relaxed">
                      Please proceed into the classroom quietly to minimize disruption. Remember, punctuality matters!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Fantastic job arriving early!</p>
                    <p className="mt-0.5 text-emerald-700/90 leading-relaxed">
                      Your on-time attendance is securely logged. Grab your study materials and prepare for the lesson.
                    </p>
                  </div>
                </div>
              )}

              <button
                id="btn-close-attendance-modal"
                type="button"
                onClick={onClose}
                className={`w-full font-bold text-sm py-2.5 rounded-xl transition text-white shadow-xs ${
                  popupData.status === 'Time Out'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : popupData.status === 'Late'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Done (Ready for Next Student)
              </button>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
