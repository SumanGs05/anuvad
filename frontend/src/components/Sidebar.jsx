function Sidebar({
  page,
  onNavigate,
  onLogout
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          अ
        </div>
        <div className="sidebar-text">
          <div className="sidebar-name">
            anuvad
          </div>
          <div className="sidebar-tagline">
            DOCUMENT TRANSLATION
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item ${
            page === 'translate'
              ? 'nav-item-active'
              : ''
          }`}
          onClick={() =>
            onNavigate('translate')
          }
        >
          <span className="nav-icon">+</span>
          <span>New translation</span>
        </button>
        <button
          type="button"
          className={`nav-item ${
            page === 'history'
              ? 'nav-item-active'
              : ''
          }`}
          onClick={() =>
            onNavigate('history')
          }
        >
          <span className="nav-icon">◷</span>
          <span>History</span>
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <span className="status-dot" />
          <span>Systems operational</span>
        </div>
        <div className="sidebar-divider" />
        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
        >
          <span>↪</span>
          <span>Sign out</span>
        </button>
        <div className="sidebar-version">
          ANUVAD · PROTOTYPE
        </div>
      </div>
    </aside>
  );
}
export default Sidebar;
