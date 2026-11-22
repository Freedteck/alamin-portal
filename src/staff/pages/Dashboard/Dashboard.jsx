import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  TrendingUp,
  FileText,
  UserCheck,
} from "lucide-react";
import {
  schoolStore,
  subscribeSchoolSync,
} from "../../../shared/data/schoolData";

export function StaffDashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const result = await schoolStore.fetchStaffDashboardSummary();
        if (!active) return;
        setSummary(result);
      } catch (error) {
        console.error('Failed to load staff dashboard:', error);
        if (!active) return;
        setSummary(null);
      }
    };
    sync();
    const unsubscribe = subscribeSchoolSync(sync);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const currentTeacher = summary?.teacher;
  const studentCount = summary?.studentCount || 0;
  const pendingRequestCount = summary?.pendingRequestCount || 0;
  const hasTodayRollCall = Boolean(summary?.hasTodayRollCall);
  const hasGrades = Boolean(summary?.hasGrades);
  const topStudents = summary?.topStudents || [];

  const pendingTasks = [
    ...(pendingRequestCount > 0
      ? [
          {
            id: "pending-requests",
            task: `Review ${pendingRequestCount} pending student consultation request${pendingRequestCount === 1 ? "" : "s"}`,
            priority: "high",
            dueDate: "Today",
            link: "/teacher/requests",
          },
        ]
      : []),
    ...(studentCount > 0 && !hasTodayRollCall
      ? [
          {
            id: "today-rollcall",
            task: "Mark daily morning roll call register for assigned classes",
            priority: "medium",
            dueDate: "Today",
            link: "/teacher/attendance",
          },
        ]
      : []),
    ...(studentCount > 0 && !hasGrades
      ? [
          {
            id: "record-grades",
            task: "Enter Continuous Assessment & Examination scores",
            priority: "medium",
            dueDate: "Current Term",
            link: "/teacher/grades",
          },
        ]
      : []),
  ];

  const recentActivity = summary?.recentActivity || [];
  const attendanceRateLabel = summary?.attendanceRate == null ? "—" : `${summary.attendanceRate}%`;
  const totalAttEntries = summary?.totalAttendanceEntries || 0;

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>High</span>
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <span>Medium</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 shadow-xs">
            <span>Low</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Welcome back, {currentTeacher?.name || "Educator"}
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            Al-Amin Group of Schools
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/teacher/attendance"
            className="h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Mark Roll Call</span>
          </Link>
          <Link
            to="/teacher/grades"
            className="h-10 px-4 rounded-lg bg-white hover:bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6] text-xs font-semibold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Award className="w-4 h-4 text-[#616218]" />
            <span>Record Grades</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">
              Total Enrolled
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#faf8f0] text-[#494900] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums mt-2">
            {studentCount}
          </div>
          <p className="text-[11px] text-[#616218] font-medium mt-0.5">
            Students across secondary levels
          </p>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">
              Class Allocations
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#faf8f0] text-[#494900] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1c1c14] tabular-nums mt-2">
            {currentTeacher?.assignedClasses?.length || 0}
          </div>
          <p className="text-[11px] text-[#797869] mt-0.5">
            Assigned subject classes
          </p>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">
              Pending Inquiries
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {pendingRequestCount}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">
            Student consultation requests
          </p>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#797869] font-medium uppercase tracking-wider">
              Attendance Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-2">
            {attendanceRateLabel}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            {totalAttEntries > 0
              ? "Term roll call average"
              : "No roll calls recorded"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-3">
              <h3 className="text-base font-bold text-[#1c1c14] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#616218]" />
                <span>Pending Academic Tasks</span>
              </h3>
              <span className="text-xs text-[#797869]">
                {pendingTasks.length} action items
              </span>
            </div>

            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                  All academic tasks are up to date.
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[#c9c7b6]/60 bg-[#faf8f0]/40 hover:bg-[#faf8f0] transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <Link
                        to={task.link}
                        className="font-semibold text-xs sm:text-sm text-[#1c1c14] hover:text-[#616218] transition-colors"
                      >
                        {task.task}
                      </Link>
                      <div className="text-[11px] text-[#797869] flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#616218]" />
                        <span>Due: {task.dueDate}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getPriorityBadge(task.priority)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/teacher/requests"
            className="inline-flex items-center justify-center gap-2 w-full mt-4 h-10 px-4 text-xs font-semibold rounded-lg bg-white hover:bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6] shadow-xs transition-colors"
          >
            <span>View All Student Requests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-3">
              <h3 className="text-base font-bold text-[#1c1c14] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#616218]" />
                <span>Recent Academic Activity</span>
              </h3>
              <span className="text-xs text-[#797869]">Live Log</span>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
                  No classroom activity recorded yet.
                </div>
              ) : (
                recentActivity.map((activity) => {
                  const IconComponent = activity.type === 'attendance'
                    ? UserCheck
                    : activity.type === 'assignment' ? FileText : CalendarCheck;
                  const iconColor = activity.type === 'attendance'
                    ? 'text-[#616218]'
                    : activity.type === 'assignment' ? 'text-purple-700' : 'text-sky-700';
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[#c9c7b6]/60 bg-white"
                    >
                      <div
                        className={`mt-0.5 p-1.5 rounded-md bg-[#faf8f0] ${iconColor}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 flex-1 text-xs">
                        <div className="font-bold text-[#1c1c14]">
                          {activity.title}
                        </div>
                        <div className="text-[#797869]">
                          {activity.description}
                        </div>
                        <div className="text-[11px] text-[#616218] font-medium pt-0.5">
                          {activity.time}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Link
            to="/teacher/attendance"
            className="inline-flex items-center justify-center gap-2 w-full mt-4 h-10 px-4 text-xs font-semibold rounded-lg bg-white hover:bg-[#faf8f0] text-[#1c1c14] border border-[#c9c7b6] shadow-xs transition-colors"
          >
            <span>Review Class Attendance History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/50 mb-4">
          <h3 className="text-base font-bold text-[#1c1c14] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#616218]" />
            <span>Academic Distinction Highlights</span>
          </h3>
          <Link
            to="/teacher/students"
            className="text-xs font-semibold text-[#616218] hover:underline flex items-center gap-1"
          >
            <span>View All Students</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {topStudents.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-[#c9c7b6] text-center text-xs text-[#797869]">
            No graded distinctions recorded yet. Record CA and Examination marks
            under Grades to populate student highlights.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topStudents.map((st, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-[#c9c7b6]/60 bg-[#faf8f0]/40 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1c1c14]">{st.name}</span>
                  <span className="font-mono text-[10px] text-[#616218] font-bold bg-[#faf8f0] px-1.5 py-0.5 rounded border border-[#c9c7b6]">
                    {st.admissionNo}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#797869]">
                  <span>{st.subject}</span>
                  <span className="font-semibold text-[#494900]">
                    {st.class}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#c9c7b6]/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#494900]">
                      Grade {st.grade}
                    </span>
                    <span className="font-mono text-[#797869]">{st.score}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {st.remark}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffDashboard;
