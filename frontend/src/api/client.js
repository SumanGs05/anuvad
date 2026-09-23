const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const TOKEN_KEY = 'anuvad_access_token';
const REFRESH_KEY = 'anuvad_refresh_token';

// --------------------------------------------------------------------------
// Token helpers
// --------------------------------------------------------------------------

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// --------------------------------------------------------------------------
// Friendly error messages for common HTTP status codes
// --------------------------------------------------------------------------

function friendlyMessage(status, serverMessage) {
  if (status === 413) return 'The file is too large. Please upload a file under 10 MB.';
  if (status === 415) return 'Unsupported file type. Please upload a PDF, DOCX, JPG, or PNG.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return serverMessage || 'Request failed';
}

// --------------------------------------------------------------------------
// Core request with 401 auto-refresh
// --------------------------------------------------------------------------

async function request(urlPath, options = {}, isRetry = false) {
  const token = getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    ...options,
    headers
  });

  // Auto-refresh on 401 (once only).
  if (response.status === 401 && !isRetry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setTokens(refreshData.accessToken, refreshData.refreshToken);
          // Retry the original request with the new token.
          return request(urlPath, options, true);
        }
      } catch (_err) {
        // Refresh failed; fall through to clear session.
      }
    }
    // Could not refresh: clear session so UI redirects to login.
    clearTokens();
    window.dispatchEvent(new Event('anuvad:session-expired'));
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Session expired. Please sign in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(friendlyMessage(response.status, data.error || data.message));
  }

  return data;
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

export async function register(email, password) {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

export async function logoutRequest(refreshToken) {
  if (!refreshToken) return;
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
  } catch (_err) {
    // Best-effort: ignore network errors on logout.
  }
}

// --------------------------------------------------------------------------
// Jobs
// --------------------------------------------------------------------------

export async function createJob(file, targetLanguage) {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('targetLanguage', targetLanguage);
  return request('/jobs', { method: 'POST', body: formData });
}

export async function getJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export async function listJobs() {
  return request('/jobs');
}

export async function deleteJob(jobId) {
  return request(`/jobs/${jobId}`, { method: 'DELETE' });
}

export async function downloadJob(jobId) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(friendlyMessage(response.status, data.error || 'Download failed'));
  }

  return response.blob();
}
