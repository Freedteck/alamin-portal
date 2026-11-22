import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  UserPlus,
  FileText,
  ArrowRight
} from 'lucide-react';
import {
  schoolStore,
  SCHOOL_CLASSES,
  subscribeSchoolSync
} from '../../../shared/data/schoolData';

export function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const result = await schoolStore.fetchAdminDashboardSummary();
        if (!active) return;
        setSummary(result);
      } catch (error) {
        console.error('Failed to load admin dashboard:', error);
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

  const totalStudents = summary?.totalStudents || 0;
  const totalTeachers = summary?.totalTeachers || 0;
  const classCounts = summary?.classCounts || {};
  const schoolClasses = summary?.classes?.map((item) => item.name) || SCHOOL_CLASSES;
  const attendanceDisplay = summary?.attendancePercentage == null
    ? '—'
    : `${summary.attendancePercentage}%`;
  const attendanceSubtitle = summary?.attendanceSubtitle || 'No roll call recorded yet';

  const stats = [
    {
      title: 'Enrolled Students',
      value: totalStudents,
      subtitle: 'Across JSS 1 – SSS 3',
      icon: Users,
      color: 'text-[#616218]',
      bgColor: 'bg-[#f4f2e1]'
    },
    {
      title: 'Teaching Staff',
      value: totalTeachers,
      subtitle: 'Subject Teachers',
      icon: GraduationCap,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Academic Classes',
      value: `${schoolClasses.length} Levels`,
      subtitle: schoolClasses.length ? `${schoolClasses[0]} to ${schoolClasses[schoolClasses.length - 1]}` : 'No classes configured',
      icon: BookOpen,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50'
    },
    {
      title: "Today's Attendance",
      value: attendanceDisplay,
      subtitle: attendanceSubtitle,
      icon: CheckCircle2,
      color: 'text-[#494900]',
      bgColor: 'bg-[#faf8f0]'
    }
  ];

  const recentActivities = summary?.recentActivities || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-['Poppins',sans-serif] pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#c9c7b6]/50">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c14]">
            Al-Amin School Administration
          </h1>
          <p className="text-sm text-[#797869] mt-0.5 max-w-xl">
            School portal overview: secondary classes, attendance registers, and student records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/students/admit"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit New Student</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="rounded-lg border border-[#c9c7b6] bg-white p-5 shadow-xs hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between pb-3">
                <span className="text-xs font-semibold text-[#797869] uppercase tracking-wide">
                  {stat.title}
                </span>
                <div className={`p-2 rounded-lg ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#1c1c14] tabular-nums">
                {stat.value}
              </div>
              <div className="text-xs text-[#797869] mt-1 font-medium">
                {stat.subtitle}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#c9c7b6] bg-white p-4 shadow-xs">
        <div className="text-xs font-bold text-[#1c1c14] uppercase tracking-wider mb-3">
          Quick Academic Management Actions
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/students/admit"
            className="p-3 rounded-lg border border-[#c9c7b6]/70 bg-[#faf8f0] hover:bg-[#f4f2e1] text-xs font-semibold text-[#1c1c14] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#616218]" />
              <span>Admit Student</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#797869]" />
          </Link>

          <Link
            to="/admin/timetable"
            className="p-3 rounded-lg border border-[#c9c7b6]/70 bg-[#faf8f0] hover:bg-[#f4f2e1] text-xs font-semibold text-[#1c1c14] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#616218]" />
              <span>Master Time Table</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#797869]" />
          </Link>

          <Link
            to="/admin/classes"
            className="p-3 rounded-lg border border-[#c9c7b6]/70 bg-[#faf8f0] hover:bg-[#f4f2e1] text-xs font-semibold text-[#1c1c14] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#616218]" />
              <span>Class Allocations</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#797869]" />
          </Link>

          <Link
            to="/admin/reports"
            className="p-3 rounded-lg border border-[#c9c7b6]/70 bg-[#faf8f0] hover:bg-[#f4f2e1] text-xs font-semibold text-[#1c1c14] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#616218]" />
              <span>Generate Reports</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#797869]" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#c9c7b6]/40 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#616218]" />
              <h2 className="text-base font-bold text-[#1c1c14]">
                Class Level Distribution
              </h2>
            </div>
            <Link to="/admin/students" className="text-xs font-semibold text-[#616218] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {schoolClasses.map((cls) => {
              const classCount = classCounts[cls] || 0;
              return (
                <div
                  key={cls}
                  className="p-3 rounded-lg bg-[#faf8f0] border border-[#c9c7b6]/60 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-sm text-[#1c1c14]">{cls}</span>
                    <div className="text-[11px] text-[#797869]">
                      {cls.startsWith('JSS') ? 'Junior Secondary' : 'Senior Secondary'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-[#616218] tabular-nums">
                      {classCount}
                    </span>
                    <span className="text-xs text-[#797869] block">enrolled students</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-[#c9c7b6] bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#c9c7b6]/40">
            <Clock className="w-4 h-4 text-[#616218]" />
            <h2 className="text-base font-bold text-[#1c1c14]">
              Recent Academic Log
            </h2>
          </div>

          {recentActivities.length > 0 ? (
            <div className="space-y-3">
              {recentActivities.map((act, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-[#faf8f0] border border-[#c9c7b6]/40 rounded-lg"
                >
                  <div className="text-xs font-bold text-[#616218] min-w-fit tabular-nums pt-0.5">
                    {act.time}
                  </div>
                  <div className="text-xs text-[#1c1c14] flex-1 leading-snug font-medium">
                    {act.activity}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#797869]">
              No recorded school activity yet. Admit students or add staff to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
