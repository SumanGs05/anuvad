import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ProcessingSteps from '../components/ProcessingSteps';
import FileIcon from '../components/FileIcon';
import { downloadJob } from '../api/client';

function ProcessingPage({
  job,
  file,
  targetLanguage,
  error,
  onNewTranslation,
  onHistory
}) {
  const [downloading, setDownloading] =
    useState(false);

  const completed =
    job?.status === 'completed';

  const failed =
    job?.status === 'failed';

  async function handleDownload() {
    if (!job?._id) return;

    setDownloading(true);

    try {
      const blob = await downloadJob(
        job._id,
        localStorage.getItem(
          'anuvad_access_token'
        )
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;

      const originalName =
        file?.name || 'translated-document';

      const baseName =
        originalName.replace(
          /\.[^/.]+$/,
          ''
        );

      link.download =
        `${baseName}-translated.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        'Download failed:',
        err
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        page="translate"
        onNavigate={(page) => {
          if (page === 'history') {
            onHistory();
          }
        }}
        onLogout={() => {
          localStorage.removeItem(
            'anuvad_access_token'
          );

          window.location.reload();
        }}
      />

      <main className="main-content">
        <Topbar
          title={
            completed
              ? 'Translation complete'
              : failed
                ? 'Translation failed'
                : 'Processing document'
          }
          subtitle={
            completed
              ? 'Your translated document is ready.'
              : 'Anuvad is working on your document.'
          }
        />

        <div className="processing-content">
          <div className="processing-header">
            <div className="eyebrow">
              {completed
                ? 'COMPLETE'
                : failed
                  ? 'ERROR'
                  : 'IN PROGRESS'}
            </div>

            <h1>
              {completed
                ? 'Your document is ready.'
                : failed
                  ? 'Something went wrong.'
                  : 'We’re translating your document.'}
            </h1>

            <p>
              {completed
                ? 'Your document has been translated and reconstructed.'
                : failed
                  ? 'The translation could not be completed.'
                  : 'This usually takes a little while. You can keep this page open while we work.'}
            </p>
          </div>

          {file && (
            <div className="processing-file">
              <FileIcon
                type={
                  file.name
                    ?.split('.')
                    .pop()
                }
              />

              <div>
                <div className="processing-file-name">
                  {file.name}
                </div>

                <div className="processing-file-meta">
                  Target language:{' '}
                  {targetLanguage}
                </div>
              </div>
            </div>
          )}

          <section className="processing-panel">
            <div className="processing-panel-header">
              <div>
                <div className="panel-label">
                  DOCUMENT PIPELINE
                </div>

                <h2>
                  {completed
                    ? 'Finished'
                    : failed
                      ? 'Pipeline stopped'
                      : 'Working through your document'}
                </h2>
              </div>

              <div className="processing-status">
                {job?.status || 'starting'}
              </div>
            </div>

            <ProcessingSteps
              status={
                completed
                  ? 'completed'
                  : failed
                    ? 'failed'
                    : job?.status ||
                      'parsing'
              }
            />

            {error && (
              <div className="global-error">
                {error}
              </div>
            )}
          </section>

          {completed && (
            <div className="processing-actions">
              <button
                type="button"
                className="primary-button"
                onClick={
                  handleDownload
                }
                disabled={downloading}
              >
                {downloading
                  ? 'Preparing download...'
                  : 'Download translated document'}

                <span className="button-arrow">
                  ↓
                </span>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  onNewTranslation
                }
              >
                Translate another document
              </button>
            </div>
          )}

          {failed && (
            <div className="processing-actions">
              <button
                type="button"
                className="primary-button"
                onClick={
                  onNewTranslation
                }
              >
                Try another document
                <span className="button-arrow">
                  →
                </span>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={onHistory}
              >
                View history
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ProcessingPage;
