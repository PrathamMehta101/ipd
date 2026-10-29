import React from 'react';

export default function Header({ status, activeTab, setActiveTab }) {
  const links = [
    { id: 'analysis', label: 'Claim Analysis' },
    { id: 'graph',    label: 'Fraud Network' },
    { id: 'history',  label: 'Case Database' },
  ];

  return (
    <header className="nav">
      <div className="nav-brand">
        <div className="nav-icon">
          <i className="fa-solid fa-shield-halved" />
        </div>
        <span className="nav-title">
          IntelliClaim
        </span>
      </div>

      <nav className="nav-links">
        {links.map(l => (
          <button
            key={l.id}
            className={`nav-link${activeTab === l.id ? ' active' : ''}`}
            onClick={() => setActiveTab(l.id)}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="nav-status">
        <div className={`status-dot${status.online ? ' live' : ''}`} />
        {status.online
          ? `${status.device.toUpperCase()} · AI Ready`
          : 'Connecting…'}
      </div>
    </header>
  );
}
