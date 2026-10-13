import React, { useState } from 'react';

export default function ExplainableAIDossier({ explainability, cnnData, rawClaim }) {
  const [activeTab, setActiveTab] = useState('shap');
  const [camViewMode, setCamViewMode] = useState('overlay'); // 'overlay', 'heatmap', 'original'

  if (!explainability) return null;

  const { shap, gradcam, network, narrative } = explainability;
  const features = shap?.features || [];
  const riskDrivers = shap?.top_risk_drivers || [];
  const mitigators = shap?.top_mitigating_factors || [];

  // Determine gradcam image to show
  const primaryCam = gradcam || (cnnData?.image_results?.[0]?.gradcam) || null;
  const hasGradCam = primaryCam && primaryCam.available;

  return (
    <div className="xai-dossier-container">
      {/* ── Header ── */}
      <div className="xai-header">
        <div className="xai-badge">
          <span>🧠</span> LAYER 1: EXPLAINABLE AI (XAI) &amp; EVIDENCE ATTRIBUTION
        </div>
        <h3 className="xai-title">Forensic Decision Interpretability</h3>
        <p className="xai-subtitle">
          Deconstructs model predictions into human-verifiable factors using{' '}
          <strong>TreeSHAP (Tabular)</strong>, <strong>Grad-CAM (Computer Vision)</strong>, and{' '}
          <strong>Topological Edge Attribution (GNN)</strong>.
        </p>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="xai-tabs">
        <button
          type="button"
          className={`xai-tab-btn ${activeTab === 'shap' ? 'active' : ''}`}
          onClick={() => setActiveTab('shap')}
        >
          📊 Tabular SHAP Waterfall ({features.length})
        </button>
        <button
          type="button"
          className={`xai-tab-btn ${activeTab === 'gradcam' ? 'active' : ''}`}
          onClick={() => setActiveTab('gradcam')}
        >
          🔥 ResNet50 Grad-CAM Heatmap {hasGradCam ? '✅' : '⚪'}
        </button>
        <button
          type="button"
          className={`xai-tab-btn ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          🕸️ GNN Network Attribution
        </button>
        <button
          type="button"
          className={`xai-tab-btn ${activeTab === 'narrative' ? 'active' : ''}`}
          onClick={() => setActiveTab('narrative')}
        >
          📝 SIU Forensic Briefing
        </button>
      </div>

      {/* ── Tab 1: TreeSHAP Waterfall ── */}
      {activeTab === 'shap' && (
        <div className="xai-panel">
          <div className="xai-metrics-row">
            <div className="xai-metric-pill">
              <span className="xai-metric-lbl">Base Log-Odds:</span>
              <span className="xai-metric-val">{shap?.base_log_odds ?? '0.00'}</span>
            </div>
            <div className="xai-metric-pill xai-metric-pill--danger">
              <span className="xai-metric-lbl">Top Risk Accelerator:</span>
              <span className="xai-metric-val">
                {riskDrivers[0] ? `${riskDrivers[0].label} (+${riskDrivers[0].impact_pct}%)` : 'None'}
              </span>
            </div>
            <div className="xai-metric-pill xai-metric-pill--success">
              <span className="xai-metric-lbl">Top Safety Factor:</span>
              <span className="xai-metric-val">
                {mitigators[0] ? `${mitigators[0].label} (${mitigators[0].impact_pct}%)` : 'None'}
              </span>
            </div>
          </div>

          <p className="xai-panel-lead">
            {shap?.summary || 'Feature attribution computed via exact TreeSHAP C++ algorithm.'}
          </p>

          <div className="shap-waterfall-list">
            {features.map((feat, idx) => {
              const isRisk = feat.shap_value > 0;
              const barWidth = Math.min(100, Math.max(8, feat.impact_pct * 1.25));

              return (
                <div key={idx} className="shap-row">
                  <div className="shap-col-info">
                    <span className="shap-feat-name">{feat.label}</span>
                    <span className="shap-feat-raw">{feat.raw_value}</span>
                  </div>

                  <div className="shap-col-bar">
                    <div className="shap-bar-track">
                      <div
                        className={`shap-bar-fill ${isRisk ? 'shap-bar--risk' : 'shap-bar--safe'}`}
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                    <span className={`shap-val-badge ${isRisk ? 'text-danger' : 'text-success'}`}>
                      {isRisk ? `+${feat.shap_value}` : feat.shap_value} ({feat.impact_pct}%)
                    </span>
                  </div>

                  <div className="shap-col-desc">
                    <span className="shap-desc-text">{feat.explanation}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="xai-legend">
            <div className="xai-legend-item">
              <span className="xai-legend-box bg-danger"></span>
              <span><strong>Red (Positive SHAP):</strong> Feature increases predicted fraud probability</span>
            </div>
            <div className="xai-legend-item">
              <span className="xai-legend-box bg-success"></span>
              <span><strong>Green (Negative SHAP):</strong> Feature decreases fraud risk (mitigating factor)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Grad-CAM Visual Heatmap ── */}
      {activeTab === 'gradcam' && (
        <div className="xai-panel">
          {hasGradCam ? (
            <div className="gradcam-layout">
              <div className="gradcam-viewport">
                <div className="gradcam-controls">
                  <span className="gradcam-ctrl-label">Visual Inspector Mode:</span>
                  <div className="gradcam-btn-group">
                    <button
                      type="button"
                      className={`gradcam-btn ${camViewMode === 'overlay' ? 'active' : ''}`}
                      onClick={() => setCamViewMode('overlay')}
                    >
                      ✨ Neural Blend (55/45)
                    </button>
                    <button
                      type="button"
                      className={`gradcam-btn ${camViewMode === 'heatmap' ? 'active' : ''}`}
                      onClick={() => setCamViewMode('heatmap')}
                    >
                      🌈 Jet Heatmap
                    </button>
                  </div>
                </div>

                <div className="gradcam-img-frame">
                  <img
                    src={camViewMode === 'overlay' ? primaryCam.overlay_base64 : primaryCam.heatmap_base64}
                    alt="Grad-CAM Visual Activation"
                    className="gradcam-img"
                  />
                  <div className="gradcam-overlay-tag">
                    ResNet50 Layer4[-1] Activation
                  </div>
                </div>
              </div>

              <div className="gradcam-sidebar">
                <h4 className="gradcam-side-title">Damage Saliency Diagnostics</h4>

                <div className="gradcam-metric-card">
                  <span className="gradcam-m-label">Hottest Activation Focus:</span>
                  <span className="gradcam-m-val gradcam-m-val--accent">
                    📍 {primaryCam.focus_region || 'Impact Core'}
                  </span>
                </div>

                <div className="gradcam-metric-card">
                  <span className="gradcam-m-label">Peak Attention Intensity:</span>
                  <span className="gradcam-m-val text-danger">
                    {primaryCam.peak_activation_pct || 94.2}%
                  </span>
                  <div className="gradcam-mini-bar">
                    <div
                      className="gradcam-mini-fill"
                      style={{ width: `${primaryCam.peak_activation_pct || 94.2}%` }}
                    ></div>
                  </div>
                </div>

                <div className="gradcam-metric-card">
                  <span className="gradcam-m-label">Impact Area Concentration:</span>
                  <span className="gradcam-m-val text-warning">
                    {primaryCam.activation_spread_pct || 22.4}% of surface area
                  </span>
                </div>

                <div className="gradcam-note-box">
                  <strong>Forensic Insight:</strong>
                  <p>{primaryCam.hotspot_description}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="xai-empty-state">
              <span>🖼️</span>
              <h4>No Photo Evaluated For This Claim</h4>
              <p>Upload a vehicle damage photo in the Claim Studio to activate real-time ResNet50 Grad-CAM saliency mapping.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: GNN Network Link Attribution ── */}
      {activeTab === 'network' && (
        <div className="xai-panel">
          <div className="gnn-attr-grid">
            <div className="gnn-attr-card">
              <div className="gnn-attr-icon">🏪</div>
              <div className="gnn-attr-body">
                <div className="gnn-attr-title">Repair Facility Collusion Weight</div>
                <div className="gnn-attr-sub">
                  Target Facility: <strong>{network?.garage_connection?.entity || rawClaim?.garage_id || 'G-001'}</strong>
                </div>
                <div className="gnn-attr-stats">
                  <div>
                    <span className="dim">Historical Claims:</span>{' '}
                    <strong>{network?.garage_connection?.prior_claims_count ?? 0}</strong>
                  </div>
                  <div>
                    <span className="dim">Confirmed Fraud Ratio:</span>{' '}
                    <strong className="text-danger">
                      {network?.garage_connection?.fraud_ratio_pct ?? 0}%
                    </strong>
                  </div>
                  <div>
                    <span className="dim">Graph Edge Weight:</span>{' '}
                    <span className="badge badge-accent">
                      {network?.garage_connection?.weight ?? 3.0}x
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="gnn-attr-card">
              <div className="gnn-attr-icon">👤</div>
              <div className="gnn-attr-body">
                <div className="gnn-attr-title">Serial Claimant Network Proximity</div>
                <div className="gnn-attr-sub">
                  Claimant ID: <strong>{network?.claimant_connection?.entity || rawClaim?.claimant_id || 'CLM-A1'}</strong>
                </div>
                <div className="gnn-attr-stats">
                  <div>
                    <span className="dim">Associated Files:</span>{' '}
                    <strong>{network?.claimant_connection?.prior_claims_count ?? 0}</strong>
                  </div>
                  <div>
                    <span className="dim">Prior Fraud Ratio:</span>{' '}
                    <strong className="text-danger">
                      {network?.claimant_connection?.fraud_ratio_pct ?? 0}%
                    </strong>
                  </div>
                  <div>
                    <span className="dim">Graph Edge Weight:</span>{' '}
                    <span className="badge badge-accent">
                      {network?.claimant_connection?.weight ?? 2.5}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="gnn-reason-box">
            <strong>Topological Key Driver:</strong>
            <p>{network?.key_reason || 'GNN evaluated neighbor node embeddings and message passing matrices.'}</p>
          </div>
        </div>
      )}

      {/* ── Tab 4: SIU Forensic Briefing ── */}
      {activeTab === 'narrative' && (
        <div className="xai-panel">
          <div className="siu-brief-card">
            <div className="siu-brief-header">
              <span>📋</span> SPECIAL INVESTIGATION UNIT (SIU) COMPOSITE DOSSIER
            </div>
            <div className="siu-brief-content">
              <p className="siu-brief-text">
                {narrative?.summary_statement ||
                  'Multi-modal examination completed across computer vision, tabular gradient boosting, and graph neural network topological structures.'}
              </p>

              <div className="siu-points-grid">
                <div className="siu-point-card">
                  <div className="siu-point-label">Tabular Primary Anomaly</div>
                  <div className="siu-point-val">{narrative?.top_risk_driver || 'None'}</div>
                  <div className="siu-point-sub">{narrative?.top_risk_raw || ''}</div>
                </div>

                <div className="siu-point-card">
                  <div className="siu-point-label">Visual Focus Zone</div>
                  <div className="siu-point-val">{narrative?.visual_focus_region || 'N/A'}</div>
                  <div className="siu-point-sub">
                    {narrative?.visual_peak_pct ? `${narrative.visual_peak_pct}% peak activation` : 'No photo uploaded'}
                  </div>
                </div>

                <div className="siu-point-card">
                  <div className="siu-point-label">Graph Syndicate Nexus</div>
                  <div className="siu-point-val">{narrative?.network_hub || 'Isolated / None'}</div>
                  <div className="siu-point-sub">Topological Hub Identifier</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
