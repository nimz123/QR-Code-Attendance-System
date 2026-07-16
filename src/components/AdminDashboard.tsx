import React, { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, LogOut, Users, GraduationCap, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AdminTeacher {
  id: number;
  username: string;
  name: string;
  room?: string | null;
  subject?: string | null;
}

interface AdminSection {
  id: string;
  name: string;
  startTime: string;
}

interface AdminStudent {
  id: string;
  username: string;
  name: string;
  sectionId: string;
}

interface AdminDashboardProps {
  onLogOut: () => void;
}

export default function AdminDashboard({ onLogOut }: AdminDashboardProps) {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const [teacherForm, setTeacherForm] = useState({ name: '', username: '', password: '', room: '', subject: '' });
  const [studentForm, setStudentForm] = useState({ name: '', username: '', password: '' });

  const [teacherError, setTeacherError] = useState('');
  const [studentError, setStudentError] = useState('');

  const loadTeachers = async () => {
    const { data } = await apiFetch('/api/admin/teachers');
    if (data.success) setTeachers(data.teachers);
  };

  useEffect(() => { loadTeachers(); }, []);

  useEffect(() => {
    if (selectedTeacherId === null) {
      setSections([]);
      setSelectedSectionId(null);
      return;
    }
    apiFetch(`/api/admin/sections?teacherId=${selectedTeacherId}`).then(({ data }) => {
      if (data.success) setSections(data.sections);
      setSelectedSectionId(null);
    });
  }, [selectedTeacherId]);

  useEffect(() => {
    if (!selectedSectionId) {
      setStudents([]);
      return;
    }
    apiFetch(`/api/admin/students?sectionId=${selectedSectionId}`).then(({ data }) => {
      if (data.success) setStudents(data.students);
    });
  }, [selectedSectionId]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');
    const { ok, data } = await apiFetch('/api/admin/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherForm),
    });
    if (!ok) {
      setTeacherError(data.error || 'Failed to create teacher.');
      return;
    }
    setTeacherForm({ name: '', username: '', password: '', room: '', subject: '' });
    loadTeachers();
  };

  const handleDeleteTeacher = async (id: number) => {
    if (!confirm('Delete this teacher? This also deletes all their sections, students, and attendance records.')) return;
    await apiFetch(`/api/admin/teachers/${id}`, { method: 'DELETE' });
    if (selectedTeacherId === id) setSelectedTeacherId(null);
    loadTeachers();
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');
    if (!selectedSectionId) return;
    const { ok, data } = await apiFetch('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify({ ...studentForm, sectionId: selectedSectionId }),
    });
    if (!ok) {
      setStudentError(data.error || 'Failed to create student.');
      return;
    }
    setStudentForm({ name: '', username: '', password: '' });
    const { data: refreshed } = await apiFetch(`/api/admin/students?sectionId=${selectedSectionId}`);
    if (refreshed.success) setStudents(refreshed.students);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Delete this student account?')) return;
    await apiFetch(`/api/admin/students/${id}`, { method: 'DELETE' });
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div id="admin-dashboard-root" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            <Shield size={10} />
            <span>Admin Access</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 tracking-tight mt-1">Admin Dashboard</h1>
        </div>
        <button
          id="admin-logout-btn"
          onClick={onLogOut}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
        >
          <LogOut size={14} />
          <span>Log Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teachers panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <Users size={16} className="text-indigo-600" />
            <span>Teachers</span>
          </h2>

          <form onSubmit={handleCreateTeacher} className="space-y-2.5 border-b border-gray-100 pb-5">
            <input required placeholder="Full name" value={teacherForm.name}
              onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
            <input required placeholder="Username" value={teacherForm.username}
              onChange={e => setTeacherForm({ ...teacherForm, username: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
            <input required type="password" placeholder="Password" value={teacherForm.password}
              onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Room" value={teacherForm.room}
                onChange={e => setTeacherForm({ ...teacherForm, room: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
              <input placeholder="Subject" value={teacherForm.subject}
                onChange={e => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
            </div>
            {teacherError && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                <AlertCircle size={12} /><span>{teacherError}</span>
              </div>
            )}
            <button type="submit" className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition">
              <UserPlus size={14} /><span>Create Teacher</span>
            </button>
          </form>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {teachers.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No teachers yet.</p>}
            {teachers.map(t => (
              <div key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                  selectedTeacherId === t.id ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50/50 border-gray-100 hover:border-indigo-200'
                }`}
              >
                <div className="min-w-0">
                  <span className="font-bold text-xs text-gray-800 block truncate">{t.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">@{t.username}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(t.id); }}
                  className="text-gray-300 hover:text-rose-600 p-1 rounded-md transition shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sections panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-3">
          <h2 className="text-base font-bold text-gray-900">Sections</h2>
          {selectedTeacherId === null ? (
            <p className="text-xs text-gray-400 italic text-center py-8">Select a teacher to view their sections.</p>
          ) : sections.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-8">This teacher hasn't created any sections yet. They need to log in and add one first.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {sections.map(s => (
                <div key={s.id}
                  onClick={() => setSelectedSectionId(s.id)}
                  className={`px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                    selectedSectionId === s.id ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50/50 border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  <span className="font-bold text-xs text-gray-800 block">{s.name}</span>
                  <span className="text-[10px] text-gray-400">Start: {s.startTime}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <GraduationCap size={16} className="text-indigo-600" />
            <span>Students</span>
          </h2>

          {!selectedSectionId ? (
            <p className="text-xs text-gray-400 italic text-center py-8">Select a section to manage its students.</p>
          ) : (
            <>
              <form onSubmit={handleCreateStudent} className="space-y-2.5 border-b border-gray-100 pb-5">
                <input required placeholder="Full name" value={studentForm.name}
                  onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                <input required placeholder="Username" value={studentForm.username}
                  onChange={e => setStudentForm({ ...studentForm, username: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                <input required type="password" placeholder="Password" value={studentForm.password}
                  onChange={e => setStudentForm({ ...studentForm, password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono" />
                {studentError && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                    <AlertCircle size={12} /><span>{studentError}</span>
                  </div>
                )}
                <button type="submit" className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition">
                  <UserPlus size={14} /><span>Create Student</span>
                </button>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {students.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No students in this section yet.</p>}
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-gray-800 block truncate">{s.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">@{s.username}</span>
                    </div>
                    <button onClick={() => handleDeleteStudent(s.id)} className="text-gray-300 hover:text-rose-600 p-1 rounded-md transition shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
