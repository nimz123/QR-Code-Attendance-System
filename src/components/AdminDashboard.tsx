import React, { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, LogOut, Users, GraduationCap, AlertCircle, Check, RefreshCw, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AdminTeacher {
  id: number | string;
  _id?: string;
  username: string;
  name: string;
}

interface AdminSection {
  id: string;
  _id?: string;
  name: string;
  startTime: string;
  teacherId?: string;
  teacher_id?: string;
  teacherUsername?: string;
  teacher_username?: string;
  teacherName?: string;
  teacher_name?: string;
  createdBy?: string;
  students?: Array<{
    id: string;
    name: string;
    username: string;
  }>;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | number | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from backend API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resTeachers = await apiFetch('/api/admin/teachers');
      if (resTeachers.ok) {
        const tList = Array.isArray(resTeachers.data) ? resTeachers.data : resTeachers.data.teachers || [];
        setTeachers(tList);
      }

      // Kuhaa ang sections gikan sa admin sections endpoint nga naay kaubang students ug teacherId
      const resSections = await apiFetch('/api/admin/sections');
      if (resSections.ok) {
        const sList = Array.isArray(resSections.data) ? resSections.data : resSections.data.sections || [];
        setSections(sList);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim() || !username.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { ok, data } = await apiFetch('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          password: password,
          role: 'teacher'
        }),
      });

      if (ok && (data.success || data.id || data._id || data.teacher)) {
        setSuccessMsg('Teacher account created successfully!');
        setName('');
        setUsername('');
        setPassword('');
        fetchData();
      } else {
        setError(data.error || 'Failed to create teacher account.');
      }
    } catch (err) {
      setError('Connection to server failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id: number | string) => {
    if (!confirm('Are you sure you want to delete this teacher account?')) return;

    try {
      const { ok } = await apiFetch(`/api/admin/teachers/${id}`, {
        method: 'DELETE',
      });
      if (ok) {
        fetchData();
      } else {
        alert('Failed to delete teacher account.');
      }
    } catch (err) {
      console.error('Error deleting teacher:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black font-display text-gray-900 dark:text-white">Admin Control Center</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Global monitoring, teacher management, and student rosters.</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CREATE TEACHER FORM */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5 h-fit">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Create Teacher</h2>
          </div>

          <form onSubmit={handleCreateTeacher} className="space-y-4" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Full Name</label>
              <input
                type="text"
                required
                name="teacher_fullname_field"
                autoComplete="off"
                data-lpignore="true"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Username</label>
              <input
                type="text"
                required
                name="teacher_username_field"
                autoComplete="off"
                data-lpignore="true"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. juan_teacher"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Password</label>
              <input
                type="password"
                required
                name="teacher_password_field"
                autoComplete="new-password"
                data-lpignore="true"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <Check size={15} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
              <span>{isSubmitting ? 'Creating...' : 'Create Teacher Account'}</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: TEACHERS AND GLOBAL SECTIONS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Registered Teachers & Enrolled Rosters ({teachers.length})</h2>
              </div>
              <button
                onClick={fetchData}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <p className="text-xs text-gray-400 text-center py-8">Loading teachers data...</p>
              ) : teachers.length > 0 ? (
                teachers.map((t) => {
                  const isExpanded = expandedTeacherId === t.id;

                  // Universal fallback: map sections to teachers or include all sections if teacher list is singular
                  const teacherSections = sections.filter(s => {
                    const secTId = String(s.teacherId || s.teacher_id || '').trim().toLowerCase();
                    const secTUser = String(s.teacherUsername || s.teacher_username || s.createdBy || '').trim().toLowerCase();
                    const secTName = String(s.teacherName || s.teacher_name || '').trim().toLowerCase();

                    const tId = String(t.id || t._id || '').trim().toLowerCase();
                    const tUser = String(t.username || '').trim().toLowerCase();
                    const tName = String(t.name || '').trim().toLowerCase();

                    return (
                      secTId === tId ||
                      secTUser === tUser ||
                      secTName === tName ||
                      (!secTId && !secTUser && !secTName) ||
                      teachers.length === 1
                    );
                  });

                  const totalStudents = teacherSections.reduce((acc, sec) => acc + (sec.students?.length || 0), 0);

                  return (
                    <div
                      key={t.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 overflow-hidden transition"
                    >
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div
                          onClick={() => setExpandedTeacherId(isExpanded ? null : t.id)}
                          className="flex-1 flex items-center gap-3 cursor-pointer select-none"
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center uppercase text-sm">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{t.name}</p>
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <GraduationCap size={12} />
                                {totalStudents} {totalStudents === 1 ? 'Student' : 'Students'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">@{t.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedTeacherId(isExpanded ? null : t.id)}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Details' : 'View Students'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          <button
                            onClick={() => handleDeleteTeacher(t.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Delete Teacher Account"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* EXPANDED SECTION DETAILS */}
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-200/60 dark:border-gray-800 bg-white dark:bg-gray-900/80 space-y-4">
                          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen size={14} />
                            <span>Class Sections & Enrolled Roster</span>
                          </h4>

                          {teacherSections.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">This teacher has not created any class sections yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {teacherSections.map((sec) => (
                                <div key={sec.id || sec._id} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                      <BookOpen size={13} className="text-indigo-500" />
                                      Section: {sec.name}
                                    </span>
                                    <span className="text-[10px] text-gray-400">Start Time: {sec.startTime}</span>
                                  </div>

                                  {/* Student List */}
                                  {(!sec.students || sec.students.length === 0) ? (
                                    <p className="text-[11px] text-gray-400 italic pl-5">No students registered in this section.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-2">
                                      {sec.students.map((st) => (
                                        <div
                                          key={st.id}
                                          className="p-2 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700 rounded-lg flex items-center gap-2 text-xs"
                                        >
                                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center uppercase text-[10px]">
                                            {st.name.charAt(0)}
                                          </div>
                                          <div>
                                            <p className="font-bold text-gray-800 dark:text-gray-200 text-[11px]">{st.name}</p>
                                            <p className="text-[9px] text-gray-400 font-mono">@{st.username}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400 text-center py-8">No registered teachers found.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}