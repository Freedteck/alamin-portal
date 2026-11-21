import React, { useEffect } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  FileText,
  MessageSquare,
  Database,
  Clock,
  Settings
} from 'lucide-react';
import { Sidebar } from '../../shared/components/Sidebar/Sidebar';
import { apiClient } from '../../shared/lib/apiClient';
import { refreshCloudData } from '../../shared/data/schoolData';

export function AdminLayout() {
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
  if (storedUser.role !== 'admin') {
    return <Navigate to={`/${storedUser.role}/dashboard`} replace />;
  }

  const handleLogout = async () => {
    await apiClient.post('/auth/logout').catch(() => {});
    apiClient.clearToken();
    localStorage.removeItem('alamin_user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Student Management', path: '/admin/students', icon: Users },
    { label: 'Staff Management', path: '/admin/teachers', icon: GraduationCap },
    { label: 'Class Allocations', path: '/admin/classes', icon: Calendar },
    { label: 'Time Table', path: '/admin/timetable', icon: Clock },
    { label: 'Attendance Management', path: '/admin/attendance', icon: CheckCircle2 },
    { label: 'Report Cards & Results', path: '/admin/reports', icon: FileText },
    { label: 'Communications', path: '/admin/communications', icon: MessageSquare },
    { label: 'Resources', path: '/admin/resources', icon: Database },
    { label: 'Documents', path: '/admin/documents', icon: FileText },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
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

export default AdminLayout;
