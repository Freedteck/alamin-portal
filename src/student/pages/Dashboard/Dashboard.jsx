import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Award,
  CheckCircle2,
  ArrowRight,
  FileText,
  Sparkles
} from 'lucide-react';
import { schoolStore, ACADEMIC_SESSIONS, computeGrade, subscribeSchoolSync } from '../../../shared/data/schoolData';

export function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [accountName, setAccountName] = useState('Student');
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [recentGrades, setRecentGrades] = useState([]);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [averageGrade, setAverageGrade] = useState('—');
  const [toast, setToast] = useState(null);

  const loadStudentDashboard = async () => {
    const saved = JSON.parse(localStorage.getItem('alamin_user') || '{}');
    if (saved.name) setAccountName(saved.name);

    try {
      const activeStudent = await schoolStore.fetchCurrentStudent();
      const [timetableRes, assignmentsRes, announcementsRes] = await Promise.all([
        schoolStore.fetchTimetable(activeStudent?.class),
        schoolStore.fetchAssignments({ page: 1, limit: 4 }),
        schoolStore.fetchAnnouncements({ page: 1, limit: 3 })
      ]);
      setUser(activeStudent);

      if (activeStudent) {
        const historyAudit = await schoolStore.fetchStudentAttendanceHistory(activeStudent.id);
        setAttendanceSummary(historyAudit);
        const classSlots = (Array.isArray(timetableRes) ? timetableRes : [])
          .filter((s) => s.type === 'lesson')
          .slice(0, 4);
        setUpcomingClasses(classSlots);

        const asgs = (assignmentsRes?.data || [])
          .map((a) => {
            const submitted = a.submissions?.some((sub) => sub.studentId === activeStudent.id);
            return {
              id: a.id,
              subject: a.subject,
              title: a.title,
              dueDate: a.dueDate,
              status: submitted ? 'submitted' : 'not-started'
            };
          });
        setPendingAssignments(asgs);

        const notices = (announcementsRes?.data || [])
          .map((n) => ({
            title: n.title,
            message: n.content,
            date: n.date,
            priority: n.priority || 'medium'
          }));
        setAnnouncements(notices);

        const report = await schoolStore.getStudentReportCard(activeStudent.id, 'Term1', ACADEMIC_SESSIONS[0]);
        const recordedScores = (report?.subjectScores || []).filter((s) => s.isRecorded);
        setRecentGrades(
          recordedScores.slice(0, 4).map((s) => ({
            subject: s.subject,
            assessment: 'Continuous Assessment & Exam',
            grade: s.grade,
            score: `${s.total}%`,
            date: `${report.session} · ${report.term}`
          }))
        );
        setSubjectProgress(
          recordedScores.slice(0, 4).map((s) => ({
            name: s.subject,
            classLabel: activeStudent.class,
            pct: Math.min(100, Math.max(0, s.total)),
            note: s.remark || 'Assessment recorded'
          }))
        );
        setAverageGrade(
          recordedScores.length > 0 ? computeGrade(Number(report.average || 0)).grade : '—'
        );
      } else {
        setAttendanceSummary(null);
        setUpcomingClasses([]);
        setPendingAssignments([]);
        setAnnouncements([]);
        setRecentGrades([]);
        setSubjectProgress([]);
        setAverageGrade('—');
      }
    } catch (error) {
      console.error('Failed to load student dashboard:', error);
      setUser(null);
      setAttendanceSummary(null);
      setUpcomingClasses([]);
      setPendingAssignments([]);
      setAnnouncements([]);
      setRecentGrades([]);
      setSubjectProgress([]);
      setAverageGrade('—');
    }
  };

  useEffect(() => {
    loadStudentDashboard();
    return subscribeSchoolSync(loadStudentDashboard);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleQuickSubmit = (assignmentId) => {
    if (!user) return;
    schoolStore.submitStudentAssignment(assignmentId, user, {
      notes: 'Quick submission from dashboard'
    });
    loadStudentDashboard();
    showToast('Assignment marked as submitted! Your teacher has been notified.');
  };

  const getGradeBadge = (grade) => {
    if (grade.startsWith('A')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (grade.startsWith('B')) {
      return 'bg-sky-50 text-sky-800 border-sky-200';
    }
    return 'bg-amber-50 text-amber-800 border-amber-200';
  };

  const getAssignmentStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'in-progress':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'not-started':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Urgent
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Notice
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            Info
          </span>
        );
    }
  };

  const pendingCount = pendingAssignments.filter((a) => a.status !== 'submitted').length;
  const attendanceLabel =
    attendanceSummary && attendanceSummary.totalDays > 0
      ? `${attendanceSummary.attendanceRate}%`
      : '—';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c14] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Welcome back, {user?.name || accountName}
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Al-Amin Group of Schools · Study schedule, academic performance, and coursework overview
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/student/progress"
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Award className="w-4 h-4" />
            <span>Progress Report</span>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums">
            {user?.enrolledSubjects?.length || 0}
          </div>
          <p className="text-xs text-[#797869] mt-1">Subjects Enrolled</p>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">
            {attendanceLabel}
          </div>
          <p className="text-xs text-[#797869] mt-1">Attendance Rate</p>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="text-2xl font-bold text-amber-600 tabular-nums">{pendingCount}</div>
          <p className="text-xs text-[#797869] mt-1">Pending Assignments</p>
        </div>
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="text-2xl font-bold text-[#616218] tabular-nums">{averageGrade}</div>
          <p className="text-xs text-[#797869] mt-1">Current Average Grade</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Classes */}
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c9c7b6]/40">
            <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#616218]" />
              <span>Upcoming Time Table</span>
            </h3>
            <Link to="/student/timetable" className="text-xs font-semibold text-[#616218] hover:underline">
              Full Time Table
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingClasses.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                No timetable periods scheduled yet.
              </div>
            ) : (
              upcomingClasses.map((classItem, index) => (
                <div
                  key={classItem.id || index}
                  className="flex items-center justify-between p-3.5 bg-[#faf8f0] border border-[#c9c7b6]/60 rounded-lg"
                >
                  <div>
                    <div className="font-bold text-sm text-[#1c1c14]">{classItem.subject}</div>
                    <div className="text-xs text-[#797869]">{classItem.teacherName}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-[#c9c7b6] text-[#494900]">
                      {classItem.class}
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold text-[#616218]">{classItem.day}</div>
                    <div className="text-[#44443b]">
                      {classItem.startTime} – {classItem.endTime}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Grades */}
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c9c7b6]/40">
            <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#616218]" />
              <span>Recent Continuous Assessments</span>
            </h3>
            <Link to="/student/progress" className="text-xs font-semibold text-[#616218] hover:underline">
              All Grades
            </Link>
          </div>
          <div className="space-y-3">
            {recentGrades.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                No continuous assessments or examination marks recorded yet.
              </div>
            ) : (
              recentGrades.map((grade, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3.5 bg-[#faf8f0] border border-[#c9c7b6]/60 rounded-lg"
                >
                  <div>
                    <div className="font-bold text-sm text-[#1c1c14]">{grade.subject}</div>
                    <div className="text-xs text-[#797869]">{grade.assessment}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeBadge(
                          grade.grade
                        )}`}
                      >
                        {grade.grade}
                      </span>
                      <span className="text-xs font-bold text-[#1c1c14] tabular-nums">
                        {grade.score}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#797869]">{grade.date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Assignments & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c9c7b6]/40">
            <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#616218]" />
              <span>Assignments & Coursework</span>
            </h3>
            <Link to="/student/assignments" className="text-xs font-semibold text-[#616218] hover:underline">
              Open Assignments
            </Link>
          </div>
          <div className="space-y-3">
            {pendingAssignments.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                No assignments published for your class yet.
              </div>
            ) : (
              pendingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 p-3.5 bg-[#faf8f0] border border-[#c9c7b6]/60 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#1c1c14]">{assignment.title}</div>
                    <div className="text-xs text-[#616218] font-medium">{assignment.subject}</div>
                    <div className="text-[11px] text-[#797869] mt-0.5">Due: {assignment.dueDate}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getAssignmentStatusBadge(
                        assignment.status
                      )}`}
                    >
                      {assignment.status === 'not-started'
                        ? 'Not Started'
                        : assignment.status === 'in-progress'
                        ? 'In Progress'
                        : 'Submitted'}
                    </span>
                    {assignment.status !== 'submitted' && (
                      <button
                        type="button"
                        onClick={() => handleQuickSubmit(assignment.id)}
                        className="h-10 px-4 rounded-lg bg-white hover:bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6] text-xs font-semibold shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        Mark Submitted
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subject Progress */}
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c9c7b6]/40">
            <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#616218]" />
              <span>Subject Mastery Progress</span>
            </h3>
          </div>
          <div className="space-y-4">
            {subjectProgress.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                Subject progress will appear here once assessment marks are recorded.
              </div>
            ) : (
              subjectProgress.map((sp, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-semibold text-[#1c1c14] mb-1.5">
                    <span>
                      {sp.name} · {sp.classLabel}
                    </span>
                    <span className="text-[#616218] tabular-nums">{sp.pct}%</span>
                  </div>
                  <div className="w-full bg-[#faf8f0] border border-[#c9c7b6]/50 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#616218] h-full transition-all rounded-full"
                      style={{ width: `${sp.pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#797869] mt-1">{sp.note}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="rounded-lg border border-[#c9c7b6] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#c9c7b6]/40">
          <h3 className="font-bold text-base text-[#1c1c14] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#616218]" />
            <span>Recent School Notices</span>
          </h3>
          <Link to="/student/announcements" className="text-xs font-semibold text-[#616218] hover:underline flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
              No school announcements published yet.
            </div>
          ) : (
            announcements.map((announcement, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-3 p-3.5 bg-[#faf8f0] border border-[#c9c7b6]/60 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(announcement.priority)}
                    <span className="font-bold text-sm text-[#1c1c14]">{announcement.title}</span>
                  </div>
                  <div className="text-xs text-[#44443b] mt-1">{announcement.message}</div>
                  <div className="text-[11px] text-[#797869] mt-1.5">{announcement.date}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
