import { apiClient, onAuthTokenChange } from './apiClient';

const SYNC_EVENT = 'alamin:sync';

export function emitSchoolSync(table = 'all') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { table } }));
}

export function subscribeSchoolSync(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }
  const handler = (event) => callback(event?.detail);
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}

function writeSnapshotToLocal(storageKeys, payload) {
  if (!payload || typeof payload !== 'object') return false;
  const pairs = [
    ['subjects', storageKeys.SUBJECTS],
    ['students', storageKeys.STUDENTS],
    ['teachers', storageKeys.TEACHERS],
    ['timetable', storageKeys.TIMETABLE],
    ['alerts', storageKeys.ALERTS],
    ['attendance', storageKeys.ATTENDANCE],
    ['grades', storageKeys.GRADES],
    ['resources', storageKeys.RESOURCES],
    ['equipment', storageKeys.EQUIPMENT],
    ['maintenance', storageKeys.MAINTENANCE],
    ['documents', storageKeys.DOCUMENTS],
    ['announcements', storageKeys.ANNOUNCEMENTS],
    ['availability', storageKeys.TEACHER_AVAILABILITY],
    ['assignments', storageKeys.ASSIGNMENTS],
    ['requests', storageKeys.REQUESTS]
  ];

  let updatedAny = false;
  pairs.forEach(([field, storageKey]) => {
    if (storageKey && payload[field] !== undefined) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload[field]));
        updatedAny = true;
      } catch {
      }
    }
  });
  return updatedAny;
}

export async function hydrateAllFromApi(storageKeys) {
  if (!apiClient.getToken()) return false;
  try {
    const payload = await apiClient.get('/bootstrap');
    const ok = writeSnapshotToLocal(storageKeys, payload);
    if (ok) {
      emitSchoolSync('hydration');
    }
    return ok;
  } catch {
    return false;
  }
}

export function startRealtimeSync(storageKeys) {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let eventSource = null;
  let debounceTimer = null;

  const closeStream = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const connectStream = () => {
    closeStream();
    const token = apiClient.getToken();
    if (!token) return;

    const url = apiClient.resolveUrl(`/events?token=${encodeURIComponent(token)}`);
    eventSource = new EventSource(url);

    eventSource.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data || '{}');
        if (parsed.action === 'connected') return;
      } catch {
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        hydrateAllFromApi(storageKeys);
      }, 120);
    };

    eventSource.onerror = () => {
    };
  };

  connectStream();
  const stopAuthListener = onAuthTokenChange(() => {
    connectStream();
  });

  return () => {
    stopAuthListener();
    closeStream();
  };
}

export function syncRequest(method, path, body) {
  if (!apiClient.getToken()) return Promise.resolve(null);
  const fn = apiClient[method.toLowerCase()];
  if (typeof fn !== 'function') return Promise.resolve(null);
  return fn(path, body).catch(() => null);
}

export async function submitPublicEnquiry(kind, payload) {
  return apiClient.post('/enquiries', {
    kind,
    parentName: payload.parentName || '',
    studentName: payload.studentName || '',
    email: payload.email || '',
    phone: payload.phone || '',
    yearLevel: payload.yearLevel || '',
    subject: payload.subject || '',
    preferredDate: payload.preferredDate || '',
    preferredTime: payload.preferredTime || '',
    meetingType: payload.meetingType || '',
    message: payload.message || ''
  });
}
