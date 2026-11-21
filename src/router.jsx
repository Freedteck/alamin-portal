import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from './shared/auth/Login';
import { ErrorBoundary } from './shared/components/ErrorBoundary/ErrorBoundary';
import { adminRoutes } from './admin/adminRoutes';
import { staffRoutes } from './staff/staffRoutes';
import { studentRoutes } from './student/studentRoutes';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
    errorElement: <ErrorBoundary />
  },
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorBoundary />
  },
  {
    path: '/enquire',
    element: <Login initialModal="enquire" />,
    errorElement: <ErrorBoundary />
  },
  {
    path: '/book-appointment',
    element: <Login initialModal="appointment" />,
    errorElement: <ErrorBoundary />
  },
  adminRoutes,
  ...staffRoutes,
  studentRoutes,
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);
