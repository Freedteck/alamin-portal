import React, { useEffect } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  MessageSquare,
  Bell,
  CheckSquare,
  Award,
  Database,
  FolderOpen,
  User
} from 'lucide-react';
import { Sidebar } from '../../shared/components/Sidebar/Sidebar';
import { apiClient } from '../../shared/lib/apiClient';
import { refreshCloudData } from '../../shared/data/schoolData';

export function TeacherLayout() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('alamin_user') || 'null');
  const hasToken = Boolean(apiClient.getToken());

  useEffect(() => {
    if (hasToken) {
      refreshCloudData();
    }
  }, [hasToken]);

  if (!storedUser || !storedUser.role || !hasToken) {
    return <Navigate to="/login" replace />;
  }
  if (storedUser.role !== 'teacher') {
    return <Navigate to={`/${storedUser.role}/dashboard`} replace />;
  }

  const handleLogout = async () => {
    await apiClient.post('/auth/logout').catch(() => {});
    apiClient.clearToken();
    localStorage.removeItem('alamin_user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/teacher/dashboard', icon: LayoutDashboard },
    { label: 'My Students & Classes', path: '/teacher/students', icon: Users },
    { label: 'Student Attendance', path: '/teacher/attendance', icon: CheckSquare },
    { label: 'Record Student Grades', path: '/teacher/grades', icon: Award },
    { label: 'Time Table', path: '/teacher/schedule', icon: Clock },
    { label: 'Assignments', path: '/teacher/assignments', icon: FileText },
    { label: 'Resources', path: '/teacher/resources', icon: Database },
    { label: 'Documents', path: '/teacher/documents', icon: FolderOpen },
    { label: 'Student Requests', path: '/teacher/requests', icon: MessageSquare },
    { label: 'Announcements', path: '/teacher/announcements', icon: Bell },
    { label: 'My Profile', path: '/teacher/profile', icon: User },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--md-sys-color-background)]">
      <Sidebar
        items={navItems}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default TeacherLayout;
