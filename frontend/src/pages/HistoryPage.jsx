import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import FileIcon from '../components/FileIcon';
import { downloadJob } from '../api/client';

const LANGUAGE_NAMES = {
  hi: 'Hindi',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  ta: 'Tamil',
  te: 'Telugu'
};

function StatusBadge({ status }) {
  return (
    <span className={`history-status history-status-${status}`}>
      {status}
    </span>
  );
}

function HistoryPage({ jobs, onNewTranslation, onRefresh, onLogout, onDeleteJob }) {
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  async function handleDownload(job) {
    if (!job._id || job.status !== 'completed') return;
    setDownloading(job._id);
    setError('');
    try {
      const blob = await downloadJob(job._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const base = (job.originalFilename || 'document').replace(/\.[^/.]+$/, '');
      const ext = job.fileExtension === 'docx' ? 'docx' : 'pdf';
      link.download = `${base}-translated.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(job) {
    setDeleting(job._id);
    setError('');
    try {
      await onDeleteJob(job._id);
    } catch (err) {
      setError(err.message || 'Could not delete job.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        page="history"
        onNavigate={(p) => {
          if (p === 'translate') onNewTranslation();
        }}
        onLogout={onLogout}
      />
      <main className="main-content">
        <Topbar
          title="Translation history"
          subtitle="Your recent document translations."
        />
        <div className="history-content">
          <div className="history-toolbar">
            <button
              type="button"
              className="secondary-button"
              onClick={onRefresh}
            >
              Refresh
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onNewTranslation}
            >
              New translation
              <span className="button-arrow">+</span>
            </button>
          </div>

          {error && <div className="global-error">{error}</div>}

          {jobs.length === 0 ? (
            <div className="history-empty">
              <p>No translations yet.</p>
              <button
                type="button"
                className="primary-button"
                onClick={onNewTranslation}
              >
                Start your first translation
              </button>
            </div>
          ) : (
            <ul className="history-list">
              {jobs.map((job) => (
                <li key={job._id} className="history-item">
                  <div className="history-item-icon">
                    <FileIcon type={job.fileExtension} />
                  </div>
                  <div className="history-item-info">
                    <div className="history-item-name">
                      {job.originalFilename || 'Untitled document'}
                    </div>
                    <div className="history-item-meta">
                      {LANGUAGE_NAMES[job.targetLanguage] || job.targetLanguage}
                      {' · '}
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                    {job.errorMessage && (
                      <div className="history-item-error">{job.errorMessage}</div>
                    )}
                  </div>
                  <div className="history-item-status">
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="history-item-actions">
                    {job.status === 'completed' && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleDownload(job)}
                        disabled={downloading === job._id}
                      >
                        {downloading === job._id ? 'Downloading...' : 'Download'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button history-delete-button"
                      onClick={() => handleDelete(job)}
                      disabled={deleting === job._id}
                    >
                      {deleting === job._id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default HistoryPage;
