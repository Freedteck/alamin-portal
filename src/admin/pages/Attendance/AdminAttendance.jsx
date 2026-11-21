import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Printer,
  Users,
  UserCheck,
  FileText,
  ArrowRight
} from 'lucide-react';
import {
  schoolStore,
  SCHOOL_CLASSES,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';
import { SearchInput } from '../../../shared/components/SearchInput/SearchInput';
import { Button } from '../../../shared/components/Button/Button';
import { Pagination } from '../../../shared/components/Pagination/Pagination';
import { ProfileAvatar } from '../../../shared/components/ProfileAvatar/ProfileAvatar';

export function AdminAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStudentId = searchParams.get('student') || '';

  const [activeTab, setActiveTab] = useState(initialStudentId ? 'student' : 'overview');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allStudents, setAllStudents] = useState([]);
  const [allAttendance, setAllAttendance] = useState({});
  const [registerPage, setRegisterPage] = useState(1);
  const [registerPageSize, setRegisterPageSize] = useState(5);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(5);

  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentAuditData, setStudentAuditData] = useState(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const [studentsRes, attRes] = await Promise.all([
          schoolStore.fetchStudents(),
          schoolStore.fetchAttendance({ date: selectedDate })
        ]);
        if (!active) return;
        const students = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
        setAllStudents(students);
        setAllAttendance(attRes || {});
        if (!selectedStudentId && students.length > 0) {
          setSelectedStudentId(students[0].id);
        } else if (students.length === 0) {
          setSelectedStudentId('');
        }
      } catch (error) {
        console.error('Failed to load attendance overview:', error);
        setAllStudents([]);
        setAllAttendance({});
      }
    };
    sync();
    const unsubscribe = subscribeSchoolSync((topic) => {
      if (topic === 'attendance' || topic === 'students' || !topic) {
        sync();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [selectedDate]);

  useEffect(() => {
    let active = true;
    if (selectedStudentId) {
      schoolStore.fetchStudentAttendanceHistory(selectedStudentId).then((audit) => {
        if (active) {
          setStudentAuditData(audit?.student ? audit : null);
          setAuditPage(1);
        }
      }).catch((error) => {
        console.error('Failed to load student attendance history:', error);
        if (active) {
          setStudentAuditData(null);
          setAuditPage(1);
        }
      });
    } else {
      setStudentAuditData(null);
    }
    return () => {
      active = false;
    };
  }, [selectedStudentId, allAttendance]);

  const classStatus = SCHOOL_CLASSES.map((cls) => {
    const classStudents = allStudents.filter((s) => s.class === cls);
    const key = `${selectedDate}_${cls}`;
    const record = allAttendance[key] || null;

    let present = 0;
    let absent = 0;
    let late = 0;

    if (record && record.records) {
      Object.values(record.records).forEach((st) => {
        if (st === 'present') present++;
        else if (st === 'absent') absent++;
        else if (st === 'late') late++;
      });
    }

    const totalStudents = classStudents.length;
    const isSubmitted = !!record;
    const rate = totalStudents > 0 ? Math.round(((present + late) / totalStudents) * 100) : 0;

    return {
      class: cls,
      isSubmitted,
      submittedBy: record?.submittedBy || 'Pending Submission',
      timestamp: record?.timestamp || '—',
      totalStudents,
      present,
      absent,
      late,
      rate
    };
  });

  const absentStudentsList = [];
  SCHOOL_CLASSES.forEach((cls) => {
    const key = `${selectedDate}_${cls}`;
    const record = allAttendance[key];
    if (record && record.records) {
      Object.entries(record.records).forEach(([studentId, status]) => {
        if (status === 'absent') {
          const student = allStudents.find((s) => s.id === studentId);
          if (student) {
            absentStudentsList.push(student);
          }
        }
      });
    }
  });

  const totalSchoolStudents = allStudents.length;
  const submittedClassesCount = classStatus.filter((c) => c.isSubmitted).length;
  const totalPresentToday = classStatus.reduce((acc, c) => acc + c.present, 0);
  const totalAbsentToday = classStatus.reduce((acc, c) => acc + c.absent, 0);
  const totalMarkedToday = totalPresentToday + totalAbsentToday;
  const overallRate =
    totalMarkedToday > 0
      ? Math.round((totalPresentToday / totalMarkedToday) * 100)
      : 0;

  const filteredStudentList = allStudents.filter((s) => {
    const term = studentSearchTerm.toLowerCase();
    const matchesClass = studentClassFilter === 'all' || s.class === studentClassFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(term) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(term));
    return matchesClass && matchesSearch;
  });

  const openStudentAudit = (studentId) => {
    setSelectedStudentId(studentId);
    setActiveTab('student');
    setSearchParams({ student: studentId });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Attendance Management & Roll Call
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Real-time daily roll call monitoring, class registers, and individual student attendance records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'overview' && (
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 text-[#616218] absolute left-3 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 pl-9 pr-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-[#616218]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <div className="flex border-b border-[#c9c7b6]/60 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab('overview');
            setSearchParams({});
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-[#616218] text-[#494900]'
              : 'border-transparent text-[#797869] hover:text-[#1c1c14]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>School-Wide Daily Roll Call</span>
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

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
              <span className="text-xs font-semibold text-[#797869] uppercase tracking-wide">
                School Attendance Rate
              </span>
              <div className="text-2xl font-bold text-[#616218] mt-1 tabular-nums">
                {overallRate}%
              </div>
              <span className="text-[11px] text-[#797869]">Target: 95%+</span>
            </div>

            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                Present in School
              </span>
              <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                {totalPresentToday}
              </div>
              <span className="text-[11px] text-emerald-600">On morning roll call</span>
            </div>

            <div className="p-4 rounded-lg border border-rose-200 bg-rose-50/50 shadow-xs">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wide">
                Unexcused Absences
              </span>
              <div className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
                {totalAbsentToday}
              </div>
              <span className="text-[11px] text-rose-600">Parent notification desk</span>
            </div>

            <div className="p-4 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
              <span className="text-xs font-semibold text-[#797869] uppercase tracking-wide">
                Classes Submitted
              </span>
              <div className="text-2xl font-bold text-[#1c1c14] mt-1 tabular-nums">
                {submittedClassesCount} / {SCHOOL_CLASSES.length}
              </div>
              <span className="text-[11px] text-[#797869]">Secondary registers</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#c9c7b6]/40">
              <div>
                <h2 className="text-base font-bold text-[#1c1c14]">
                  Secondary Division Class Registers
                </h2>
                <p className="text-xs text-[#797869]">
                  Roll call status for {new Date(selectedDate).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#fdf9ec] text-xs font-bold text-[#494900] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Register Status</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Time Recorded</th>
                    <th className="py-3 px-4 text-center">Enrolled</th>
                    <th className="py-3 px-4 text-center">Present</th>
                    <th className="py-3 px-4 text-center">Absent</th>
                    <th className="py-3 px-4 text-center">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c9c7b6]/40">
                  {classStatus
                    .slice((registerPage - 1) * registerPageSize, registerPage * registerPageSize)
                    .map((c) => (
                    <tr key={c.class} className="hover:bg-[#fbf9f1] transition-colors">
                      <td className="py-3 px-4 font-bold text-[#1c1c14]">
                        <span className="px-2.5 py-1 rounded bg-[#f0ebd5] text-[#494900]">
                          {c.class}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {c.isSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Submitted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Awaiting Register</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[#1c1c14]">
                        {c.submittedBy}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#797869] tabular-nums">
                        {c.timestamp}
                      </td>
                      <td className="py-3 px-4 text-center font-medium tabular-nums">
                        {c.totalStudents}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-700 tabular-nums">
                        {c.present}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-rose-700 tabular-nums">
                        {c.absent}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block font-bold text-xs tabular-nums px-2 py-0.5 rounded ${
                            c.rate >= 90
                              ? 'text-emerald-700 bg-emerald-50'
                              : c.rate >= 75
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-rose-700 bg-rose-50'
                          }`}
                        >
                          {c.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={registerPage}
                totalItems={classStatus.length}
                pageSize={registerPageSize}
                onPageChange={setRegisterPage}
                onPageSizeChange={(size) => {
                  setRegisterPageSize(size);
                  setRegisterPage(1);
                }}
                itemLabel="classes"
              />
            </div>
          </div>

          {absentStudentsList.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-rose-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-bold text-rose-900">
                    Absentee Follow-Up Desk
                  </h3>
                </div>
                <span className="text-xs font-semibold text-rose-700">
                  {absentStudentsList.length} {absentStudentsList.length === 1 ? 'Student' : 'Students'} Absent
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {absentStudentsList.map((st) => (
                  <div
                    key={st.id}
                    className="p-3.5 bg-white rounded-lg border border-rose-200 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#1c1c14]">{st.name}</span>
                      <span className="text-[11px] px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                        {st.class}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[#797869] block text-[10px]">Admission Number</span>
                        <span className="font-mono font-bold text-[#494900]">{st.admissionNumber}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block text-[10px]">Guardian Name</span>
                        <span className="font-medium text-[#1c1c14]">{st.parentName}</span>
                      </div>
                      <div>
                        <span className="text-[#797869] block text-[10px]">Guardian Phone</span>
                        <span className="font-medium text-[#1c1c14] tabular-nums">{st.parentPhone}</span>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => openStudentAudit(st.id)}
                          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Check History</span>
                          <ArrowRight className="w-4 h-4 text-[#616218]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'student' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-[#1c1c14] mb-3">
              Check Attendance For a Certain Student
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <SearchInput
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Filter student list by name or admission number..."
                />
              </div>
              <div>
                <select
                  value={studentClassFilter}
                  onChange={(e) => {
                    const cls = e.target.value;
                    setStudentClassFilter(cls);
                    const matching = allStudents.filter((s) => cls === 'all' || s.class === cls);
                    if (matching.length > 0 && !matching.some((m) => m.id === selectedStudentId)) {
                      setSelectedStudentId(matching[0].id);
                      setSearchParams({ student: matching[0].id });
                    }
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  <option value="all">All Classes</option>
                  {SCHOOL_CLASSES.map((cls) => (
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
                    setSearchParams(e.target.value ? { student: e.target.value } : {});
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-[#c9c7b6] bg-white text-sm font-semibold text-[#1c1c14] focus:outline-none focus:ring-2 focus:ring-[#616218]/20 focus:border-[#616218] hover:border-[#797869] transition-all shadow-xs"
                >
                  {filteredStudentList.length === 0 ? (
                    <option value="">No students enrolled yet</option>
                  ) : (
                    filteredStudentList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {!studentAuditData && (
            <div className="rounded-lg border border-[#c9c7b6] bg-white p-10 text-center text-xs text-[#797869]">
              No student attendance records to inspect yet. Admit students and submit roll calls to view history.
            </div>
          )}

          {studentAuditData && studentAuditData.student && (
            <div className="space-y-6">
              <div className="p-5 rounded-lg border border-[#c9c7b6] bg-white shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#c9c7b6]/40">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={studentAuditData.student.name} size="2xl" shape="rounded" />
                    <div>
                      <h3 className="text-lg font-bold text-[#1c1c14]">
                        {studentAuditData.student.name}
                      </h3>
                      <span className="text-xs font-semibold text-[#616218]">Student Attendance Profile</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/admin/reports?student=${studentAuditData.student.id}`}>
                      <Button variant="outline">
                        <FileText className="w-4 h-4 text-[#616218]" />
                        <span>Terminal Report Card</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-4 border-b border-[#c9c7b6]/40 text-xs">
                  <div>
                    <span className="text-[#797869] block text-[11px]">Admission Number</span>
                    <span className="font-mono font-bold text-[#616218]">{studentAuditData.student.admissionNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block text-[11px]">Class</span>
                    <span className="font-bold text-[#1c1c14]">{studentAuditData.student.class}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block text-[11px]">State of Origin</span>
                    <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.stateOfOrigin}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block text-[11px]">Local Government Area</span>
                    <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.lga}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block text-[11px]">Guardian Name</span>
                    <span className="font-semibold text-[#1c1c14]">{studentAuditData.student.parentName}</span>
                  </div>
                  <div>
                    <span className="text-[#797869] block text-[11px]">Guardian Phone</span>
                    <span className="font-semibold text-[#1c1c14] tabular-nums">{studentAuditData.student.parentPhone}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
                  <div className="p-3 rounded-lg bg-[#fdf9ec] border border-[#c9c7b6]/60">
                    <span className="text-[11px] font-bold text-[#797869] uppercase">Overall Rate</span>
                    <div className="text-2xl font-bold text-[#616218] mt-0.5 tabular-nums">
                      {studentAuditData.attendanceRate}%
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold">Exemplary Standing</span>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">Sessions Attended</span>
                    <div className="text-2xl font-bold text-emerald-700 mt-0.5 tabular-nums">
                      {studentAuditData.presentCount}
                    </div>
                    <span className="text-[10px] text-emerald-600">Present on Roll Call</span>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-[11px] font-bold text-rose-800 uppercase">Absences</span>
                    <div className="text-2xl font-bold text-rose-700 mt-0.5 tabular-nums">
                      {studentAuditData.absentCount}
                    </div>
                    <span className="text-[10px] text-rose-600">Unexcused Misses</span>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase">Late Arrivals</span>
                    <div className="text-2xl font-bold text-amber-700 mt-0.5 tabular-nums">
                      {studentAuditData.lateCount}
                    </div>
                    <span className="text-[10px] text-amber-600">Past 8:15 AM Bell</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#fbf8ed] border border-[#c9c7b6]/60">
                    <span className="text-[11px] font-bold text-[#797869] uppercase">Punctuality Score</span>
                    <div className="text-2xl font-bold text-[#494900] mt-0.5 tabular-nums">
                      {studentAuditData.punctualityRate}%
                    </div>
                    <span className="text-[10px] text-[#797869]">Morning Promptness</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#c9c7b6]/40">
                  <div>
                    <h4 className="text-sm font-bold text-[#1c1c14]">
                      Attendance History Audit Log
                    </h4>
                    <p className="text-xs text-[#797869]">
                      Verified records from class registers for {studentAuditData.student.name}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#c9c7b6]/60 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#fdf9ec] text-xs font-bold text-[#494900] border-b border-[#c9c7b6]/60 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Attendance Status</th>
                        <th className="py-3 px-4">Registered By</th>
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
                          <td className="py-3 px-4">
                            <span className="font-bold text-xs text-[#494900]">
                              {log.className}
                            </span>
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
                                <span>Late Arrival</span>
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

export default AdminAttendance;
