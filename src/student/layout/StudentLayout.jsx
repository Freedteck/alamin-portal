import React, { useEffect } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  Bell,
  Clock,
  Database,
  FolderOpen,
  CalendarCheck,
  HelpCircle
} from 'lucide-react';
import { Sidebar } from '../../shared/components/Sidebar/Sidebar';
import { apiClient } from '../../shared/lib/apiClient';
import { refreshCloudData } from '../../shared/data/schoolData';

export function StudentLayout() {
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
  if (storedUser.role !== 'student') {
    return <Navigate to={`/${storedUser.role}/dashboard`} replace />;
  }

  const handleLogout = async () => {
    await apiClient.post('/auth/logout').catch(() => {});
    apiClient.clearToken();
    localStorage.removeItem('alamin_user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Time Table', path: '/student/timetable', icon: Clock },
    { label: 'Progress Reports', path: '/student/progress', icon: TrendingUp },
    { label: 'Assignments', path: '/student/assignments', icon: FileText },
    { label: 'Resources', path: '/student/resources', icon: Database },
    { label: 'Documents', path: '/student/documents', icon: FolderOpen },
    { label: 'Announcements', path: '/student/announcements', icon: Bell },
    { label: 'Bookings', path: '/student/bookings', icon: CalendarCheck },
    { label: 'Request Help', path: '/student/help', icon: HelpCircle },
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
