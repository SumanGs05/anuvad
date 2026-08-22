import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import UploadZone from '../components/UploadZone';
import LanguageSelector from '../components/LanguageSelector';

function TranslatePage({
  file,
  setFile,
  targetLanguage,
  setTargetLanguage,
  loading,
  error,
  onTranslate,
  onHistory,
  onLogout
}) {
  return (
    <div className="app-shell">
      <Sidebar
        page="translate"
        onNavigate={(page) => {
          if (page === 'history') {
            onHistory();
          }
        }}
        onLogout={onLogout}
      />

      <main className="main-content">
        <Topbar
          title="New translation"
          subtitle="Translate a document without losing its structure."
        />

        <div className="translate-content">
          <section className="translate-hero">
            <div className="eyebrow">
              DOCUMENT TRANSLATION
            </div>

            <h1>
              Your document.
              <br />
              <span>
                Your language.
              </span>
            </h1>

            <p>
              Upload a document and Anuvad
              will translate its content while
              preserving headings, paragraphs
              and tables.
            </p>
          </section>

          <section className="translation-panel">
            <div className="panel-header">
              <div>
                <div className="panel-label">
                  STEP 01
                </div>

                <h2>
                  Upload your document
                </h2>
              </div>

              <div className="panel-number">
                01
              </div>
            </div>

            <UploadZone
              file={file}
              onFileChange={setFile}
            />

            <div className="panel-divider" />

            <div className="language-row">
              <div>
                <div className="panel-label">
                  STEP 02
                </div>

                <h2>
                  Choose a language
                </h2>
              </div>

              <LanguageSelector
                value={targetLanguage}
                onChange={
                  setTargetLanguage
                }
              />
            </div>

            {error && (
              <div className="global-error">
                {error}
              </div>
            )}

            <button
              type="button"
              className="primary-button translate-button"
              disabled={
                !file || loading
              }
              onClick={onTranslate}
            >
              <span>
                {loading
                  ? 'Starting translation...'
                  : 'Translate document'}
              </span>

              <span className="button-arrow">
                →
              </span>
            </button>
          </section>

          <div className="translate-footer">
            <span>
              Powered by Sarvam AI
            </span>

            <span>
              Your files are processed
              securely.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TranslatePage;
