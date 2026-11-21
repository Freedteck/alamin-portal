import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from '../shared/components/ErrorBoundary/ErrorBoundary';
import { TeacherLayout as StaffLayout } from './layout/StaffLayout';
import { StaffDashboard } from './pages/Dashboard/Dashboard';
import { StaffStudents } from './pages/Students/Students';
import { ClassScheduling as StaffTimetable } from './pages/Schedule/Schedule';
import { StaffAssignments } from './pages/Assignments/Assignments';
import { TeacherResources as StaffResources } from './pages/Resources/Resources';
import { TeacherDocuments as StaffDocuments } from './pages/Documents/Documents';
import { StaffStudentRequests } from './pages/Requests/Requests';
import { StaffAnnouncements } from './pages/Announcements/Announcements';
import { StaffAttendance } from './pages/Attendance/Attendance';
import { RecordGrades } from './pages/Grades/RecordGrades';
import { StaffProfile } from './pages/Profile/Profile';

function StaffRedirect() {
  const { subpage } = useParams();
  return <Navigate to={`/teacher/${subpage || 'dashboard'}`} replace />;
}

export const staffRoutes = [
  {
    path: '/teacher',
    element: <StaffLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <StaffDashboard /> },
      { path: 'students', element: <StaffStudents /> },
      { path: 'attendance', element: <StaffAttendance /> },
      { path: 'grades', element: <RecordGrades /> },
      { path: 'schedule', element: <StaffTimetable /> },
      { path: 'assignments', element: <StaffAssignments /> },
      { path: 'resources', element: <StaffResources /> },
      { path: 'documents', element: <StaffDocuments /> },
      { path: 'requests', element: <StaffStudentRequests /> },
      { path: 'announcements', element: <StaffAnnouncements /> },
      { path: 'scheduler', element: <Navigate to="/teacher/schedule" replace /> },
      { path: 'profile', element: <StaffProfile /> }
    ]
  },
  {
    path: '/staff',
    element: <Navigate to="/teacher/dashboard" replace />
  },
  {
    path: '/staff/:subpage',
    element: <StaffRedirect />
  }
];
