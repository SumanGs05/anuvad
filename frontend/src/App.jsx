import { useEffect, useState } from 'react';

import {
  createJob,
  getJob,
  listJobs
} from './api/client';

import AuthPage from './pages/AuthPage';
import TranslatePage from './pages/TranslatePage';
import ProcessingPage from './pages/ProcessingPage';
import HistoryPage from './pages/HistoryPage';

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('anuvad_access_token')
  );

  const [page, setPage] = useState('translate');

  const [file, setFile] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('hi');

  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    loadJobs();
  }, [token]);

  useEffect(() => {
    if (!token || !job) return;

    if (
      job.status === 'completed' ||
      job.status === 'failed'
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await getJob(
          job._id,
          token
        );

        setJob(response.job);

        if (
          response.job.status === 'completed' ||
          response.job.status === 'failed'
        ) {
          clearInterval(interval);
          await loadJobs();
        }
      } catch (err) {
        setError(err.message);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [job, token]);

  async function loadJobs() {
    try {
      const response = await listJobs(token);
      setJobs(response.jobs || []);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogin(accessToken) {
    localStorage.setItem(
      'anuvad_access_token',
      accessToken
    );

    setToken(accessToken);
    setPage('translate');
  }

  function handleLogout() {
    localStorage.removeItem(
      'anuvad_access_token'
    );

    setToken(null);
    setJob(null);
    setJobs([]);
    setFile(null);
  }

  async function handleTranslate() {
    if (!file) {
      setError('Please select a document.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await createJob(
        file,
        targetLanguage,
        token
      );

      setJob(response.job);
      setPage('processing');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startNewTranslation() {
    setFile(null);
    setJob(null);
    setError('');
    setPage('translate');
  }

  if (!token) {
    return (
      <AuthPage
        onLogin={handleLogin}
      />
    );
  }

  if (page === 'history') {
    return (
      <HistoryPage
        jobs={jobs}
        onNewTranslation={
          startNewTranslation
        }
        onRefresh={loadJobs}
        onLogout={handleLogout}
      />
    );
  }

  if (page === 'processing') {
    return (
      <ProcessingPage
        job={job}
        file={file}
        targetLanguage={targetLanguage}
        error={error}
        onNewTranslation={
          startNewTranslation
        }
        onHistory={() => {
          loadJobs();
          setPage('history');
        }}
      />
    );
  }

  return (
    <TranslatePage
      file={file}
      setFile={setFile}
      targetLanguage={targetLanguage}
      setTargetLanguage={
        setTargetLanguage
      }
      loading={loading}
      error={error}
      onTranslate={handleTranslate}
      onHistory={() => {
        loadJobs();
        setPage('history');
      }}
      onLogout={handleLogout}
    />
  );
}

export default App;
