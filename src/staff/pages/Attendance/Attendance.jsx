import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Save,
  Check,
  X,
  Users,
  UserCheck,
  Printer,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import {
  schoolStore,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Button } from '../../../shared/components/Button/Button';
import { TableActions } from '../../../shared/components/TableActions/TableActions';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';

export function StaffAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStudentId = searchParams.get('student') || '';

  const [activeTab, setActiveTab] = useState(initialStudentId ? 'student' : 'rollcall');
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [toast, setToast] = useState(null);
  const [students, setStudents] = useState([]);

  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentAuditData, setStudentAuditData] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [rollPage, setRollPage] = useState(1);
  const [rollPageSize, setRollPageSize] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(5);
  const [syncTick, setSyncTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return subscribeSchoolSync(() => setSyncTick((t) => t + 1));
  }, []);

  const savedUser = JSON.parse(localStorage.getItem('alamin_user') || '{}');

  useEffect(() => {
    const allTeachers = schoolStore.getTeachers();
    const teacher =
      allTeachers.find(
        (t) =>
          (savedUser.teacherId && t.id === savedUser.teacherId) ||
          (savedUser.email && t.email?.toLowerCase() === savedUser.email.toLowerCase()) ||
          (savedUser.name && t.name?.toLowerCase() === savedUser.name.toLowerCase())
      ) ||
      allTeachers[0] ||
      (savedUser.name ? { name: savedUser.name, classTeacherOf: [] } : null);

    setCurrentTeacher(teacher);

    const myClasses = Array.isArray(teacher?.classTeacherOf)
      ? teacher.classTeacherOf
      : (Array.isArray(savedUser?.classTeacherOf) ? savedUser.classTeacherOf : []);

    if (myClasses.length > 0) {
      setSelectedClass((prev) => (myClasses.includes(prev) ? prev : myClasses[0]));
    }
  }, [syncTick]);

  const teacherClasses = Array.isArray(currentTeacher?.classTeacherOf)
    ? currentTeacher.classTeacherOf
    : (Array.isArray(savedUser?.classTeacherOf) ? savedUser.classTeacherOf : []);

  const isClassTeacher = teacherClasses.length > 0;

  useEffect(() => {
    setRollPage(1);
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    if (!selectedClass) return;
    const allStudents = schoolStore.getStudents().filter((s) => s.class === selectedClass);
    setStudents(allStudents);

    const existing = schoolStore.getAttendanceForDateAndClass(selectedDate, selectedClass);
    if (existing && existing.records) {
      setAttendanceRecords(existing.records);
    } else {
      // Clean slate for unrecorded date: default unchecked (absent)
      const defaults = {};
      allStudents.forEach((s) => {
        defaults[s.id] = 'absent';
      });
      setAttendanceRecords(defaults);
    }
  }, [selectedClass, selectedDate, syncTick]);

  useEffect(() => {
    setAuditPage(1);
  }, [selectedStudentId]);

  useEffect(() => {
    const eligibleStudents = schoolStore
      .getStudents()
      .filter((s) => teacherClasses.length === 0 || teacherClasses.includes(s.class));

    if (selectedStudentId && eligibleStudents.some((s) => s.id === selectedStudentId)) {
      const audit = schoolStore.getStudentAttendanceHistory(selectedStudentId);
      setStudentAuditData(audit);
    } else if (eligibleStudents.length > 0) {
      setSelectedStudentId(eligibleStudents[0].id);
      setStudentAuditData(schoolStore.getStudentAttendanceHistory(eligibleStudents[0].id));
    } else {
      setStudentAuditData(null);
    }
  }, [selectedStudentId, teacherClasses.join(','), syncTick]);

  // If user is not assigned as a Class Teacher
  if (!isClassTeacher && savedUser.role === 'teacher') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 font-['Poppins',sans-serif]">
        <div className="rounded-xl border border-[#c9c7b6] bg-white p-8 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#1c1c14]">
            Class Teacher Attendance Access Only
          </h2>
          <p className="text-sm text-[#797869] mt-2 leading-relaxed">
            You are currently not designated as the <strong>Class Teacher</strong> for any classroom.
            Daily morning registers and roll call marking are restricted to appointed Class Teachers.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/teacher/dashboard">
              <Button>
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const toggleStudent = (studentId) => {
    setAttendanceRecords((prev) => {
      const current = prev[studentId];
      const next = current === 'present' ? 'absent' : 'present';
      return {
        ...prev,
        [studentId]: next
      };
    });
  };

  const presentCount = students.filter((s) => attendanceRecords[s.id] === 'present').length;
  const absentCount = students.length - presentCount;
  const allPresent = students.length > 0 && presentCount === students.length;
  const total = students.length;
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  const toggleAll = () => {
    const nextStatus = allPresent ? 'absent' : 'present';
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = nextStatus;
    });
    setAttendanceRecords(updated);
    showToast(allPresent ? 'All students unmarked (Absent).' : 'All students marked as Present.');
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      showToast('Please select a class first.');
      return;
    }
    setIsSaving(true);
    try {
      const teacherName = currentTeacher?.name || savedUser.name || 'Class Teacher';
      const res = await schoolStore.saveAttendance(selectedDate, selectedClass, teacherName, attendanceRecords);
      if (res?.error) {
        showToast(res.error);
      } else {
        showToast(`Attendance for Class ${selectedClass} saved successfully!`);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save attendance register.');
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const allTeacherStudents = schoolStore
    .getStudents()
    .filter((s) => teacherClasses.includes(s.class));

  const filteredStudentList = allTeacherStudents.filter((s) => {
    const matchesClass = studentClassFilter === 'all' || s.class === studentClassFilter;
    const term = studentSearch.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(term) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(term)) ||
      s.class.toLowerCase().includes(term);
    return matchesClass && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
              Class Attendance Register
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fdf9ec] text-[#616218] border border-[#c9c7b6]/80">
              Class Teacher Portal
            </span>
          </div>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Mark present students with a single checkbox. Unchecked students are automatically recorded as absent.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'rollcall' && (
            <>
              <Button
                variant="outline"
                onClick={toggleAll}
                disabled={students.length === 0}
              >
                <Check className="w-3.5 h-3.5 text-[#616218]" />
                <span>{allPresent ? 'Uncheck All' : 'Mark All Present'}</span>
              </Button>
              <Button
                onClick={handleSaveAttendance}
                disabled={isSaving || students.length === 0}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save & Submit Register'}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#c9c7b6]/60 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab('rollcall');
            setSearchParams({});
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'rollcall'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Class Roll Call Register</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('student')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'student'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Check Student Attendance Record</span>
        </button>
      </div>

      {/* Tab 1: Roll Call Register */}
      {activeTab === 'rollcall' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-64">
                <label className="text-xs font-bold text-[#1c1c14] block mb-1.5">
                  Class (Assigned to You)
                </label>
                {teacherClasses.length > 1 ? (
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm font-semibold text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  >
                    {teacherClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="h-10 px-3.5 rounded-lg border border-[#c9c7b6] bg-[#faf8f0] flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1c1c14]">{selectedClass || 'No Class'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#616218] bg-white px-2 py-0.5 rounded border border-[#c9c7b6]/60">
                      Class Teacher
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-60">
                <label className="text-xs font-bold text-[#1c1c14] block mb-1.5">
                  Register Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                />
              </div>

              <div className="flex-1 w-full flex items-end justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                <div className="text-xs text-[#797869]">
                  Class Teacher in Charge:{' '}
                  <span className="font-bold text-[#1c1c14]">
                    {currentTeacher ? currentTeacher.name : (savedUser.name || 'Class Teacher')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
              <span className="text-xs font-semibold text-[#797869] uppercase">Class Enrolled</span>
              <div className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">{total}</div>
              <span className="text-[11px] text-[#797869]">{selectedClass} students</span>
            </div>

            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <span className="text-xs font-semibold text-emerald-800 uppercase">Present</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{presentCount}</div>
              <span className="text-[11px] text-emerald-600">Marked on register</span>
            </div>

            <div className="p-4 rounded-lg border border-stone-200 bg-[#faf8f0] shadow-xs">
              <span className="text-xs font-semibold text-stone-700 uppercase">Absent</span>
              <div className="text-2xl font-bold text-stone-700 mt-1 tabular-nums">{absentCount}</div>
              <span className="text-[11px] text-stone-500">Unchecked (Automatic)</span>
            </div>

            <div className="p-4 rounded-lg border border-[#c9c7b6] bg-[#fdf9ec] shadow-xs">
              <span className="text-xs font-semibold text-[#616218] uppercase">Attendance Rate</span>
              <div className="text-2xl font-bold text-[#616218] mt-1 tabular-nums">{attendanceRate}%</div>
              <span className="text-[11px] text-[#494900]">Daily turnout</span>
            </div>
          </div>

          {/* Student Roll Call Table */}
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c9c7b6]/40">
              <div>
                <h3 className="text-base font-bold text-[#1c1c14]">
                  Roll Call Roster for Class {selectedClass}
                </h3>
                <p className="text-xs text-[#797869]">
                  Check the box to mark student present. Unchecked students are automatically absent.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#fdf9ec] text-[#494900] border border-[#c9c7b6]/60">
                {presentCount} of {total} Present
              </span>
            </div>

            <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#fdf9ec] text-xs font-bold text-[#494900] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={allPresent}
                        onChange={toggleAll}
                        disabled={students.length === 0}
                        title="Toggle all students"
                        className="w-4 h-4 rounded border-[#c9c7b6] text-[#616218] focus:ring-[#616218]/30 cursor-pointer accent-[#616218]"
                      />
                    </th>
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Mark Present</th>
                    <th className="py-3 px-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/40">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#797869] text-xs">
                        No students enrolled in Class {selectedClass} yet.
                      </td>
                    </tr>
                  ) : (
                    students
                      .slice((rollPage - 1) * rollPageSize, rollPage * rollPageSize)
                      .map((student, idx) => {
                        const isPresent = attendanceRecords[student.id] === 'present';
                        const rowNum = (rollPage - 1) * rollPageSize + idx + 1;
                        return (
                          <tr
                            key={student.id}
                            className={`transition-colors ${
                              isPresent ? 'bg-emerald-50/25 hover:bg-emerald-50/40' : 'hover:bg-[#faf8f0]'
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isPresent}
                                onChange={() => toggleStudent(student.id)}
                                className="w-4 h-4 rounded border-[#c9c7b6] text-[#616218] focus:ring-[#616218]/30 cursor-pointer accent-[#616218]"
                              />
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-[#797869]">
                              #{rowNum}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-xs text-[#616218]">
                              {student.admissionNumber || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <ProfileAvatar name={student.name} size="sm" shape="rounded" />
                                <span className="font-semibold text-[#1c1c14]">{student.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Present</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                  <X className="w-3 h-3 text-stone-400" />
                                  <span>Absent</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleStudent(student.id)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-[#c9c7b6] hover:bg-[#faf8f0]'
                                }`}
                              >
                                {isPresent ? 'Marked Present' : 'Click to Mark Present'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <TableActions
                                actions={[
                                  {
                                    label: 'Check Attendance History',
                                    icon: UserCheck,
                                    onClick: () => {
                                      setSelectedStudentId(student.id);
                                      setActiveTab('student');
                                      setSearchParams({ student: student.id });
                                    }
                                  }
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={rollPage}
                totalItems={students.length}
                pageSize={rollPageSize}
                onPageChange={setRollPage}
                onPageSizeChange={(size) => {
                  setRollPageSize(size);
                  setRollPage(1);
                }}
                itemLabel="students"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Individual Student Attendance Audit */}
      {activeTab === 'student' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#1c1c14] mb-3">
              Check Student Attendance Record
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <SearchInput
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filter by name or admission number..."
                />
              </div>
              <div>
                <select
                  value={studentClassFilter}
                  onChange={(e) => {
                    const cls = e.target.value;
                    setStudentClassFilter(cls);
                    const nextList = allTeacherStudents.filter((s) => cls === 'all' || s.class === cls);
                    if (nextList[0]) {
                      setSelectedStudentId(nextList[0].id);
                      setSearchParams({ student: nextList[0].id });
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  <option value="all">All Assigned Classes</option>
                  {teacherClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    setSearchParams({ student: e.target.value });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {filteredStudentList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.class})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!studentAuditData || !studentAuditData.student ? (
            <div className="rounded-lg border border-[#c9c7b6] bg-white p-8 text-center text-xs text-[#797869]">
              No students enrolled yet or no record found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-5 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#c9c7b6]/40">
                  <div className="flex items-start gap-3 flex-1">
                    <ProfileAvatar name={studentAuditData.student.name} size="lg" shape="rounded" />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1 text-xs">
                      <div>
                        <span className="text-[#797869] block">Student Name</span>
                        <span className="text-sm font-bold text-[#1c1c14]">{studentAuditData.student.name}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Admission Number</span>
                        <span className="font-mono font-bold text-[#494900]">{studentAuditData.student.admissionNumber || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Class</span>
                        <span className="font-bold text-[#1c1c14]">{studentAuditData.student.class}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Guardian Name</span>
                        <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.parentName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Guardian Phone</span>
                        <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.parentPhone || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] shadow-xs inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#616218]" />
                    <span>Print Attendance Audit</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <div className="p-3 rounded-lg bg-[#fdf9ec] border border-[#c9c7b6]/60">
                    <span className="text-[11px] font-bold text-[#797869] uppercase">Attendance Rate</span>
                    <div className="text-2xl font-bold text-[#616218] mt-0.5 tabular-nums">
                      {studentAuditData.attendanceRate}%
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold">Academic Standing</span>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">Days Present</span>
                    <div className="text-2xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                      {studentAuditData.presentCount}
                    </div>
                    <span className="text-[10px] text-emerald-600">Sessions Attended</span>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                    <span className="text-[11px] font-bold text-stone-700 uppercase">Days Absent</span>
                    <div className="text-2xl font-bold text-stone-700 mt-0.5 tabular-nums">
                      {studentAuditData.absentCount}
                    </div>
                    <span className="text-[10px] text-stone-500">Recorded Absences</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-[#c9c7b6]">
                    <span className="text-[11px] font-bold text-[#797869] uppercase">Total Sessions</span>
                    <div className="text-2xl font-bold text-[#1c1c14] mt-0.5 tabular-nums">
                      {studentAuditData.totalDays}
                    </div>
                    <span className="text-[10px] text-[#797869]">Total School Days Logged</span>
                  </div>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
                <div className="pb-3 mb-3 border-b border-[#c9c7b6]/40">
                  <h4 className="text-sm font-bold text-[#1c1c14]">
                    Verified Attendance History Logs
                  </h4>
                </div>

                <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#fdf9ec] text-xs font-bold text-[#494900] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Recorded By</th>
                        <th className="py-3 px-4">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c9c7b6]/40">
                      {studentAuditData.logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-[#797869]">
                            No attendance records logged for this student yet.
                          </td>
                        </tr>
                      ) : (
                        studentAuditData.logs
                          .slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize)
                          .map((log, idx) => (
                          <tr key={idx} className="hover:bg-[#fbf9f1] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#1c1c14] tabular-nums">
                              {new Date(log.date).toLocaleDateString('en-GB', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="py-3 px-4 font-bold text-xs text-[#494900]">
                              {log.className}
                            </td>
                            <td className="py-3 px-4">
                              {log.status === 'present' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Present</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                  <XCircle className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Absent</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-[#1c1c14]">
                              {log.submittedBy}
                            </td>
                            <td className="py-3 px-4 text-xs text-[#797869] tabular-nums">
                              {log.timestamp}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={auditPage}
                    totalItems={studentAuditData.logs.length}
                    pageSize={auditPageSize}
                    onPageChange={setAuditPage}
                    onPageSizeChange={(size) => {
                      setAuditPageSize(size);
                      setAuditPage(1);
                    }}
                    itemLabel="roll call entries"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StaffAttendance;