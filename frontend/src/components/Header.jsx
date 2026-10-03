import React from 'react';

export default function Header({ status }) {
  return (
    <header className="navbar">
      <div className="logo">
        <div className="logo-icon">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <div className="logo-text">
          <span className="brand-title">AutoShield <span className="accent-text">AI</span></span>
          <span className="brand-sub">Multi-Modal Vision, Tabular &amp; GNN Fraud Intelligence</span>
        </div>
      </div>
      
      <div className="system-status">
        <div className={`status-indicator ${status.online ? 'online' : 'loading'}`}></div>
        <span>
          {status.online 
            ? `Tri-Modal AI Active (CNN + XGBoost + GNN) • ${status.device.toUpperCase()}`
            : 'Connecting to Backend Server...'}
        </span>
      </div>
    </header>
  );
}
