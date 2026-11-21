import React from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../shared/components/ErrorBoundary/ErrorBoundary';
import { StudentLayout } from './layout/StudentLayout';
import { StudentDashboard } from './pages/Dashboard/Dashboard';
import { StudentProgressReports } from './pages/Progress/Progress';
import { StudentAssignments } from './pages/Assignments/Assignments';
import { StudentResources } from './pages/Resources/Resources';
import { StudentDocuments } from './pages/Documents/Documents';
import { StudentAnnouncements } from './pages/Announcements/Announcements';
import { StudentTimetable } from './pages/Timetable/Timetable';
import { StudentBookings } from './pages/Bookings/Bookings';
import { StudentHelp } from './pages/Help/Help';

export const studentRoutes = {
  path: '/student',
  element: <StudentLayout />,
  errorElement: <ErrorBoundary />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: 'dashboard', element: <StudentDashboard /> },
    { path: 'schedule', element: <Navigate to="/student/timetable" replace /> },
    { path: 'progress', element: <StudentProgressReports /> },
    { path: 'assignments', element: <StudentAssignments /> },
    { path: 'resources', element: <StudentResources /> },
    { path: 'documents', element: <StudentDocuments /> },
    { path: 'announcements', element: <StudentAnnouncements /> },
    { path: 'timetable', element: <StudentTimetable /> },
    { path: 'bookings', element: <StudentBookings /> },
    { path: 'help', element: <StudentHelp /> },
    { path: 'assistance', element: <Navigate to="../help" replace /> }
  ]
};
