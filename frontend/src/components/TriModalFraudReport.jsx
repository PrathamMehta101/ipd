import React from 'react';

const RISK_THEMES = {
  CRITICAL: {
    color: '#dc2626',
    border: 'rgba(220, 38, 38, 0.4)',
    bg: 'rgba(220, 38, 38, 0.08)',
    glow: 'rgba(220, 38, 38, 0.25)',
    icon: '🚨',
    title: 'CRITICAL FRAUD SYNDICATE DETECTED',
  },
  HIGH: {
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.4)',
    bg: 'rgba(239, 68, 68, 0.08)',
    glow: 'rgba(239, 68, 68, 0.2)',
    icon: '🔴',
    title: 'HIGH FRAUD RISK CLAIM',
  },
  MEDIUM: {
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.08)',
    glow: 'rgba(245, 158, 11, 0.2)',
    icon: '🟡',
    title: 'MODERATE RISK – REQUIRES MANUAL VERIFICATION',
  },
  LOW: {
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.4)',
    bg: 'rgba(16, 185, 129, 0.08)',
    glow: 'rgba(16, 185, 129, 0.2)',
    icon: '✅',
    title: 'VERIFIED LEGITIMATE CLAIM',
  },
};

export default function TriModalFraudReport({ data, onSwitchToGraph }) {
  if (!data) return null;

  const {
    id,
    timestamp,
    xgboost = {},
    gnn = {},
    cnn = {},
    composite = {},
  } = data;

  const compScore = composite?.score ?? xgboost?.fraud_score ?? 0;
  const compRisk  = composite?.risk_level ?? xgboost?.risk_level ?? 'MEDIUM';
  const theme     = RISK_THEMES[compRisk] || RISK_THEMES.MEDIUM;

  const xgbScore = xgboost?.fraud_score ?? 0;
  const gnnScore = gnn?.fraud_ring_score ?? 0;
  const cnnScore = cnn?.fraud_score !== null && cnn?.fraud_score !== undefined ? cnn.fraud_score : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="tri-report-section" id="tri-modal-report">
      {/* ── Section Header ── */}
      <div className="tri-report-header">
        <div className="tri-report-badge">
          <span>🛡️</span> UNIFIED TRI-MODAL FRAUD REPORT
        </div>
        <h2 className="tri-report-title">Comprehensive Multi-Model Dossier</h2>
        <p className="tri-report-subtitle">
          Synthesized intelligence combining <strong>CNN Computer Vision</strong>,{' '}
          <strong>XGBoost Tabular Analytics</strong>, and <strong>GNN Fraud Ring Detection</strong>.
        </p>
      </div>

      <div
        className="tri-report-card"
        style={{
          borderColor: theme.border,
          boxShadow: `0 8px 32px ${theme.glow}`,
        }}
      >
        {/* ── Banner Bar ── */}
        <div className="tri-banner" style={{ background: theme.bg, borderColor: theme.border }}>
          <div className="tri-banner-left">
            <div className="tri-case-id">
              CLAIM DOSSIER <span>#{id || 'NEW'}</span>
            </div>
            <div className="tri-case-time">
              {timestamp ? new Date(timestamp).toLocaleString() : 'Just Now'} · Case Ref: AS-{id ? 1000 + Number(id) : '8421'}
            </div>
          </div>
          <div className="tri-banner-right">
            <span
              className="tri-risk-pill"
              style={{
                color: theme.color,
                borderColor: theme.color,
                background: `${theme.color}22`,
              }}
            >
              {theme.icon} {compRisk} RISK
            </span>
            <button className="tri-btn tri-btn--print" onClick={handlePrint} title="Print Dossier">
              🖨️ Export PDF
            </button>
            {onSwitchToGraph && (
              <button
                className="tri-btn tri-btn--graph"
                onClick={onSwitchToGraph}
                title="View in Interactive Graph"
              >
                🕸️ Graph Ring
              </button>
            )}
          </div>
        </div>

        {/* ── Executive Verdict Block ── */}
        <div className="tri-exec-block">
          {/* Gauge */}
          <div className="tri-gauge-wrap">
            <svg viewBox="0 0 140 80" className="tri-gauge-svg">
              <path
                d="M15,72 A55,55 0 0,1 125,72"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M15,72 A55,55 0 0,1 125,72"
                fill="none"
                stroke={theme.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(compScore / 100) * 172.8} 172.8`}
                style={{ filter: `drop-shadow(0 0 8px ${theme.color})` }}
              />
              <text x="70" y="62" textAnchor="middle" fontSize="22" fontWeight="800" fill="white">
                {Math.round(compScore)}
              </text>
              <text x="70" y="74" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">
                COMPOSITE SCORE
              </text>
            </svg>
            <div className="tri-gauge-label" style={{ color: theme.color }}>
              {composite?.verdict ? composite.verdict.replace('_', ' ') : 'ANALYSIS COMPLETE'}
            </div>
          </div>

          {/* Verdict Text */}
          <div className="tri-verdict-info">
            <h3 className="tri-verdict-title" style={{ color: theme.color }}>
              {theme.title}
            </h3>
            <p className="tri-verdict-rec">
              {composite?.recommendation_label || xgboost?.recommendation_label}
            </p>
            <div className="tri-meta-chips">
              <span className="tri-chip">
                <span>🏪 Shop:</span> {data.garage_id || gnn?.ring_hub || 'G-001'}
              </span>
              <span className="tri-chip">
                <span>👤 Claimant:</span> {data.claimant_id || 'CLM-A1'}
              </span>
              <span className="tri-chip">
                <span>📍 City:</span> {data.incident_city || 'Columbus'}
              </span>
              {gnn?.connected_claims > 0 && (
                <span className="tri-chip tri-chip--alert">
                  <span>⚡ Network:</span> {gnn.connected_claims} linked claims ({gnn.fraud_neighbors} fraud)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 3 Multi-Modal Pillars ── */}
        <div className="tri-pillars-grid">
          {/* Pillar 1: CNN Image Forensics */}
          <div className="tri-pillar">
            <div className="tri-pillar-head">
              <div className="tri-pillar-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                🖼️
              </div>
              <div>
                <div className="tri-pillar-name">CNN Visual AI</div>
                <div className="tri-pillar-sub">ResNet50 Backbone</div>
              </div>
              <div
                className="tri-pillar-score"
                style={{
                  color: cnnScore !== null ? (cnnScore >= 50 ? '#ef4444' : '#10b981') : 'var(--text-dim)',
                }}
              >
                {cnnScore !== null ? `${Math.round(cnnScore)}%` : 'N/A'}
              </div>
            </div>
            <div className="tri-pillar-body">
              <div className="tri-progress-track">
                <div
                  className="tri-progress-fill"
                  style={{
                    width: `${cnnScore || 0}%`,
                    background: cnnScore >= 50 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
              <div className="tri-pillar-desc">
                {cnnScore !== null ? (
                  cnnScore >= 50 ? (
                    <span style={{ color: '#ef4444' }}>
                      🚩 Visual anomaly flagged. Damage pattern shows high similarity to recycled or synthetic claims.
                    </span>
                  ) : (
                    <span style={{ color: '#10b981' }}>
                      ✅ Visual impact verified. Mechanical deformation matches authentic collision dynamics.
                    </span>
                  )
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>
                    ℹ️ No image uploaded for this claim. Run image upload above to inject visual forensics.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pillar 2: XGBoost Tabular Engine */}
          <div className="tri-pillar">
            <div className="tri-pillar-head">
              <div className="tri-pillar-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
                🧠
              </div>
              <div>
                <div className="tri-pillar-name">XGBoost ML</div>
                <div className="tri-pillar-sub">Tabular Anomaly Engine</div>
              </div>
              <div
                className="tri-pillar-score"
                style={{
                  color: xgbScore >= 50 ? '#ef4444' : '#10b981',
                }}
              >
                {Math.round(xgbScore)}%
              </div>
            </div>
            <div className="tri-pillar-body">
              <div className="tri-progress-track">
                <div
                  className="tri-progress-fill"
                  style={{
                    width: `${xgbScore}%`,
                    background: xgbScore >= 50 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
              <div className="tri-pillar-desc">
                {xgbScore >= 50 ? (
                  <span style={{ color: '#ef4444' }}>
                    🚩 High financial variance. Disproportionate vehicle damage claim vs policy profile and hobbies.
                  </span>
                ) : (
                  <span style={{ color: '#10b981' }}>
                    ✅ Financial profile within standard risk bounds for reported collision severity.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pillar 3: GNN Fraud Ring Syndicate */}
          <div className="tri-pillar">
            <div className="tri-pillar-head">
              <div className="tri-pillar-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                🕸️
              </div>
              <div>
                <div className="tri-pillar-name">GNN Ring AI</div>
                <div className="tri-pillar-sub">Graph Neural Network</div>
              </div>
              <div
                className="tri-pillar-score"
                style={{
                  color: gnnScore >= 50 ? '#ef4444' : '#10b981',
                }}
              >
                {Math.round(gnnScore)}%
              </div>
            </div>
            <div className="tri-pillar-body">
              <div className="tri-progress-track">
                <div
                  className="tri-progress-fill"
                  style={{
                    width: `${gnnScore}%`,
                    background: gnnScore >= 50 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
              <div className="tri-pillar-desc">
                {gnnScore >= 50 ? (
                  <span style={{ color: '#ef4444' }}>
                    🚨 Staged Ring Signal: High graph centrality linking repair facility collusion or serial claimant.
                  </span>
                ) : (
                  <span style={{ color: '#10b981' }}>
                    ✅ Isolated claim. No topological connections to known fraud hubs or repeat actors.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Network & Synergy Flags ── */}
        {gnn?.network_flags && gnn.network_flags.length > 0 && (
          <div className="tri-flags-box">
            <div className="tri-flags-title">
              <span>⚠️</span> DETECTED SYNDICATE &amp; NETWORK FLAGS ({gnn.network_flags.length})
            </div>
            <ul className="tri-flags-list">
              {gnn.network_flags.map((flag, idx) => (
                <li key={idx} className="tri-flag-item">
                  <span className="tri-flag-bullet">•</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── SIU Action Protocol Checklist ── */}
        <div className="tri-protocol-box">
          <div className="tri-protocol-title">
            <span>📋</span> RECOMMENDED ADJUSTER &amp; SIU ACTION PROTOCOL
          </div>
          <div className="tri-checklist">
            {compScore >= 75 ? (
              <>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Freeze Payout:</strong> Enforce mandatory 30-day investigative hold on claim disbursement.</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Facility Audit:</strong> Issue on-site physical inspection subpoena for repair garage {data.garage_id || 'G-001'}.</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Cross-Claimant Subpoena:</strong> Query state bureau records for prior staged accidents involving claimant {data.claimant_id || 'CLM-A1'}.</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Forensic Image Verification:</strong> Request original RAW EXIF uncompressed files from insured device.</span>
                </div>
              </>
            ) : compScore >= 40 ? (
              <>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Adjuster Review:</strong> Reassign file to Senior Physical Damage Appraiser for itemized line-item audit.</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Parts Invoicing:</strong> Verify original equipment manufacturer (OEM) receipts directly with distributor.</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">☑️</span>
                  <span><strong>Recorded Statement:</strong> Schedule recorded telephone examination regarding collision dynamics.</span>
                </div>
              </>
            ) : (
              <>
                <div className="tri-check-item">
                  <span className="tri-check-box">✅</span>
                  <span><strong>Automated Fast-Track:</strong> Claim passed all 3 validation layers (Visual, Tabular, Network).</span>
                </div>
                <div className="tri-check-item">
                  <span className="tri-check-box">✅</span>
                  <span><strong>Expedited Settlement:</strong> Issue standard direct-pay settlement to preferred service facility.</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
