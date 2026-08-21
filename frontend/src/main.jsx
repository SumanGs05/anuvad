import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authenticate, createJob, downloadJob, getJob } from './api/client';
import './styles.css';

const languages = [{ code: 'hi', name: 'Hindi' }, { code: 'mr', name: 'Marathi' }, { code: 'bn', name: 'Bengali' }, { code: 'gu', name: 'Gujarati' }, { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' }];

function App() {
  const [token, setToken] = useState(localStorage.getItem('anuvad_access_token'));
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('hi');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job || !token || ['completed', 'failed'].includes(job.status)) return undefined;
    const timer = setInterval(async () => {
      try { setJob((await getJob(job._id, token)).job); } catch (err) { setError(err.message); }
    }, 1500);
    return () => clearInterval(timer);
  }, [job, token]);

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await authenticate(mode === 'login' ? 'login' : 'register', form);
      localStorage.setItem('anuvad_access_token', data.accessToken); setToken(data.accessToken);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function submitUpload(event) {
    event.preventDefault(); if (!file) return setError('Choose a document first.'); setBusy(true); setError('');
    try { setJob((await createJob(file, language, token)).job); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function download() {
    try { const blob = await downloadJob(job._id, token); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'anuvad-translation'; link.click(); URL.revokeObjectURL(link.href); } catch (err) { setError(err.message); }
  }
  function logout() { localStorage.removeItem('anuvad_access_token'); setToken(null); setJob(null); }

  if (!token) return <main className="card"><h1>Anuvad</h1><p>Translate English CIPAM documents into Indian languages.</p><form onSubmit={submitAuth}>{mode === 'register' && <input placeholder="Name (optional)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}<input type="email" required placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input type="password" required minLength="8" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}</button>{error && <p className="error">{error}</p>}</main>;
  if (job) return <main className="card"><h1>{job.status === 'completed' ? 'Translation ready' : job.status === 'failed' ? 'Translation failed' : 'Processing document'}</h1><p>{job.status === 'completed' ? 'Your translated document is ready to download.' : job.status === 'failed' ? job.errorMessage : `Current stage: ${job.status}`}</p>{job.status === 'completed' && <button onClick={download}>Download translated file</button>}<button className="link" onClick={() => setJob(null)}>Translate another document</button>{error && <p className="error">{error}</p>}</main>;
  return <main className="card"><header><h1>Upload a document</h1><button className="link" onClick={logout}>Sign out</button></header><p>Allowed formats: DOCX, PDF, JPG, PNG (up to 10 MB).</p><form onSubmit={submitUpload}><input type="file" accept=".docx,.pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} /><select value={language} onChange={e => setLanguage(e.target.value)}>{languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select><button disabled={busy}>{busy ? 'Translating…' : 'Translate document'}</button></form>{error && <p className="error">{error}</p>}</main>;
}
createRoot(document.getElementById('root')).render(<App />);
