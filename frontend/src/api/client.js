const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return response;
}

export async function authenticate(path, payload) {
  const response = await request(`/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return response.json();
}

export async function createJob(file, targetLanguage, token) {
  const form = new FormData();
  form.append('document', file);
  form.append('targetLanguage', targetLanguage);
  const response = await request('/jobs', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return response.json();
}

export async function getJob(id, token) {
  const response = await request(`/jobs/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
}

export async function downloadJob(id, token) {
  const response = await request(`/jobs/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
  return response.blob();
}
