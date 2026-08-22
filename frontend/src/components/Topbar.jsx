function Topbar({
  title,
  subtitle
}) {
  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">
          {title}
        </div>

        {subtitle && (
          <div className="topbar-subtitle">
            {subtitle}
          </div>
        )}
      </div>

      <div className="topbar-status">
        <span className="status-dot" />
        <span>Systems operational</span>
      </div>
    </header>
  );
}

export default Topbar;
