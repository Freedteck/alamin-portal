import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  Check,
  Users,
  UserCheck,
  Printer
} from 'lucide-react';
import {
  schoolStore,
  SCHOOL_CLASSES,
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
  const [selectedClass, setSelectedClass] = useState('SSS 2');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [toast, setToast] = useState(null);
  const [students, setStudents] = useState([]);

  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentAuditData, setStudentAuditData] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [rollPage, setRollPage] = useState(1);
  const [rollPageSize, setRollPageSize] = useState(5);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(5);
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    return subscribeSchoolSync(() => setSyncTick((t) => t + 1));
  }, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    const allTeachers = schoolStore.getTeachers();
    const defaultTeacher =
      allTeachers.find(
        (t) =>
          (saved.email && t.email?.toLowerCase() === saved.email.toLowerCase()) ||
          (saved.name && t.name?.toLowerCase() === saved.name.toLowerCase())
      ) ||
      allTeachers[0] ||
      (saved.name ? { name: saved.name, assignedClasses: [] } : null);
    setCurrentTeacher(defaultTeacher);

    if (defaultTeacher && defaultTeacher.assignedClasses?.length > 0) {
      setSelectedClass(defaultTeacher.assignedClasses[0].class);
    }
  }, [syncTick]);

  useEffect(() => {
    setRollPage(1);
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    const allStudents = schoolStore.getStudents().filter((s) => s.class === selectedClass);
    setStudents(allStudents);

    const existing = schoolStore.getAttendanceForDateAndClass(selectedDate, selectedClass);
    if (existing && existing.records) {
      setAttendanceRecords(existing.records);
    } else {
      const defaults = {};
      allStudents.forEach((s) => {
        defaults[s.id] = 'present';
      });
      setAttendanceRecords(defaults);
    }
  }, [selectedClass, selectedDate, syncTick]);

  useEffect(() => {
    setAuditPage(1);
  }, [selectedStudentId]);

  useEffect(() => {
    const allStudents = schoolStore.getStudents();
    if (selectedStudentId && allStudents.some((s) => s.id === selectedStudentId)) {
      const audit = schoolStore.getStudentAttendanceHistory(selectedStudentId);
      setStudentAuditData(audit);
    } else if (allStudents.length > 0) {
      setSelectedStudentId(allStudents[0].id);
      setStudentAuditData(schoolStore.getStudentAttendanceHistory(allStudents[0].id));
    } else {
      setStudentAuditData(null);
    }
  }, [selectedStudentId, syncTick]);

  const setStatus = (studentId, status) => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markAllPresent = () => {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = 'present';
    });
    setAttendanceRecords(updated);
    showToast('All students marked as Present on roll call.');
  };

  const handleSaveAttendance = () => {
    const teacherName = currentTeacher?.name || 'Teaching Staff';
    schoolStore.saveAttendance(selectedDate, selectedClass, teacherName, attendanceRecords);
    showToast(`Attendance for Class ${selectedClass} saved successfully! Synced with Admin.`);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const allSchoolStudents = schoolStore.getStudents();
  const filteredStudentList = allSchoolStudents.filter((s) => {
    const matchesClass = studentClassFilter === 'all' || s.class === studentClassFilter;
    const term = studentSearch.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(term) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(term)) ||
      s.class.toLowerCase().includes(term);
    return matchesClass && matchesSearch;
  });

  const presentCount = Object.values(attendanceRecords).filter((v) => v === 'present').length;
  const absentCount = Object.values(attendanceRecords).filter((v) => v === 'absent').length;
  const lateCount = Object.values(attendanceRecords).filter((v) => v === 'late').length;
  const total = students.length;
  const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  const teacherClasses = schoolStore.getClassesForTeacher(currentTeacher);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Student Attendance Portal
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Mark daily morning registers, track punctuality, and audit student attendance records
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'rollcall' && (
            <>
              <Button
                variant="outline"
                onClick={markAllPresent}
              >
                <Check className="w-3.5 h-3.5 text-[#616218]" />
                <span>Mark All Present</span>
              </Button>
              <Button
                onClick={handleSaveAttendance}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Submit Register</span>
              </Button>
            </>
          )}
        </div>
      </div>

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

      {activeTab === 'rollcall' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-60">
                <label className="text-xs font-bold text-[#1c1c14] block mb-1.5">
                  Select Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {teacherClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-60">
                <label className="text-xs font-bold text-[#1c1c14] block mb-1.5">
                  Register Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex-1 w-full flex items-end justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                <div className="text-xs text-[#797869]">
                  Teacher in Charge:{' '}
                  <span className="font-bold text-[#1c1c14]">
                    {currentTeacher ? currentTeacher.name : 'Subject Master'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
              <span className="text-xs font-semibold text-[#797869] uppercase">Class Enrolled</span>
              <div className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">{total}</div>
              <span className="text-[11px] text-[#797869]">{selectedClass} students</span>
            </div>

            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <span className="text-xs font-semibold text-emerald-800 uppercase">Present</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{presentCount}</div>
              <span className="text-[11px] text-emerald-600">On roll call</span>
            </div>

            <div className="p-4 rounded-lg border border-rose-200 bg-rose-50/50 shadow-xs">
              <span className="text-xs font-semibold text-rose-800 uppercase">Absent</span>
              <div className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">{absentCount}</div>
              <span className="text-[11px] text-rose-600">Unexcused</span>
            </div>

            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 shadow-xs">
              <span className="text-xs font-semibold text-amber-800 uppercase">Late Arrivals</span>
              <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{lateCount}</div>
              <span className="text-[11px] text-amber-600">Tardy arrival</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c9c7b6]/40">
              <div>
                <h3 className="text-base font-bold text-[#1c1c14]">
                  Roll Call Roster for Class {selectedClass}
                </h3>
                <p className="text-xs text-[#797869]">
                  Mark Present, Absent, or Late for each student. Saves persist directly to central database.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#f0ebd5] text-[#494900]">
                Attendance: {attendanceRate}%
              </span>
            </div>

            <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#fdf9ec] text-xs font-bold text-[#494900] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center">Mark Status</th>
                    <th className="py-3 px-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/40">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#797869]">
                        No students enrolled in Class {selectedClass} yet.
                      </td>
                    </tr>
                  ) : (
                    students
                      .slice((rollPage - 1) * rollPageSize, rollPage * rollPageSize)
                      .map((student) => {
                        const currentStatus = attendanceRecords[student.id] || 'present';
                        return (
                          <tr key={student.id} className="hover:bg-[#fbf9f1] transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-xs text-[#616218]">
                              {student.admissionNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <ProfileAvatar name={student.name} size="sm" />
                                <span className="font-semibold text-[#1c1c14]">{student.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/60">
                                <button
                                  type="button"
                                  onClick={() => setStatus(student.id, 'present')}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                    currentStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-stone-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatus(student.id, 'late')}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                    currentStatus === 'late'
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : 'text-stone-600 hover:text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  Late
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatus(student.id, 'absent')}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                    currentStatus === 'absent'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'text-stone-600 hover:text-rose-700 hover:bg-rose-50'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <TableActions
                                actions={[
                                  {
                                    label: 'Check Student Attendance History',
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
                    const nextList = allSchoolStudents.filter((s) => cls === 'all' || s.class === cls);
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
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!studentAuditData ? (
            <div className="rounded-lg border border-[#c9c7b6] bg-white p-8 text-center text-xs text-[#797869]">
              No students enrolled yet. Add or admit students first to audit individual attendance records.
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
                        <span className="font-mono font-bold text-[#494900]">{studentAuditData.student.admissionNumber}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Class</span>
                        <span className="font-bold text-[#1c1c14]">{studentAuditData.student.class}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Guardian Name</span>
                        <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.parentName}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block">Guardian Phone</span>
                        <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.parentPhone}</span>
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
                    <span className="text-[10px] text-emerald-700 font-semibold">Good Academic Standing</span>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">Days Present</span>
                    <div className="text-2xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                      {studentAuditData.presentCount}
                    </div>
                    <span className="text-[10px] text-emerald-600">Recorded sessions</span>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-[11px] font-bold text-rose-800 uppercase">Days Absent</span>
                    <div className="text-2xl font-bold text-rose-700 mt-0.5 tabular-nums">
                      {studentAuditData.absentCount}
                    </div>
                    <span className="text-[10px] text-rose-600">Absences</span>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase">Late Arrivals</span>
                    <div className="text-2xl font-bold text-amber-700 mt-0.5 tabular-nums">
                      {studentAuditData.lateCount}
                    </div>
                    <span className="text-[10px] text-amber-600">Punctuality Score: {studentAuditData.punctualityRate}%</span>
                  </div>
                </div>
              </div>

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
                      {studentAuditData.logs
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
                            {log.status === 'present' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Present</span>
                              </span>
                            )}
                            {log.status === 'absent' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Absent</span>
                              </span>
                            )}
                            {log.status === 'late' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Late</span>
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
                      ))}
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
