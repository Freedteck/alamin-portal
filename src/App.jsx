import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { initializeSchoolSync } from './shared/data/schoolData';
import { GlobalApiStatus } from './shared/components/GlobalApiStatus/GlobalApiStatus';

export default function App() {
  useEffect(() => {
    const cleanup = initializeSchoolSync();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <GlobalApiStatus />
    </>
  );
}
