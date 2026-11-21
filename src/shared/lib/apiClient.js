const rawBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

export const API_BASE_URL = String(rawBaseUrl).trim().replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'alamin_token';
const AUTH_CHANGE_EVENT = 'alamin:auth-changed';

export function getAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { authenticated: Boolean(token) } }));
  } catch {
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

export function onAuthTokenChange(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};
  const handler = (event) => callback(event?.detail);
  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler);
}

export function resolveApiUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/')) {
    return `${API_BASE_URL}${normalized}`;
  }
  return `${API_BASE_URL}/api${normalized}`;
}

async function request(path, options = {}) {
  const url = resolveApiUrl(path);
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  getToken: getAuthToken,
  setToken: setAuthToken,
  clearToken: clearAuthToken,
  onAuthChange: onAuthTokenChange,
  resolveUrl: resolveApiUrl,
  request,
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) =>
    request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: (path, body) =>
    request(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: (path, body) =>
    request(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: (path, body) =>
    request(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
  uploadFile: (folder, file) => {
    const formData = new FormData();
    formData.append('folder', folder || 'general');
    formData.append('file', file);
    return request('/files/upload', {
      method: 'POST',
      body: formData
    });
  }
};
