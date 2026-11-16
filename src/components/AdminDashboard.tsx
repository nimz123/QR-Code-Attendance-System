import React, { useState, useEffect } from 'react';
import { Users, BookOpen, ShieldCheck, AlertCircle, Search, RefreshCw, UserPlus, CheckCircle, XCircle, X, ChevronDown, ChevronUp, LogOut, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  username: string;
  isVerified: boolean;
  photoUrl?: string;
  records?: any[];
}

interface Section {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
  students?: Student[];
}

interface Teacher {
  id: number | string;
  name: string;
  username: string;
  email: string;
  room?: string;
  subject?: string;
  sections: Section[];
}

interface AdminDashboardProps {
  onLogout?: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [expandedTeachers, setExpandedTeachers] = useState<{ [key: string]: boolean }>({});

  const [showAddTeacherModal, setShowAddTeacherModal] = useState<boolean>(false);
  const [teacherName, setTeacherName] = useState<string>('');
  const [teacherUsername, setTeacherUsername] = useState<string>('');
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [teacherSubject, setTeacherSubject] = useState<string>('');
  const [teacherRoom, setTeacherRoom] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://localhost:5001/api/admin/teachers');
      const data = await res.json();
      if (data.success) {
        setTeachers(data.teachers || []);
        const initialExpanded: { [key: string]: boolean } = {};
        (data.teachers || []).forEach((t: Teacher) => {
          initialExpanded[t.id] = true;
        });
        setExpandedTeachers(initialExpanded);
      } else {
        const pubRes = await fetch('http://localhost:5001/api/state/public');
        const pubData = await pubRes.json();
        if (pubData.success) {
          setTeachers(pubData.teachers || []);
        } else {
          setError('Failed to fetch dashboard data');
        }
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTeacherDetails = (teacherId: string | number) => {
    setExpandedTeachers(prev => ({
      ...prev,
      [teacherId]: !prev[teacherId]
    }));
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
  };

  // Function para ma-delete ang teacher
  const handleDeleteTeacher = async (teacherId: string | number, teacherName: string) => {
    if (window.confirm(`Are you sure you want to delete teacher ${teacherName}? This action cannot be undone.`)) {
      try {
        setError(null);
        const res = await fetch(`http://localhost:5001/api/admin/teachers/${teacherId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (res.ok && (data.success !== false)) {
          setTeachers(teachers.filter(t => t.id !== teacherId));
          // Kon ang nadelete nga teacher ang nag-owner sa currently selected section, i-clear sa nato ang selected section
          setSuccessMsg(`Teacher ${teacherName} deleted successfully!`);
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setError(data.error || 'Failed to delete teacher.');
        }
      } catch (err) {
        console.error('Error deleting teacher:', err);
        setError('Error connecting to server while deleting teacher.');
      }
    }
  };

  const handleSelectSection = async (sectionInput: any) => {
    try {
      setError(null);
      let secId = '';
      let secName = '';
      
      if (typeof sectionInput === 'string') {
        secId = sectionInput;
        secName = sectionInput;
      } else if (sectionInput && typeof sectionInput === 'object') {
        secId = sectionInput.id || sectionInput.name;
        secName = sectionInput.name || sectionInput.id;
      }

      if (!secId) return;

      setSelectedSection({
        id: secId,
        name: secName,
        students: sectionInput?.students || []
      });
      setStudents(sectionInput?.students || []);

      const res = await fetch(`http://localhost:5001/api/admin/sections/${encodeURIComponent(secId)}/students`);
      const data = await res.json();
      
      if (data.success || Array.isArray(data.students) || Array.isArray(data)) {
        const studentList = data.students || data.data || data.items || (Array.isArray(data) ? data : []);
        setStudents(studentList);
        setSelectedSection(prev => prev ? { ...prev, students: studentList } : { id: secId, name: secName, students: studentList });
      } else {
        const fallbackRes = await fetch(`http://localhost:5001/api/admin/sections/${encodeURIComponent(secId)}`);
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success && fallbackData.section) {
          setSelectedSection(fallbackData.section);
          setStudents(fallbackData.section.students || fallbackData.students || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching section students:', err);
      setError('Error fetching students.');
    }
  };

  const handleRegisterTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherUsername || !teacherPassword) {
      setError('Please fill in all required teacher fields.');
      return;
    }

    try {
      setRegistering(true);
      setError(null);
      const res = await fetch('http://localhost:5001/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName,
          username: teacherUsername,
          email: teacherEmail || `${teacherUsername}@school.edu`,
          password: teacherPassword,
          subject: teacherSubject,
          room: teacherRoom
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Teacher registered successfully!');
        setShowAddTeacherModal(false);
        setTeacherName('');
        setTeacherUsername('');
        setTeacherEmail('');
        setTeacherPassword('');
        setTeacherSubject('');
        setTeacherRoom('');
        fetchData();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.error || 'Failed to register teacher');
      }
    } catch (err) {
      console.error('Error registering teacher:', err);
      setError('Server error while registering teacher.');
    } finally {
      setRegistering(false);
    }
  };

  const filteredStudents = students.filter(st => 
    st.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#111827] border border-gray-800 p-6 rounded-2xl shadow-lg gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="text-indigo-400" /> Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400">Manage teachers, sections, register new teachers, and view student verification statuses.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAddTeacherModal(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition font-medium text-sm shadow-md"
            >
              <UserPlus size={16} /> Register Teacher
            </button>
            <button 
              onClick={fetchData} 
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-indigo-300 rounded-xl hover:bg-gray-700 transition font-medium text-sm border border-gray-700"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="bg-emerald-950/80 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between text-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-emerald-400" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-sm font-bold">Dismiss</button>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border-l-4 border-rose-500 p-4 rounded-xl flex items-center justify-between text-rose-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-sm font-bold">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Teachers & Sections List with Logout at Bottom */}
          <div className="lg:col-span-1 bg-[#111827] border border-gray-800 p-6 rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-400" /> Teachers & Sections
              </h2>
              <p className="text-xs text-gray-400">Click "Show/Hide Details" to toggle sections, click a section to view students, or delete teacher accounts.</p>

              {loading ? (
                <div className="text-center py-10 text-gray-500">Loading teachers & sections...</div>
              ) : teachers.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No teachers found. Click "Register Teacher" above to add one.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {teachers.map((teacher) => {
                    const isExpanded = !!expandedTeachers[teacher.id];
                    return (
                      <div key={teacher.id} className="border border-gray-800 rounded-xl p-4 bg-[#1f2937]/50 shadow-inner space-y-3 transition hover:border-indigo-500/50">
                        
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white text-sm">{teacher.name}</div>
                            <div className="text-xs text-gray-400">{teacher.email} {teacher.subject ? `• ${teacher.subject}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* DELETE TEACHER BUTTON */}
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                              title="Delete Teacher"
                              className="p-1.5 rounded-lg bg-rose-950/50 text-rose-400 hover:bg-rose-900 hover:text-white transition border border-rose-900/50"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => toggleTeacherDetails(teacher.id)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white transition"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-2 pt-2 border-t border-gray-800 animate-in fade-in duration-150">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Sections ({teacher.sections?.length || 0})</div>
                            {teacher.sections && teacher.sections.length > 0 ? (
                              teacher.sections.map((section) => {
                                const secId = section.id || section.name;
                                const isSelected = selectedSection?.id === secId || selectedSection?.name === section.name;
                                return (
                                  <div
                                    key={secId}
                                    onClick={() => handleSelectSection(section)}
                                    className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between border ${
                                      isSelected 
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                                        : 'bg-[#111827] text-gray-300 border-gray-800 hover:bg-[#374151] hover:border-gray-700'
                                    }`}
                                  >
                                    <div>
                                      <div className="font-medium text-sm capitalize">{section.name}</div>
                                      <div className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                                        {section.startTime || '08:00'} - {section.endTime || '17:00'}
                                      </div>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                                      isSelected ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'
                                    }`}>
                                      {section.students?.length || 0} students
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-xs text-gray-500 italic py-1">No sections assigned.</div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* LOGOUT BUTTON AT THE BOTTOM */}
            <div className="pt-4 border-t border-gray-800 mt-4">
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/50 text-rose-300 rounded-xl hover:bg-rose-900/80 transition font-semibold text-sm border border-rose-900/50 shadow-sm"
              >
                <LogOut size={16} /> Logout Admin Account
              </button>
            </div>
          </div>

          {/* Students List for Selected Section */}
          <div className="lg:col-span-2 bg-[#111827] border border-gray-800 p-6 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={20} className="text-indigo-400" /> 
                  {selectedSection ? `Students in "${selectedSection.name}"` : 'Select a Section'}
                </h2>
                <p className="text-xs text-gray-400">
                  {selectedSection ? 'Viewing registered students and verification status (fully verified / not verified).' : 'Click a section on the left to inspect students.'}
                </p>
              </div>

              {selectedSection && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search student or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
              )}
            </div>

            {!selectedSection ? (
              <div className="text-center py-24 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl bg-[#111827]/50">
                <Users size={48} className="mx-auto text-gray-700 mb-3" />
                <p className="font-medium text-gray-400">No section selected yet.</p>
                <p className="text-xs text-gray-600">Please expand a teacher's details and click a section to view enrolled students.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-20 text-gray-500 border border-gray-800 rounded-2xl bg-[#111827]/50">
                <p className="font-medium text-gray-400">No students found in this section.</p>
                <p className="text-xs text-gray-600">Teacher has not enrolled any students here yet or search yielded no results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#1f2937]/50">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Verification Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {filteredStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-[#1f2937]/30 transition">
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shadow-inner">
                            {st.photoUrl ? (
                              <img src={st.photoUrl} alt={st.name} className="w-full h-full object-cover" />
                            ) : (
                              st.name ? st.name.charAt(0) : 'S'
                            )}
                          </div>
                          <div>
                            <div>{st.name}</div>
                            <div className="text-xs text-gray-500">ID: {st.id}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400">{st.username}</td>
                        <td className="py-3 px-4">
                          {st.isVerified ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              <CheckCircle size={14} className="text-emerald-400" /> Fully Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800">
                              <XCircle size={14} className="text-amber-400" /> Not Verified
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs text-gray-500 font-medium">Enrolled</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* REGISTER TEACHER MODAL */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-[#1f2937]/50 px-6 py-4 border-b border-gray-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-400" /> Register New Teacher
              </h3>
              <button 
                onClick={() => setShowAddTeacherModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Juan Dela Cruz"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="juandelacruz"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="juandelacruz@school.edu"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Music / IT"
                    value={teacherSubject}
                    onChange={(e) => setTeacherSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Room</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab 302"
                    value={teacherRoom}
                    onChange={(e) => setTeacherRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1f2937] border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 border border-gray-700 rounded-xl text-sm text-gray-300 hover:bg-gray-800 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-500 transition shadow-md disabled:opacity-50"
                >
                  {registering ? 'Registering...' : 'Save Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}