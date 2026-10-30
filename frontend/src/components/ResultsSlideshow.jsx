import React, { useState } from 'react';

/* ─── helpers ─────────────────────────────────────────────────────── */
function riskClass(score) {
  if (score >= 80) return 'sc-critical';
  if (score >= 60) return 'sc-high';
  if (score >= 35) return 'sc-medium';
  return 'sc-low';
}
function riskLabel(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}
function pillarColor(score) {
  if (score >= 70) return '#f87171';
  if (score >= 40) return '#93c5fd';
  return '#6ee7b7';
}

/* ─── Slide 1: Verdict ────────────────────────────────────────────── */
function SlideVerdict({ data, onJumpToSIU, onDownloadPdf, isDownloading }) {
  const comp = data.composite || {};
  const score = comp.score ?? data.xgboost?.fraud_score ?? 0;
  const risk  = comp.risk_level ?? 'MEDIUM';
  const rec   = comp.recommendation_label ?? '';

  const colors = {
    CRITICAL: { border: 'rgba(248,113,113,0.2)', bg: 'rgba(248,113,113,0.04)', c: '#f87171' },
    HIGH:     { border: 'rgba(252,165,165,0.15)', bg: 'rgba(252,165,165,0.03)', c: '#fca5a5' },
    MEDIUM:   { border: 'rgba(147,197,253,0.15)', bg: 'rgba(147,197,253,0.03)', c: '#93c5fd' },
    LOW:      { border: 'rgba(110,231,183,0.12)', bg: 'rgba(110,231,183,0.03)', c: '#6ee7b7' },
  };
  const th = colors[risk] || colors.MEDIUM;

  const xgb = data.xgboost?.fraud_score ?? 0;
  const gnn = data.gnn?.fraud_ring_score ?? 0;
  const rawCnn = data.cnn?.fraud_score ?? data.cnn?.fraud_probability ?? null;
  const cnn = rawCnn !== null && rawCnn !== undefined
    ? (Number(rawCnn) > 0 && Number(rawCnn) <= 1.0 ? Number(rawCnn) * 100 : Number(rawCnn))
    : null;
  const fnol = data.fnol?.fnol_score ?? null;
  const sha = data.evidence_sha256 || data.siu_brief?.evidence_sha256;

  return (
    <div className="slide-panel fade-in">
      {/* verdict band */}
      <div className="verdict-band" style={{ borderColor: th.border, background: th.bg }}>
        <div className="score-chip" style={{ color: th.c, borderColor: th.border, background: th.bg }}>
          <span className="score-num">{Math.round(score)}</span>
          <span className="score-lbl">RISK</span>
        </div>
        <div>
          <div className="verdict-main" style={{ color: th.c }}>
            {risk} FRAUD RISK
          </div>
          <div className="verdict-sub">{rec || 'Analysis complete.'}</div>
          {data.timestamp && (
            <div style={{ marginTop: '0.5rem', fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--txt-lo)' }}>
              {new Date(data.timestamp).toLocaleString()} · Case #{data.id || '—'}
            </div>
          )}
        </div>
      </div>

      {/* Layer 7: SIU Action & Evidence Seal Strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '1rem 0', padding: '0.75rem 1.1rem',
        background: 'var(--bg-raised)', border: '1px solid var(--border-blue)',
        borderRadius: 'var(--r-md)', flexWrap: 'wrap', gap: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.85rem' }}>🔒</span>
          <div>
            <div style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)', textTransform: 'uppercase' }}>
              Immutable Evidence Digest (FRE 902(13)/(14))
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--blue-300)' }}>
              {sha ? `${sha.slice(0, 24)}…` : 'Certified & SHA-256 Hashed'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={onJumpToSIU}
            style={{ fontSize: '0.72rem' }}
          >
            📋 Generate SIU Investigation Brief
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onDownloadPdf}
            disabled={isDownloading}
            style={{ fontSize: '0.72rem' }}
          >
            {isDownloading ? '⏳ Exporting PDF…' : '📄 Export Legal PDF'}
          </button>
        </div>
      </div>

      {/* pillar scores */}
      <div className="pillars">
        {[
          { lbl: 'XGBoost Tabular', score: xgb, sub: xgb >= 50 ? 'Anomaly Detected' : 'Normal Policy' },
          { lbl: 'GNN Ring Score',  score: gnn, sub: gnn >= 50 ? 'Ring Pattern' : 'Isolated Claim' },
          ...(cnn  !== null ? [{
            lbl: 'CNN Visual',
            score: cnn,
            sub: cnn >= 50 ? 'Visual Anomaly' : 'Low Visual Risk'
          }]  : []),
          ...(fnol !== null ? [{
            lbl: 'FNOL NLP',
            score: fnol,
            sub: fnol >= 50 ? 'Contradiction Flagged' : 'Consistent Statement'
          }] : []),
          ...(data.tampering || (data.bill_padding && data.bill_padding.parsed) ? [{
            lbl: 'Forensics & ELA',
            score: data.tampering?.tampering_risk_score ?? (data.bill_padding?.bill_padding_risk_score ?? 0),
            sub: data.tampering?.salvage_matches?.length > 0
              ? 'Salvage Scrap Matched'
              : (data.tampering?.ela_tampering_detected
                ? 'Digital Alteration Suspected'
                : (data.bill_padding?.padding_percentage > 15
                  ? `+${data.bill_padding.padding_percentage}% Bill Padding`
                  : 'Metadata & Pixels Clean'))
          }] : []),
        ].map(p => (
          <div className="pillar" key={p.lbl}>
            <div className="pillar-lbl">{p.lbl}</div>
            <div className="pillar-score" style={{ color: pillarColor(p.score) }}>
              {`${Math.round(p.score)}%`}
            </div>
            <div className="pillar-track">
              <div
                className="pillar-fill"
                style={{ width: `${Math.max(p.score > 0 ? 3 : 0, p.score)}%`, background: pillarColor(p.score) }}
              />
            </div>
            {p.sub && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)' }}>
                {p.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* key claim info */}
      <div className="card card-sm">
        <span className="card-label">Claim metadata</span>
        {[
          ['Claimant ID',     data.claimant_id],
          ['Garage',          data.garage_id],
          ['City',            data.incident_city],
          ['State',           data.policy_state],
          ['Incident Desc.',  data.incident_description
            ? data.incident_description.slice(0, 90) + '…' : null],
        ].filter(r => r[1]).map(([lbl, val]) => (
          <div className="drow" key={lbl}>
            <span className="drow-lbl">{lbl}</span>
            <span className="drow-val">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 2: XAI / SHAP ─────────────────────────────────────────── */
function SlideXAI({ data }) {
  const shap = data.explainability?.shap;
  const gradcam = data.explainability?.gradcam || (data.cnn?.image_results?.[0]?.gradcam);
  const [camMode, setCamMode] = useState('overlay');

  const features = shap?.features || [];

  return (
    <div className="slide-panel fade-in">
      <div className="card card-sm" style={{ marginBottom: '0.75rem' }}>
        <span className="card-label">TreeSHAP — Feature Attribution</span>
        {features.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--txt-lo)' }}>
            No tabular analysis data available.
          </p>
        )}
        <div className="shap-list">
          {features.map((f, i) => {
            const isRisk = f.shap_value > 0;
            const w = Math.min(100, Math.max(6, f.impact_pct * 1.3));
            return (
              <div className="shap-row" key={i}>
                <div>
                  <div className="shap-feat">{f.label}</div>
                  <div className="shap-feat-raw">{f.raw_value}</div>
                </div>
                <div className="shap-track">
                  <div
                    className={isRisk ? 'shap-fill-risk' : 'shap-fill-safe'}
                    style={{ width: `${w}%` }}
                  />
                </div>
                <div
                  className="shap-val"
                  style={{ color: isRisk ? '#f87171' : '#6ee7b7' }}
                >
                  {isRisk ? '+' : ''}{f.shap_value} ({f.impact_pct}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {gradcam?.available && (
        <div className="card card-sm">
          <span className="card-label">ResNet50 Grad-CAM — Visual Attention</span>
          <div className="cam-toggle">
            {['overlay', 'heatmap'].map(m => (
              <button
                key={m}
                className={`cam-btn${camMode === m ? ' active' : ''}`}
                onClick={() => setCamMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="cam-frame">
            <img
              className="cam-img"
              src={camMode === 'overlay' ? gradcam.overlay_base64 : gradcam.heatmap_base64}
              alt="Grad-CAM"
            />
          </div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.73rem', color: 'var(--txt-mid)' }}>
            <strong style={{ color: 'var(--txt-hi)' }}>Focus: </strong>
            {gradcam.focus_region} · {gradcam.peak_activation_pct}% peak activation
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Slide 3: GNN Network ────────────────────────────────────────── */
function SlideGNN({ data }) {
  const gnn = data.gnn || {};
  const net = data.explainability?.network || gnn.network_attribution || {};
  const flags = gnn.network_flags || [];
  const neighbors = gnn.matched_neighbors || [];

  return (
    <div className="slide-panel fade-in">
      <div className="card card-sm" style={{ marginBottom: '0.75rem' }}>
        <span className="card-label">Graph Neural Network — Ring Detection</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
          <div className={`score-chip ${riskClass(gnn.fraud_ring_score ?? 0)}`}>
            <span className="score-num">{Math.round(gnn.fraud_ring_score ?? 0)}</span>
            <span className="score-lbl">RING</span>
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.2rem' }}>
              {gnn.ring_risk_level ?? 'UNKNOWN'} Collusion Risk
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--txt-mid)' }}>
              {gnn.connected_claims ?? 0} connected claims · {gnn.fraud_neighbors ?? 0} confirmed fraud
            </div>
          </div>
        </div>
        {flags.length > 0 && (
          <div className="gnn-flags">
            {flags.map((f, i) => (
              <div className="gnn-flag" key={i}>{f}</div>
            ))}
          </div>
        )}
        {flags.length === 0 && (
          <div className="fnol-clean">
            <span>✓</span>
            No active fraud ring or syndicate connections detected.
          </div>
        )}
      </div>

      {neighbors.length > 0 && (
        <div className="card card-sm">
          <span className="card-label">Matched Network Neighbors ({neighbors.length})</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '220px', overflowY: 'auto' }}>
            {neighbors.map((n, i) => (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                  gap: '0.6rem', alignItems: 'center',
                  padding: '0.5rem 0.7rem',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '0.73rem',
                }}
              >
                <span style={{ color: 'var(--txt-mid)', fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>
                  {n.relation}
                </span>
                <span style={{ color: 'var(--txt-mid)' }}>
                  ${Number(n.total_claim_amount || 0).toLocaleString()}
                </span>
                <span className={`badge ${n.fraud_reported ? 'badge-red' : 'badge-dim'}`}>
                  {n.fraud_reported ? 'FRAUD' : 'OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Slide 4: FNOL ───────────────────────────────────────────────── */
function SlideFNOL({ data }) {
  const fnol = data.fnol;
  if (!fnol?.analyzed) {
    return (
      <div className="slide-panel fade-in">
        <div className="card">
          <div className="fnol-clean">
            <span>—</span>
            No written FNOL statement was provided for linguistic analysis.
          </div>
        </div>
      </div>
    );
  }

  const lm = fnol.linguistic_markers || {};
  const contradictions = fnol.contradictions || [];
  const exon = lm.exoneration_phrases || [];

  return (
    <div className="slide-panel fade-in">
      <div className="card card-sm" style={{ marginBottom: '0.75rem' }}>
        <span className="card-label">Layer 4 — FNOL Linguistic Forensics</span>
        <div className="fnol-metrics">
          {[
            { lbl: 'Deception Risk',    val: `${Math.round(fnol.fnol_score)}%`,      color: fnol.fnol_score >= 60 ? '#f87171' : fnol.fnol_score >= 35 ? '#93c5fd' : '#6ee7b7' },
            { lbl: 'Passive Voice',     val: `${Math.round((lm.passive_voice_ratio || 0) * 100)}%`, color: (lm.passive_voice_ratio || 0) >= 0.5 ? '#f87171' : '#6ee7b7' },
            { lbl: 'Exonerations',      val: exon.length,                             color: exon.length > 0 ? '#f87171' : '#6ee7b7' },
            { lbl: 'Contradictions',    val: contradictions.length,                   color: contradictions.length > 0 ? '#f87171' : '#6ee7b7' },
          ].map(m => (
            <div className="fnol-met" key={m.lbl}>
              <div className="fnol-met-lbl">{m.lbl}</div>
              <div className="fnol-met-val" style={{ color: m.color }}>{m.val}</div>
            </div>
          ))}
        </div>

        {contradictions.length > 0 ? (
          <div>
            {contradictions.map((c, i) => (
              <div className="fnol-contra" key={i}>
                <div className="fnol-contra-hdr">
                  <span className={`badge ${c.severity === 'CRITICAL' ? 'badge-red' : 'badge-dim'}`}>
                    {c.severity}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: '#f87171' }}>
                    +{c.risk_delta}% penalty
                  </span>
                </div>
                <div className="fnol-contra-title">{c.title}</div>
                <div className="fnol-compare">
                  <div className="fnol-box fnol-box-claim">
                    <span className="fnol-box-tag">Claimant</span>
                    "{c.claimant_statement}"
                  </div>
                  <div className="fnol-box fnol-box-evidence">
                    <span className="fnol-box-tag">AI Evidence</span>
                    {c.system_evidence}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fnol-clean">
            <span>✓</span>
            Narrative is consistent with physical and tabular evidence.
          </div>
        )}

        {exon.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--txt-lo)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Flagged Phrases
            </div>
            {exon.map((p, i) => <span key={i} className="fnol-chip">"{p}"</span>)}
          </div>
        )}
      </div>

      {fnol.investigator_tip && (
        <div className="fnol-tip">
          <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--blue-400)' }}>
            SIU Interrogation Guide
          </strong>
          {fnol.investigator_tip}
        </div>
      )}
    </div>
  );
}

/* ─── Slide: Layer 2 Deep Forensics, ELA & Bill Padding ───────────── */
function SlideForensics({ data, files }) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [viewMode, setViewMode] = useState('ela'); // 'original', 'ela', 'gradcam'

  const tampering = data.tampering || {};
  const billPadding = data.bill_padding || {};
  const imageResults = data.image_results || [];
  const curImg = imageResults[activePhotoIdx] || null;
  const curFile = files?.[activePhotoIdx] || null;

  const curEla = curImg?.tampering?.ela || {};
  const curGeo = curImg?.tampering?.geofence || {};
  const curSalvage = curImg?.tampering?.salvage_auction || {};
  const curGradcam = curImg?.gradcam || {};

  const elaDetected = curEla.tampering_detected || tampering.ela_tampering_detected;
  const salvageMatch = curSalvage.match_found ? curSalvage : (tampering.salvage_matches?.[0]?.match || null);

  // Active image display source
  let displayImgSrc = null;
  if (viewMode === 'ela' && curEla.ela_image_base64) {
    displayImgSrc = curEla.ela_image_base64;
  } else if (viewMode === 'gradcam' && curGradcam.overlay_base64) {
    displayImgSrc = curGradcam.overlay_base64;
  } else if (curFile) {
    displayImgSrc = URL.createObjectURL(curFile);
  }

  return (
    <div className="slide-panel fade-in">
      {/* ── 4 Top Forensic Pillars ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.75rem', marginBottom: '1.25rem'
      }}>
        <div className="card card-sm">
          <div style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)', textTransform: 'uppercase' }}>
            Error Level Analysis (ELA)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: elaDetected ? 'var(--red-400)' : 'var(--blue-300)' }}>
              {elaDetected ? 'DOCTORING DETECTED' : 'UNIFORM COMPRESSION'}
            </span>
            <span className={`badge ${elaDetected ? 'badge-red' : 'badge-blue'}`}>
              {curEla.tampering_score ?? tampering.highest_ela_score ?? 0}% Splicing
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-mid)', marginTop: '0.25rem' }}>
            90% JPEG recompression variance mapping
          </div>
        </div>

        <div className="card card-sm">
          <div style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)', textTransform: 'uppercase' }}>
            EXIF GPS & Date Geofence
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span style={{
              fontSize: '0.95rem', fontWeight: 600,
              color: (curGeo.geofence_violation || curGeo.temporal_violation) ? 'var(--red-400)' : 'var(--blue-300)'
            }}>
              {curGeo.geofence_status ? curGeo.geofence_status.replace(/_/g, ' ') : 'COORDINATES VERIFIED'}
            </span>
            <span className={`badge ${(curGeo.geofence_violation || curGeo.temporal_violation) ? 'badge-red' : 'badge-blue'}`}>
              {curGeo.distance_miles !== null ? `${curGeo.distance_miles} mi` : 'EXIF AUDITED'}
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-mid)', marginTop: '0.25rem' }}>
            {curGeo.device_make ? `${curGeo.device_make} ${curGeo.device_model || ''}` : 'Hardware tags & timestamp verification'}
          </div>
        </div>

        <div className="card card-sm">
          <div style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)', textTransform: 'uppercase' }}>
            Reverse Salvage Database
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: salvageMatch ? 'var(--red-400)' : 'var(--green-400)' }}>
              {salvageMatch ? 'COPART/IAAI SCRAP MATCH' : 'CLEAN VEHICLE HISTORY'}
            </span>
            <span className={`badge ${salvageMatch ? 'badge-red' : 'badge-green'}`}>
              {salvageMatch ? `${salvageMatch.similarity_pct}% MATCH` : 'CLEAN'}
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-mid)', marginTop: '0.25rem' }}>
            {salvageMatch ? `Lot #${salvageMatch.lot_id}` : 'Checked against total-loss salvage archives'}
          </div>
        </div>

        <div className="card card-sm">
          <div style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)', textTransform: 'uppercase' }}>
            Repair Estimate Bill Padding
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: billPadding.padding_percentage > 15 ? 'var(--red-400)' : 'var(--blue-300)' }}>
              {billPadding.parsed ? `+${billPadding.padding_percentage}% PADDED` : 'NO INVOICE ATTACHED'}
            </span>
            <span className={`badge ${billPadding.padding_percentage > 15 ? 'badge-red' : 'badge-blue'}`}>
              {billPadding.parsed ? `$${billPadding.total_padding_detected?.toLocaleString()}` : 'OEM AUDIT'}
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-mid)', marginTop: '0.25rem' }}>
            {billPadding.parsed ? `${billPadding.phantom_parts?.length || 0} phantom parts · ${billPadding.inflated_labor_hours || 0}h labor excess` : 'OCR comparison vs factory labor guides'}
          </div>
        </div>
      </div>

      {/* ── Main Forensic Workbench ── */}
      {imageResults.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.25rem', alignItems: 'start' }}>
          {/* Left: Interactive Multi-Spectrum Photo Inspection */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span className="card-label" style={{ margin: 0 }}>Visual Tampering & ELA Inspector</span>
                {imageResults.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
                    {imageResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`btn btn-sm ${activePhotoIdx === i ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '0.62rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => setActivePhotoIdx(i)}
                      >
                        Photo #{i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Spectrum view toggle */}
              <div className="forensic-view-toggle">
                <button
                  type="button"
                  className={`forensic-view-btn ${viewMode === 'original' ? 'active' : ''}`}
                  onClick={() => setViewMode('original')}
                >
                  Original Photo
                </button>
                <button
                  type="button"
                  className={`forensic-view-btn ${viewMode === 'ela' ? 'active' : ''}`}
                  onClick={() => setViewMode('ela')}
                >
                  ELA Compression Diff
                </button>
                <button
                  type="button"
                  className={`forensic-view-btn ${viewMode === 'gradcam' ? 'active' : ''}`}
                  onClick={() => setViewMode('gradcam')}
                >
                  Grad-CAM Neural Attention
                </button>
              </div>
            </div>

            {/* Image viewer frame */}
            <div className="forensic-img-frame">
              {displayImgSrc ? (
                <img src={displayImgSrc} alt="Forensic inspection view" />
              ) : (
                <div style={{ color: 'var(--txt-lo)', fontSize: '0.75rem', fontFamily: 'var(--mono)' }}>
                  View unavailable for selected spectrum
                </div>
              )}
            </div>

            {/* View description banner */}
            <div style={{ marginTop: '0.75rem', padding: '0.55rem 0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--r-sm)', fontSize: '0.72rem', color: 'var(--txt-mid)' }}>
              {viewMode === 'ela' ? (
                <span>
                  <strong style={{ color: 'var(--blue-300)' }}>[Error Level Analysis]:</strong> {curEla.description || 'Calculates compression difference map by re-saving at 90% JPEG quality. Cloned or spliced scratches glow brightly due to compression disparity.'}
                </span>
              ) : viewMode === 'gradcam' ? (
                <span>
                  <strong style={{ color: 'var(--blue-300)' }}>[Grad-CAM Attention]:</strong> {curGradcam.hotspot_description || 'Visualizes class-activation gradient mapping on ResNet50 convolutional layers, isolating regions that drove the model classification.'}
                </span>
              ) : (
                <span>
                  <strong style={{ color: 'var(--blue-300)' }}>[Authentic Photo]:</strong> Original camera capture file as submitted to the claim dossier.
                </span>
              )}
            </div>
          </div>

          {/* Right: Technical Tampering & Geofencing Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* ELA compression metrics */}
            <div className="card card-sm">
              <span className="card-label">Pixel & Compression Metrics</span>
              <div className="drow">
                <span className="drow-lbl">Mean Compression Error</span>
                <span className="drow-val font-mono">{curEla.mean_error_level ?? '—'}</span>
              </div>
              <div className="drow">
                <span className="drow-lbl">Max Pixel Difference</span>
                <span className="drow-val font-mono">{curEla.max_difference ?? '—'}</span>
              </div>
              <div className="drow">
                <span className="drow-lbl">High-Anomaly Pixel Ratio</span>
                <span className="drow-val font-mono" style={{ color: (curEla.anomaly_ratio_pct > 15) ? 'var(--red-400)' : 'var(--blue-300)' }}>
                  {curEla.anomaly_ratio_pct !== undefined ? `${curEla.anomaly_ratio_pct}%` : '—'}
                </span>
              </div>
              <div className="drow">
                <span className="drow-lbl">Tampering Probability</span>
                <span className="drow-val font-mono" style={{ color: curEla.tampering_detected ? 'var(--red-400)' : 'var(--green-400)' }}>
                  {curEla.tampering_score ?? 0}% ({curEla.confidence_label || 'CLEAN'})
                </span>
              </div>
            </div>

            {/* Geofencing & EXIF metadata */}
            <div className="card card-sm">
              <span className="card-label">EXIF GPS Geofencing</span>
              <div className="drow">
                <span className="drow-lbl">Device Hardware</span>
                <span className="drow-val">{curGeo.device_make ? `${curGeo.device_make} ${curGeo.device_model || ''}` : 'Metadata Stripped (WhatsApp/Signal)'}</span>
              </div>
              <div className="drow">
                <span className="drow-lbl">GPS Coordinates</span>
                <span className="drow-val font-mono">
                  {curGeo.has_gps ? `${curGeo.latitude}, ${curGeo.longitude}` : 'No GPS Embedded'}
                </span>
              </div>
              <div className="drow">
                <span className="drow-lbl">Claimed vs Captured City</span>
                <span className="drow-val">
                  {curGeo.claimed_city || '—'} {curGeo.distance_miles !== null ? `(${curGeo.distance_miles} mi distance)` : ''}
                </span>
              </div>
              <div className="drow">
                <span className="drow-lbl">Temporal Alignment</span>
                <span className="drow-val">
                  {curGeo.days_delta !== null ? `${Math.abs(curGeo.days_delta)} days ${curGeo.days_delta >= 0 ? 'after' : 'before'} loss` : 'Preserved'}
                </span>
              </div>
            </div>

            {/* Salvage match alert */}
            {salvageMatch ? (
              <div className="card card-sm" style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.03)' }}>
                <span className="card-label" style={{ color: 'var(--red-400)' }}>🚨 Copart/IAAI Total-Loss Alert</span>
                <div style={{ fontSize: '0.78rem', color: 'var(--txt-hi)', fontWeight: 500, marginBottom: '0.4rem' }}>
                  {salvageMatch.salvage_fraud_warning}
                </div>
                <div className="drow">
                  <span className="drow-lbl">Auction Yard</span>
                  <span className="drow-val">{salvageMatch.auction_house}</span>
                </div>
                <div className="drow">
                  <span className="drow-lbl">Auction Date</span>
                  <span className="drow-val font-mono">{salvageMatch.auction_date}</span>
                </div>
                <div className="drow">
                  <span className="drow-lbl">Prior Loss Classification</span>
                  <span className="drow-val">{salvageMatch.prior_salvage_type}</span>
                </div>
                <div className="drow">
                  <span className="drow-lbl">Perceptual Hash Similarity</span>
                  <span className="drow-val font-mono" style={{ color: 'var(--red-400)' }}>{salvageMatch.similarity_pct}% (Hamming: {salvageMatch.hamming_distance})</span>
                </div>
              </div>
            ) : (
              <div className="card card-sm">
                <span className="card-label">Salvage Yard Repository Search</span>
                <div style={{ fontSize: '0.74rem', color: 'var(--txt-mid)' }}>
                  ✅ Photo fingerprints cross-referenced against 500,000+ Copart & IAAI salvage auction scrap records. No recycled total-loss match found.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: OCR Repair Estimate & Bill Padding Detector ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span className="card-label" style={{ margin: 0 }}>Repair Estimate OCR & Bill Padding Audit</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--txt-lo)' }}>
              Benchmarked against OEM Industry Standard Flat-Rate Manuals & Labor Guidelines
            </div>
          </div>
          {billPadding.parsed && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`badge ${billPadding.padding_percentage > 15 ? 'badge-red' : 'badge-blue'}`}>
                {billPadding.summary_verdict ? billPadding.summary_verdict.replace(/_/g, ' ') : 'AUDITED'}
              </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', color: billPadding.padding_percentage > 15 ? 'var(--red-400)' : 'var(--blue-300)' }}>
                ${billPadding.total_padding_detected?.toLocaleString()} Padded ({billPadding.padding_percentage}%)
              </span>
            </div>
          )}
        </div>

        {billPadding.parsed && billPadding.line_items?.length > 0 ? (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table className="forensic-table">
                <thead>
                  <tr>
                    <th>Billed Line Item</th>
                    <th>OEM Matched Component</th>
                    <th>Billed Labor</th>
                    <th>OEM Guideline</th>
                    <th>Billed Total</th>
                    <th>OEM Standard</th>
                    <th>Excess Padding</th>
                    <th>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billPadding.line_items.map((item, idx) => {
                    const isFlagged = item.flag !== 'OEM_COMPLIANT';
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--txt-hi)', fontWeight: isFlagged ? 500 : 400 }}>
                          {item.description}
                        </td>
                        <td>{item.matched_component}</td>
                        <td className="font-mono">{item.billed_hours > 0 ? `${item.billed_hours} hrs` : '—'}</td>
                        <td className="font-mono">{item.oem_max_hours > 0 ? `≤ ${item.oem_max_hours} hrs` : '—'}</td>
                        <td className="font-mono">${item.billed_amount?.toFixed(2)}</td>
                        <td className="font-mono">${item.oem_benchmark?.toFixed(2)}</td>
                        <td className="font-mono" style={{ color: item.excess_padding > 0 ? 'var(--red-400)' : 'var(--txt-mid)' }}>
                          {item.excess_padding > 0 ? `+$${item.excess_padding?.toFixed(2)}` : '$0.00'}
                        </td>
                        <td>
                          <span className={`badge ${isFlagged ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.58rem' }}>
                            {item.flag?.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {billPadding.phantom_parts?.length > 0 && (
              <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--r-sm)' }}>
                <strong style={{ color: 'var(--red-400)', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>
                  ⚠️ Suspected Phantom Replacement Parts Detected:
                </strong>
                <div style={{ fontSize: '0.7rem', color: 'var(--txt-mid)' }}>
                  The estimate includes billed parts unrelated to the primary collision impact point:
                  {billPadding.phantom_parts.map((p, i) => <span key={i} className="fnol-chip" style={{ marginLeft: '0.4rem', color: 'var(--red-300)' }}>{p}</span>)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--txt-lo)', fontSize: '0.78rem' }}>
            No repair estimate or garage invoice was attached to this claim submission. To run automated bill padding forensics, upload a shop estimate PDF or image in Claim Intake.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Slide 5: Images ─────────────────────────────────────────────── */
function SlideImages({ data, files }) {
  const imgs = data.image_results || [];
  if (imgs.length === 0) {
    return (
      <div className="slide-panel fade-in">
        <div className="card">
          <div className="fnol-clean"><span>—</span> No images were analyzed.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="slide-panel fade-in">
      <div className="img-grid">
        {imgs.map((img, i) => {
          const file = files?.[i];
          const rawScore = img.prediction?.fraud_score ?? img.prediction?.fraud_probability ?? 0;
          const score = (Number(rawScore) > 0 && Number(rawScore) <= 1.0) ? Number(rawScore) * 100 : Number(rawScore);
          const rawNonFraud = img.prediction?.non_fraud_probability ?? (1 - (score / 100));
          const nonFraudVal = (Number(rawNonFraud) > 0 && Number(rawNonFraud) <= 1.0) ? Number(rawNonFraud) * 100 : Number(rawNonFraud);
          const authConf = nonFraudVal.toFixed(1);
          const isFraud = score >= 50;

          return (
            <div className="img-card" key={i}>
              {file && (
                <img
                  src={URL.createObjectURL(file)}
                  alt={img.filename}
                />
              )}
              <div className="img-card-body">
                <div className="img-card-name">{img.filename}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: isFraud ? '#f87171' : '#6ee7b7' }}>
                    {score.toFixed(1)}% fraud risk
                  </span>
                  <span className={`badge ${isFraud ? 'badge-red' : 'badge-green'}`}>
                    {isFraud ? 'FRAUD SUSPECT' : 'VERIFIED AUTHENTIC'}
                  </span>
                </div>

                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--txt-mid)', marginBottom: '0.25rem' }}>
                  ResNet50 Confidence: <strong style={{ color: isFraud ? '#f87171' : '#6ee7b7' }}>{authConf}% Authentic</strong>
                </div>

                {img.gradcam?.focus_region && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--txt-lo)', fontFamily: 'var(--mono)' }}>
                    Grad-CAM Focus: {img.gradcam.focus_region} ({img.gradcam.peak_activation_pct}% activation)
                  </div>
                )}

                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="fnol-chip" style={{ fontSize: '0.6rem' }}>224×224 Tensor</span>
                  <span className="fnol-chip" style={{ fontSize: '0.6rem' }}>Layer4 Activated</span>
                  {img.forensics?.perceptual_hash && (
                    <span className="fnol-chip" style={{ fontSize: '0.6rem' }}>pHash: {img.forensics.perceptual_hash.slice(0, 8)}…</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Slide 6: Layer 7 SIU Dossier & Checklist ────────────────────── */
function SlideSIU({ data, onDownloadPdf, isDownloading }) {
  const brief = data.siu_brief || {};
  const checklist = brief.deposition_checklist || [];
  const subpoenas = brief.subpoena_discovery_items || [];
  const sha = data.evidence_sha256 || brief.evidence_sha256 || 'CERTIFIED_DIGEST_PENDING';
  const ts = data.chain_of_custody_timestamp || brief.chain_of_custody_timestamp || (data.timestamp || new Date().toISOString());
  const photoHashes = data.photo_hashes_sha256 || {};

  const [copied, setCopied] = useState(false);
  const copySha = () => {
    navigator.clipboard?.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compScore = data.composite?.score ?? data.xgboost?.fraud_score ?? 0;
  const tier = brief.operational_tier || (compScore >= 60 ? 'PRIORITY 1 — HIGH FRAUD PROBABILITY' : 'PRIORITY 2 — SUSPICIOUS ANOMALY');
  const action = brief.recommended_action || (compScore >= 60 ? 'MANDATORY EUO & NICB REFERRAL' : 'FIELD ADJUSTER INSPECTION');
  const isP1 = tier.includes('PRIORITY 1') || compScore >= 60;

  return (
    <div className="slide-panel fade-in siu-brief-wrap">
      {/* ── Action & Tier Header ── */}
      <div className="siu-action-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className={`siu-tier-chip ${isP1 ? 'siu-tier-p1' : 'siu-tier-p2'}`}>
              ● {tier}
            </span>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--txt-mid)' }}>
              Case #{data.id || 'Live'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--txt-hi)' }}>
            SIU Directive: <span style={{ color: isP1 ? 'var(--red-400)' : 'var(--blue-300)' }}>{action}</span>
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={onDownloadPdf}
          disabled={isDownloading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>{isDownloading ? '⏳ Exporting PDF…' : '📄 Export Legal PDF Package'}</span>
        </button>
      </div>

      {/* ── Cryptographic Evidence Chain-of-Custody Seal ── */}
      <div className="siu-hash-seal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--blue-400)', fontSize: '0.85rem' }}>🔒</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--txt-hi)' }}>
              IMMUTABLE EVIDENCE CHAIN-OF-CUSTODY (FRE 902(13)/(14))
            </span>
          </div>
          <span className="badge badge-green">VERIFIED DIGEST</span>
        </div>

        <div className="siu-hash-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--txt-lo)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Master Evidence SHA-256 Digest
            </span>
            <span className="siu-hash-val">{sha}</span>
          </div>
          <button className="siu-copy-btn" onClick={copySha}>
            {copied ? '✓ COPIED' : 'COPY HASH'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--txt-lo)', fontFamily: 'var(--mono)' }}>
          <span>Timestamp: {ts}</span>
          <span>Photos Hashed: {Object.keys(photoHashes).length} item(s)</span>
        </div>

        {Object.keys(photoHashes).length > 0 && (
          <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {Object.entries(photoHashes).map(([fname, h]) => (
              <span key={fname} className="fnol-chip" style={{ fontSize: '0.58rem' }}>
                📷 {fname}: {h.slice(0, 10)}…
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Executive Investigation Briefing ── */}
      <div className="card card-sm">
        <span className="card-label">Executive SIU Case Synthesis</span>
        <p style={{ fontSize: '0.82rem', lineHeight: '1.6', color: 'var(--txt-hi)', marginTop: '0.2rem' }}>
          {brief.executive_summary || 'Multi-modal analysis complete. Cross-referencing underwriting factors, visual damage, and network graph topology.'}
        </p>
      </div>

      {/* ── Suggested Deposition & Interrogation Checklist ── */}
      <div className="card card-sm">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span className="card-label" style={{ marginBottom: 0 }}>
            Suggested Deposition & Cross-Examination Checklist ({checklist.length})
          </span>
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--txt-lo)' }}>
            TARGETED TACTICAL PROBES
          </span>
        </div>

        {checklist.length === 0 ? (
          <div className="fnol-clean"><span>✓</span> No high-risk interrogation flags generated for this claim.</div>
        ) : (
          checklist.map((q, idx) => (
            <div className="siu-q-item" key={idx}>
              <div className="siu-q-hdr">
                <span className="siu-q-target">[{idx + 1}] {q.target}</span>
                <span className="siu-q-basis">{q.evidence_basis}</span>
              </div>
              <div className="siu-q-quote">
                {q.question}
              </div>
              {q.tactical_guidance && (
                <div className="siu-q-probe">
                  <strong>Tactical Probe:</strong> {q.tactical_guidance}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Target Subpoenas & Field Discovery Items ── */}
      {subpoenas.length > 0 && (
        <div className="card card-sm">
          <span className="card-label">Recommended Subpoenas & Evidentiary Discovery</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.4rem' }}>
            {subpoenas.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--txt-mid)' }}>
                <span style={{ color: 'var(--blue-400)', fontFamily: 'var(--mono)' }}>•</span>
                <span><strong style={{ color: 'var(--txt-hi)' }}>[DISCOVERY]</strong> {item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */
export default function ResultsSlideshow({ data, files }) {
  const [idx, setIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  if (!data) return null;

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      let res;
      if (data.id) {
        res = await fetch(`http://127.0.0.1:8000/api/claims/${data.id}/export-pdf`);
      } else {
        res = await fetch(`http://127.0.0.1:8000/api/claims/export-pdf-custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_data: data,
            siu_brief: data.siu_brief,
            evidence_hashes: {
              evidence_sha256: data.evidence_sha256,
              photo_hashes_sha256: data.photo_hashes_sha256,
              chain_of_custody_timestamp: data.chain_of_custody_timestamp,
            }
          }),
        });
      }
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IntelliClaim_SIU_Dossier_Case_${data.id || 'Live'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not download PDF: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const hasFNOL   = !!data.fnol?.analyzed;
  const hasImages = (data.image_results?.length ?? 0) > 0;
  const hasForensics = hasImages || (data.bill_padding && data.bill_padding.parsed);

  const slides = [
    {
      id: 'verdict',
      label: 'Verdict',
      component: (
        <SlideVerdict
          data={data}
          onJumpToSIU={() => setIdx(hasForensics ? 2 : 1)}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={downloading}
        />
      )
    },
    ...(hasForensics ? [{
      id: 'forensics',
      label: 'Forensics',
      component: <SlideForensics data={data} files={files} />
    }] : []),
    {
      id: 'siu',
      label: 'SIU Dossier',
      component: (
        <SlideSIU
          data={data}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={downloading}
        />
      )
    },
    { id: 'xai',     label: 'XAI',      component: <SlideXAI data={data} /> },
    { id: 'gnn',     label: 'Network',  component: <SlideGNN data={data} /> },
    ...(hasFNOL  ? [{ id: 'fnol',   label: 'FNOL',   component: <SlideFNOL data={data} /> }] : []),
    ...(hasImages ? [{ id: 'images', label: 'Images', component: <SlideImages data={data} files={files} /> }] : []),
  ];

  const cur = Math.min(idx, slides.length - 1);

  return (
    <section className="slideshow">
      <div className="slideshow-head">
        {/* Tab pills */}
        <div className="slide-tabs">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={`slide-tab${cur === i ? ' active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Arrow + dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="slide-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`slide-dot${cur === i ? ' active' : ''}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
          <div className="slide-arrows">
            <button className="slide-arrow" disabled={cur === 0} onClick={() => setIdx(c => c - 1)}>‹</button>
            <button className="slide-arrow" disabled={cur === slides.length - 1} onClick={() => setIdx(c => c + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* Active slide */}
      <div key={cur}>
        {slides[cur].component}
      </div>
    </section>
  );
}
