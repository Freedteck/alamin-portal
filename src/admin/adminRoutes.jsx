import React from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../shared/components/ErrorBoundary/ErrorBoundary';
import { AdminLayout } from './layout/AdminLayout';
import { Dashboard as AdminDashboard } from './pages/Dashboard/Dashboard';
import { StudentManagement as AdminStudents } from './pages/Students/Students';
import { AdmitStudent } from './pages/Students/AdmitStudent';
import { TeacherManagement as AdminTeachers } from './pages/Teachers/Teachers';
import { ClassScheduling as AdminClasses } from './pages/Classes/Classes';
import { AdminTimetable } from './pages/Timetable/Timetable';
import { AdminAttendance } from './pages/Attendance/AdminAttendance';
import { AdminReports } from './pages/Reports/Reports';
import { AdminCommunications } from './pages/Communications/Communications';
import { AdminResources } from './pages/Resources/Resources';
import { AdminDocuments } from './pages/Documents/Documents';
import { Settings as AdminSettings } from './pages/Settings/Settings';

export const adminRoutes = {
  path: '/admin',
  element: <AdminLayout />,
  errorElement: <ErrorBoundary />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: 'dashboard', element: <AdminDashboard /> },
    { path: 'students', element: <AdminStudents /> },
    { path: 'students/admit', element: <AdmitStudent /> },
    { path: 'teachers', element: <AdminTeachers /> },
    { path: 'classes', element: <AdminClasses /> },
    { path: 'timetable', element: <AdminTimetable /> },
    { path: 'attendance', element: <AdminAttendance /> },
    { path: 'reports', element: <AdminReports /> },
    { path: 'communications', element: <AdminCommunications /> },
    { path: 'resources', element: <AdminResources /> },
    { path: 'documents', element: <AdminDocuments /> },
    { path: 'settings', element: <AdminSettings /> },
    { path: 'hr', element: <Navigate to="/admin/teachers" replace /> },
    { path: 'finance', element: <Navigate to="/admin/dashboard" replace /> }
  ]
};
