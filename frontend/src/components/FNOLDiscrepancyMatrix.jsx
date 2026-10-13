import React from 'react';

export default function FNOLDiscrepancyMatrix({ fnolData, rawClaim }) {
  if (!fnolData || !fnolData.analyzed) return null;

  const {
    fnol_score = 0,
    risk_level = 'NEUTRAL',
    word_count = 0,
    linguistic_markers = {},
    contradictions = [],
    deception_flags = [],
    investigator_tip = '',
    summary = '',
  } = fnolData;

  const isCritical = risk_level === 'CRITICAL';
  const isHigh = risk_level === 'HIGH';
  const isSafe = risk_level === 'LOW';

  const themeColor = isCritical ? '#dc2626' : (isHigh ? '#ef4444' : (isSafe ? '#10b981' : '#f59e0b'));

  return (
    <div className="fnol-matrix-container">
      {/* ── Header ── */}
      <div className="fnol-matrix-header">
        <div className="fnol-matrix-badge">
          <span>📝</span> LAYER 4: MULTIMODAL NLP &amp; FNOL CONTRADICTION MATRIX
        </div>
        <div className="fnol-header-flex">
          <div>
            <h3 className="fnol-matrix-title">Linguistic Deception &amp; Cross-Modal Discrepancy Engine</h3>
            <p className="fnol-matrix-subtitle">
              Cross-validates claimant's written FNOL account against <strong>ResNet50 Grad-CAM visual heatmaps</strong> and{' '}
              <strong>XGBoost tabular claim figures</strong> to detect fabricated loss narratives.
            </p>
          </div>
          <div className="fnol-score-pill" style={{ borderColor: themeColor, color: themeColor, background: `${themeColor}15` }}>
            <span className="fnol-score-num">{Math.round(fnol_score)}%</span>
            <span className="fnol-score-lbl">{risk_level} DECEPTION RISK</span>
          </div>
        </div>
      </div>

      {/* ── Metric Chips Row ── */}
      <div className="fnol-metrics-row">
        <div className="fnol-metric-card">
          <span className="fnol-m-lbl">Psychological Distancing:</span>
          <div className="fnol-m-flex">
            <span className="fnol-m-val" style={{ color: linguistic_markers.passive_ratio >= 0.5 ? '#f87171' : '#34d399' }}>
              {Math.round((linguistic_markers.passive_voice_ratio || 0) * 100)}%
            </span>
            <span className="fnol-m-sub">
              ({linguistic_markers.passive_voice_count || 0} passive vs {linguistic_markers.active_voice_count || 0} active)
            </span>
          </div>
          <span className="fnol-m-desc">Fraudsters overuse passive voice to distance themselves from blame.</span>
        </div>

        <div className="fnol-metric-card">
          <span className="fnol-m-lbl">Preemptive Exoneration:</span>
          <div className="fnol-m-flex">
            <span className="fnol-m-val" style={{ color: linguistic_markers.exoneration_phrases?.length > 0 ? '#f87171' : '#34d399' }}>
              {linguistic_markers.exoneration_phrases?.length || 0}
            </span>
            <span className="fnol-m-sub">unprompted assertions</span>
          </div>
          <span className="fnol-m-desc">Excessive claims of absolute innocence ('100% not my fault').</span>
        </div>

        <div className="fnol-metric-card">
          <span className="fnol-m-lbl">Cross-Modal Contradictions:</span>
          <div className="fnol-m-flex">
            <span className="fnol-m-val" style={{ color: contradictions.length > 0 ? '#ef4444' : '#10b981' }}>
              {contradictions.length}
            </span>
            <span className="fnol-m-sub">direct evidence conflicts</span>
          </div>
          <span className="fnol-m-desc">Narrative contradicts physical CNN damage or tabular claim size.</span>
        </div>

        <div className="fnol-metric-card">
          <span className="fnol-m-lbl">Sensory Trivia &amp; Distraction:</span>
          <div className="fnol-m-flex">
            <span className="fnol-m-val" style={{ color: linguistic_markers.sensory_trivia?.length > 0 ? '#fbbf24' : '#94a3b8' }}>
              {linguistic_markers.sensory_trivia?.length || 0}
            </span>
            <span className="fnol-m-sub">trivia markers</span>
          </div>
          <span className="fnol-m-desc">Over-detailing coffee, radio, or weather to fabricate realism.</span>
        </div>
      </div>

      {/* ── Cross-Modal Contradictions Section ── */}
      {contradictions.length > 0 ? (
        <div className="fnol-contradictions-section">
          <div className="fnol-sec-title text-danger">
            <span>🚨</span> DETECTED CROSS-MODAL CONTRADICTIONS ({contradictions.length})
          </div>

          <div className="fnol-contradictions-grid">
            {contradictions.map((c, idx) => (
              <div key={idx} className="fnol-contra-card">
                <div className="fnol-contra-header">
                  <span className={`badge ${c.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>
                    {c.severity} CONTRADICTION
                  </span>
                  <span className="fnol-contra-penalty">+{c.risk_delta}% Risk Penalty</span>
                </div>

                <h4 className="fnol-contra-title">{c.title}</h4>

                <div className="fnol-comparison-grid">
                  <div className="fnol-comp-box fnol-comp-box--claimant">
                    <span className="fnol-comp-tag">🗣️ Claimant Written FNOL:</span>
                    <p className="fnol-comp-text">"{c.claimant_statement}"</p>
                  </div>

                  <div className="fnol-comp-box fnol-comp-box--evidence">
                    <span className="fnol-comp-tag">🤖 AI Physical &amp; Tabular Evidence:</span>
                    <p className="fnol-comp-text">{c.system_evidence}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fnol-clean-box">
          <span>✅</span>
          <div>
            <strong>Cross-Modal Alignment Verified:</strong>
            <p>Written narrative is physically consistent with ResNet50 damage localization and tabular incident severity.</p>
          </div>
        </div>
      )}

      {/* ── Preemptive Exoneration / Linguistic Tags ── */}
      {linguistic_markers.exoneration_phrases && linguistic_markers.exoneration_phrases.length > 0 && (
        <div className="fnol-phrases-box">
          <span className="fnol-phrases-title">⚠️ Flagged Defensive Phrasing:</span>
          <div className="fnol-chips-wrap">
            {linguistic_markers.exoneration_phrases.map((phrase, idx) => (
              <span key={idx} className="fnol-phrase-chip">
                "{phrase}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── SIU Adjuster Interrogation Guide ── */}
      {investigator_tip && (
        <div className="fnol-tip-box">
          <div className="fnol-tip-header">
            <span>💡</span> ACTIONABLE SIU INTERROGATION STRATEGY
          </div>
          <p className="fnol-tip-text">{investigator_tip}</p>
        </div>
      )}
    </div>
  );
}
