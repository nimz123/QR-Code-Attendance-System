import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, LoaderCircle, LogOut, Calendar, User, Check, AlertTriangle } from 'lucide-react';

interface StudentAttendanceHistoryProps {
  studentName: string;
  onLogOut: () => void;
}

interface AttendanceRecord {
  id: string;
  date: string;
  time: string;
  sectionName: string;
  type: 'In' | 'Out';
  status: 'Present' | 'Late' | 'Time Out';
}

export default function StudentAttendanceHistory({ studentName, onLogOut }: StudentAttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>('');

  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [modalError, setModalError] = useState('');

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

  const fetchHistory = async () => {
    try {
      const { ok, data } = await secureApiFetch('/api/student/records');
      if (ok && data.success) {
        setRecords(data.records || []);
        if (data.studentPhotoUrl) {
          setCurrentPhotoUrl(data.studentPhotoUrl);
          setNewPhotoUrl(data.studentPhotoUrl);
        }
      } else {
        setError(data.error || 'Failed to load attendance history.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while loading records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

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
          resolve(false); // Too dark
        } else {
          resolve(true); // Bright enough
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

    // Validate password ONLY if the user entered one (Optional password update)
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
      
      // Include password in payload only if provided
      if (newPassword && newPassword.trim() !== '') {
        payload.password = newPassword;
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Student Portal • Set up your profile & security settings</p>
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
            <span>Configure Profile & Security</span>
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

      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">My Attendance Logs</h2>
            <p className="text-xs text-gray-500">Real-time history of your time-in and time-out records.</p>
          </div>
        </div>

        {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl font-bold text-xs text-center">{error}</div>}

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <LoaderCircle className="animate-spin text-indigo-600" size={28} />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs font-medium">No attendance records found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="pb-3">Date & Time</th>
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
                    <td className="py-3.5 font-bold text-indigo-600">{rec.sectionName || 'Class Section'}</td>
                    <td className="py-3.5 font-semibold">Time {rec.type}</td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        rec.status === 'Present' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isSecurityOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Profile & Security</h3>
                <p className="text-xs text-gray-500 mt-1">Set up your profile picture and update password.</p>
              </div>
              <button type="button" onClick={() => setIsSecurityOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveSecurityAndProfile} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-gray-500 uppercase tracking-wider block">PROFILE PICTURE</label>
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-200 dark:border-gray-700">
                  {newPhotoUrl ? (
                    <img src={newPhotoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-indigo-500" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold">
                      <User size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="w-full text-[11px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">NEW PASSWORD (OPTIONAL)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      minLength={4}
                      placeholder="Leave blank to keep current password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 pr-12 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">CONFIRM NEW PASSWORD</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={4}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {modalError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 rounded-2xl font-bold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl font-bold text-center flex items-center justify-center gap-2">
                  <Check size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsSecurityOpen(false)}
                  className="px-5 py-2.5 font-bold text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSecurity}
                  className="flex items-center gap-2 px-6 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingSecurity && <LoaderCircle size={14} className="animate-spin" />}
                  {isSavingSecurity ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}