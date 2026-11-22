import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Modal } from '../../../shared/components/Modal/Modal';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';
import {
  UserPlus,
  Eye,
  EyeOff,
  Calendar,
  FileText,
  AlertTriangle,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';
import { schoolStore, SCHOOL_CLASSES, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [classCounts, setClassCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingCreds, setIsResettingCreds] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedClass, pageSize]);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await schoolStore.fetchStudents({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch,
        class: selectedClass
      });
      if (res && res.data) {
        setStudentsList(res.data);
        setTotalStudents(res.total || 0);
        if (res.classCounts) {
          setClassCounts(res.classCounts);
        }
      } else if (Array.isArray(res)) {
        setStudentsList(res);
        setTotalStudents(res.length);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, selectedClass]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    return subscribeSchoolSync((topic) => {
      if (topic === 'students' || !topic) {
        loadStudents();
      }
    });
  }, [loadStudents]);

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    await schoolStore.deleteStudent(studentToDelete.id);
    if (selectedStudent?.id === studentToDelete.id) {
      setSelectedStudent(null);
    }
    setStudentToDelete(null);
    loadStudents();
  };

  const handleCopy = (value, label) => {
    if (!value || !navigator?.clipboard) return;
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 1800);
  };

  const handleResetStudentPassword = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const trimmed = resetPasswordInput.trim();
    if (trimmed && trimmed.length < 6) {
      setResetResult({ error: 'Password must be at least 6 characters (or leave blank to auto-generate).' });
      return;
    }
    setIsResettingCreds(true);
    setResetResult(null);
    try {
      const result = await schoolStore.resetStudentCredentials(selectedStudent.id, {
        ...(trimmed ? { password: trimmed } : {})
      });
      setResetResult({ credentials: result.credentials });
      setResetPasswordInput('');
    } catch (err) {
      setResetResult({ error: err?.message || 'Unable to reset student portal password.' });
    } finally {
      setIsResettingCreds(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Students
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Manage student admissions, class placements, and profile records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/students/admit"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit New Student</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SCHOOL_CLASSES.map((cls) => {
          const count = classCounts[cls] || 0;
          const isSelected = selectedClass === cls;
          return (
            <button
              type="button"
              key={cls}
              onClick={() => setSelectedClass(isSelected ? 'all' : cls)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#616218] text-white border-[#616218] shadow-xs'
                  : 'bg-white text-[#1c1c14] border-[#c9c7b6] hover:bg-[#faf8f0]'
              }`}
            >
              <div className="text-[11px] font-semibold opacity-80 uppercase tracking-wide">
                {cls}
              </div>
              <div className="text-xl font-bold mt-0.5 tabular-nums">
                {count} <span className="text-xs font-normal opacity-75">students</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, admission number, state, or parent name..."
              onClear={() => setSearchTerm('')}
            />
          </div>
          <div className="w-full sm:w-56 shrink-0">
            <select
              className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {SCHOOL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#c9c7b6]/40">
          <h2 className="text-base font-bold text-[#1c1c14]">
            Enrolled Students
          </h2>
          <span className="text-xs text-[#797869]">2026/2027 Session</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#faf8f0] text-xs font-bold text-[#1c1c14] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Adm. Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Guardian Name</th>
                <th className="py-3 px-4">Guardian Phone</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9c7b6]/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#797869]">
                    Loading students...
                  </td>
                </tr>
              ) : studentsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#797869]">
                    No students match the selected class or search query.
                  </td>
                </tr>
              ) : (
                studentsList.map((student) => (
                  <tr key={student.id} className="hover:bg-[#fbf9f1] transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-xs text-[#616218]">
                      {student.admissionNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#1c1c14]">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar src={student.avatarUrl} name={student.name} size="sm" />
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6]/70">
                        {student.class}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-[#1c1c14]">
                      {student.parentName}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#797869] tabular-nums">
                      {student.parentPhone}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <TableActions
                        actions={[
                          {
                            label: 'View Profile',
                            icon: Eye,
                            onClick: () => {
                              setResetResult(null);
                              setResetPasswordInput('');
                              setSelectedStudent(student);
                            }
                          },
                          {
                            label: 'Attendance Record',
                            to: `/admin/attendance?student=${student.id}`
                          },
                          {
                            label: 'Report Card',
                            to: `/admin/reports?student=${student.id}`
                          },
                          {
                            label: 'Remove Student',
                            onClick: () => setStudentToDelete(student),
                            danger: true
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalStudents}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="students"
        />
      </div>

      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title="Student Profile"
        subtitle={selectedStudent ? (selectedStudent.name || '') : ''}
        size="md"
        footer={
          selectedStudent && (
            <>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="inline-flex items-center justify-center h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <Link
                to={`/admin/attendance?student=${selectedStudent.id}`}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold rounded-lg bg-white hover:bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6] shadow-xs transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#616218]" />
                <span>Attendance Record</span>
              </Link>
              <Link
                to={`/admin/reports?student=${selectedStudent.id}`}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold rounded-lg bg-[#616218] hover:bg-[#494900] text-white shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Report Card</span>
              </Link>
            </>
          )
        }
      >
        {selectedStudent && (
          <div className="space-y-6 text-sm">
            <div className="flex items-center gap-4 p-4 bg-[#faf8f0] rounded-xl border border-[#c9c7b6]/70">
              <ProfileAvatar src={selectedStudent.avatarUrl} name={selectedStudent.name || 'Student'} size="lg" />
              <div className="min-w-0">
                <h3 className="font-bold text-base text-[#1c1c14]">{selectedStudent.name || 'Student Profile'}</h3>
                <p className="text-xs text-[#797869] mt-0.5">Active Student</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3 p-4 bg-white rounded-xl border border-[#c9c7b6]/60 text-xs">
                <span className="font-bold text-[#616218] block text-[11px] uppercase tracking-wider border-b border-[#c9c7b6]/40 pb-2">
                  Personal & Origin Details
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#797869] block">Admission Number</span>
                    <span className="font-mono font-bold text-[#616218]">{selectedStudent.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Class</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.class}</span>
                  </div>
                  {selectedStudent.department && (
                    <div>
                      <span className="text-[#797869] block">Department</span>
                      <span className="font-semibold text-[#1c1c14]">{selectedStudent.department}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[#797869] block">Enrollment Date</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.enrollmentDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Gender</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.gender || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Date of Birth</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.dateOfBirth || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">State of Origin</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.stateOfOrigin || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Local Government Area</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.lga || '-'}</span>
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-[#797869] block">Residential Address</span>
                  <span className="font-semibold text-[#1c1c14]">{selectedStudent.address || '-'}</span>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white rounded-xl border border-[#c9c7b6]/60 text-xs">
                <span className="font-bold text-[#616218] block text-[11px] uppercase tracking-wider border-b border-[#c9c7b6]/40 pb-2">
                  Parent / Guardian Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#797869] block">Guardian Name</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Contact Phone</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentPhone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Email Address</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentEmail || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block">Occupation</span>
                    <span className="font-semibold text-[#1c1c14]">{selectedStudent.parentOccupation || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#c9c7b6]/60 space-y-2.5 text-xs">
                <span className="font-bold text-[#616218] block text-[11px] uppercase tracking-wider">
                  Enrolled Subjects
                </span>
                <div className="flex flex-wrap gap-2">
                  {(selectedStudent.enrolledSubjects || []).map((sub) => (
                    <span
                      key={sub}
                      className="px-2.5 py-1 rounded-md bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6]/60 text-[11px] font-medium"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleResetStudentPassword} className="p-4 bg-[#faf8f0] rounded-xl border border-[#c9c7b6]/70 space-y-3 text-xs">
                <div className="flex items-center gap-2 border-b border-[#c9c7b6]/40 pb-2">
                  <KeyRound className="w-4 h-4 text-[#616218]" />
                  <span className="font-bold text-[#616218] uppercase tracking-wider text-[11px]">
                    Portal Access & Password Reset
                  </span>
                </div>
                <p className="text-[11px] text-[#797869]">
                  Student signs in with Admission No. <strong className="font-mono text-[#1c1c14]">{selectedStudent.admissionNumber}</strong>
                  {selectedStudent.email ? (
                    <> or Portal Email <strong className="text-[#1c1c14]">{selectedStudent.email}</strong></>
                  ) : null}.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      placeholder="New password (leave blank to auto-generate)"
                      className="w-full h-9 pl-3 pr-9 rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] placeholder-[#797869] text-xs focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#797869] hover:text-[#1c1c14] cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isResettingCreds}
                    className="inline-flex items-center justify-center h-9 px-3.5 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isResettingCreds ? 'Updating...' : 'Reset Password'}
                  </button>
                </div>

                {resetResult?.error && (
                  <p className="text-[11px] text-rose-700 font-medium">{resetResult.error}</p>
                )}

                {resetResult?.credentials && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Updated Portal Credentials
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Email: <strong>{resetResult.credentials.email}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(resetResult.credentials.email, 'stu-email')}
                        className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        {copiedField === 'stu-email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Temporary Password: <strong className="font-mono">{resetResult.credentials.temporaryPassword}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(resetResult.credentials.temporaryPassword, 'stu-pass')}
                        className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        {copiedField === 'stu-pass' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        variant="confirm"
        title="Remove Student Record"
        footer={
          <>
            <button
              type="button"
              onClick={() => setStudentToDelete(null)}
              className="inline-flex items-center justify-center h-10 px-4 text-xs font-semibold rounded-lg border border-[#c9c7b6] bg-white text-[#1c1c14] hover:bg-[#faf8f0] shadow-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteStudent}
              className="inline-flex items-center justify-center h-10 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              Remove Student
            </button>
          </>
        }
      >
        {studentToDelete && (
          <div className="flex items-start gap-3 text-xs text-[#44443b] leading-relaxed">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#1c1c14] mb-1">
                Remove {studentToDelete.name}?
              </p>
              <p>
                This will remove <strong>{studentToDelete.admissionNumber}</strong> from the school student roster.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StudentManagement;
