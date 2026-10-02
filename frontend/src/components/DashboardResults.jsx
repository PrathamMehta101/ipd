import React from 'react';

export default function DashboardResults({ results, files }) {
  const { 
    overall_fraud_score: score, 
    overall_risk_level: riskLevel, 
    recommendation_label: recLabel, 
    duplicate_warnings: warnings, 
    total_images_analyzed: totalCount,
    image_results: imageResults 
  } = results;

  const circumference = 326.72;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let gaugeColor = 'var(--color-success)';
  let recIcon = <i className="fa-solid fa-shield-check text-success"></i>;
  let recBg = 'var(--color-success-bg)';

  if (riskLevel === 'MEDIUM') {
    gaugeColor = 'var(--color-warning)';
    recIcon = <i className="fa-solid fa-user-gear text-warning"></i>;
    recBg = 'var(--color-warning-bg)';
  } else if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    gaugeColor = 'var(--color-danger)';
    recIcon = <i className="fa-solid fa-triangle-exclamation text-danger"></i>;
    recBg = 'var(--color-danger-bg)';
  }

  const maxScore = imageResults ? Math.max(...imageResults.map(r => r.prediction.fraud_score)) : 0;
  const totalTimeMs = imageResults ? imageResults.reduce((acc, curr) => acc + curr.processing_time_ms, 0) : 0;

  return (
    <section className="results-section">
      {warnings && warnings.length > 0 && (
        <div className="warning-banner">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{warnings.join(' | ')}</span>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Score Card */}
        <div className="glass-panel score-card">
          <h3>Overall Fraud Score</h3>
          <div className="gauge-wrapper">
            <svg className="score-gauge" viewBox="0 0 120 120">
              <circle className="gauge-bg" cx="60" cy="60" r="52"></circle>
              <circle 
                className="gauge-fill" 
                cx="60" cy="60" r="52" 
                strokeDasharray="326.7" 
                strokeDashoffset={strokeDashoffset}
                style={{ stroke: gaugeColor }}
              ></circle>
            </svg>
            <div className="gauge-center">
              <span className="score-value">{score.toFixed(1)}%</span>
              <span className="score-label">Fraud Probability</span>
            </div>
          </div>
          <div className={`risk-badge ${riskLevel}`}>{riskLevel} RISK CLAIM</div>
        </div>

        {/* Claim Assessment Summary */}
        <div className="glass-panel summary-card">
          <h3>Claim Assessment Summary</h3>
          
          <div className="recommendation-box">
            <div className="rec-icon" style={{ background: recBg }}>{recIcon}</div>
            <div className="rec-details">
              <span className="rec-title">Recommended Insurance Action</span>
              <h4>{recLabel}</h4>
            </div>
          </div>

          <div className="metrics-row">
            <div className="metric-item">
              <span className="metric-value">{totalCount}</span>
              <span className="metric-label">Photos Analyzed</span>
            </div>
            <div className="metric-item">
              <span className="metric-value">{maxScore.toFixed(1)}%</span>
              <span className="metric-label">Peak Image Risk</span>
            </div>
            <div className="metric-item">
              <span className="metric-value">{totalTimeMs.toFixed(0)} ms</span>
              <span className="metric-label">Pipeline Speed</span>
            </div>
          </div>

          <div className="report-actions">
            <button type="button" className="btn btn-outline" onClick={() => window.print()}>
              <i className="fa-solid fa-print"></i> Print Full Audit Report
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
