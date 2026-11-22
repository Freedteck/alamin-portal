import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { subscribeApiActivity } from '../../lib/apiClient';

export function GlobalApiStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let loadingTimer;
    const unsubscribe = subscribeApiActivity((activity) => {
      if (activity.type === 'start') {
        if (activity.activeRequestCount === 1) {
          loadingTimer = window.setTimeout(() => setIsLoading(true), 180);
        }
        return;
      }

      if (activity.type === 'error') {
        setError(activity.error);
      }

      if (activity.type === 'finish' && activity.activeRequestCount === 0) {
        window.clearTimeout(loadingTimer);
        setIsLoading(false);
      }
    });

    return () => {
      window.clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, []);

  return (
    <>
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/20 p-4"
        >
          <div className="flex items-center gap-3 rounded-xl border border-[#c9c7b6] bg-white px-6 py-5 text-sm font-medium text-[#494900] shadow-xl">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#616218]" />
            <span>Loading data…</span>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-0 z-[110] grid place-items-center bg-black/30 p-4"
        >
          <div className="flex w-[min(28rem,100%)] items-start gap-3 rounded-xl border border-red-200 bg-white p-5 text-sm text-red-900 shadow-xl">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Unable to complete the request</p>
              <p className="mt-1 break-words text-xs text-red-800">{error.message}</p>
              <p className="mt-1 text-[11px] text-red-700">
                {error.method} {error.endpoint}
                {error.status ? ` · ${error.status}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="rounded-md p-1 text-red-700 transition-colors hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalApiStatus;
