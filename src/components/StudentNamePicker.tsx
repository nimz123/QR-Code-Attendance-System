import React, { useState } from 'react';
import { CheckCircle, Search, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../types';

interface StudentNamePickerProps {
  studentsList: Student[];
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  onUpdateStudentPhoto?: (studentId: string, photoUrl: string) => void;
}

export default function StudentNamePicker({
  studentsList,
  selectedStudentId,
  onSelectStudent,
  onUpdateStudentPhoto
}: StudentNamePickerProps) {
  const [studentSearch, setStudentSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);
  const filteredStudents = studentsList.filter(student =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <>
      {/* Student searchable input */}
      <div className="space-y-2 relative">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <User size={14} className="text-gray-400" />
          <span>2. Select Your Name</span>
        </label>

        {/* Custom Searchable Select Dropdown */}
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="student-name-search"
              type="text"
              placeholder={
                selectedStudentId
                  ? studentsList.find(s => s.id === selectedStudentId)?.name
                  : "Type to search your name..."
              }
              value={studentSearch}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setIsDropdownOpen(true);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {selectedStudentId && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                Selected
              </span>
            )}
          </div>

          {/* Suggestions Overlay */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute z-20 w-full bg-white border border-gray-200 mt-1.5 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50"
              >
                {filteredStudents.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400 italic">
                    No students found matching "{studentSearch}"
                  </div>
                ) : (
                  filteredStudents.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      id={`dropdown-student-item-${student.id}`}
                      onClick={() => {
                        onSelectStudent(student.id);
                        setStudentSearch(''); // Clear search so input shows the placeholder/selection
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        selectedStudentId === student.id ? 'bg-indigo-50/50 text-indigo-700' : 'text-gray-700'
                      }`}
                    >
                      <span>{student.name}</span>
                      {selectedStudentId === student.id && <CheckCircle size={14} className="text-indigo-600" />}
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Click away from dropdown listener overlay */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>

      {/* Optional Student Photo */}
      {selectedStudentId && selectedStudent && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {selectedStudent.photoUrl ? (
                <img
                  src={selectedStudent.photoUrl}
                  alt={selectedStudent.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="text-gray-400" size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Your Profile Picture</span>
              <p className="text-xs text-gray-500 font-semibold truncate">
                {selectedStudent.photoUrl ? "Your photo is configured" : "Add your photo to your profile (Optional)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-2xs">
                <span>{selectedStudent.photoUrl ? "Change" : "Upload"}</span>
                <input
                  id="student-photo-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        alert('File is too large. Max size is 2MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string' && onUpdateStudentPhoto) {
                          onUpdateStudentPhoto(selectedStudentId, reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {selectedStudent.photoUrl && (
                <button
                  id="btn-remove-student-photo"
                  type="button"
                  onClick={() => onUpdateStudentPhoto && onUpdateStudentPhoto(selectedStudentId, '')}
                  className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs px-2.5 py-1.5 rounded-xl transition"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
