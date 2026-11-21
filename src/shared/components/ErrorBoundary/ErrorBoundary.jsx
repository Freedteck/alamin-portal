import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Logo } from '../Logo/Logo';

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const errorMessage =
    error?.statusText ||
    error?.message ||
    'An unexpected error occurred while loading this page.';

  return (
    <div className="min-h-screen bg-[#fdf9ec] flex flex-col justify-center items-center p-6 font-['Poppins',sans-serif]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#c9c7b6] p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="flex justify-center">
          <Logo variant="dark" className="h-12" showText={true} />
        </div>

        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#1c1c14]">Something went wrong</h2>
          <p className="text-xs text-[#797869] mt-1.5 leading-relaxed">
            The page encountered an error. You can reload or navigate back to the portal login.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-[#fdf9ec] border border-[#c9c7b6]/60 rounded-xl text-left">
            <p className="font-mono text-[11px] text-[#48482d] break-words">
              {errorMessage}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 h-10 px-4 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-xs font-semibold text-[#1c1c14] inline-flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex-1 h-10 px-4 rounded-lg bg-[#616218] hover:bg-[#494900] text-xs font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
