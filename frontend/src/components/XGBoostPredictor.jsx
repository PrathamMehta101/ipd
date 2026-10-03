import React, { useState } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const INCIDENT_SEVERITIES = ['Major Damage', 'Minor Damage', 'Total Loss', 'Trivial Damage'];
const INCIDENT_TYPES = ['Multi-vehicle Collision', 'Parked Car', 'Single Vehicle Collision', 'Vehicle Theft'];
const HOBBIES = [
  'base-jumping', 'basketball', 'board-games', 'bungie-jumping', 'camping',
  'chess', 'cross-fit', 'dancing', 'exercise', 'golf', 'hiking', 'kayaking',
  'movies', 'paintball', 'polo', 'reading', 'skydiving', 'sleeping', 'video-games', 'yachting'
];

const RISK_STYLES = {
  LOW:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✅', label: 'Low Risk' },
  MEDIUM:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⚠️', label: 'Medium Risk' },
  HIGH:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '🔴', label: 'High Risk' },
  CRITICAL: { color: '#dc2626', bg: 'rgba(220,38,38,0.18)',   icon: '🚨', label: 'Critical Fraud Ring' },
};

const PRESETS = [
  {
    name: 'Ring A (Garage G-001)',
    desc: 'Columbus collision ring routed to G-001',
    data: {
      incident_severity:    'Major Damage',
      incident_type:        'Multi-vehicle Collision',
      total_claim_amount:   '84200',
      vehicle_claim:        '64100',
      policy_annual_premium:'1380.00',
      umbrella_limit:       '0',
      insured_hobbies:      'skydiving',
      incident_city:        'Columbus',
      incident_date:        '2015-02-14',
      policy_state:         'OH',
      garage_id:            'G-001',
      claimant_id:          'CLM-A1',
    }
  },
  {
    name: 'Ring B (Garage G-002)',
    desc: 'Arlington total loss ring routed to G-002',
    data: {
      incident_severity:    'Total Loss',
      incident_type:        'Multi-vehicle Collision',
      total_claim_amount:   '98500',
      vehicle_claim:        '78900',
      policy_annual_premium:'1720.00',
      umbrella_limit:       '6000000',
      insured_hobbies:      'base-jumping',
      incident_city:        'Arlington',
      incident_date:        '2015-02-18',
      policy_state:         'IL',
      garage_id:            'G-002',
      claimant_id:          'CLM-B1',
    }
  },
  {
    name: 'Serial Claimant (CLM-C1)',
    desc: 'Staged claim in Northbend',
    data: {
      incident_severity:    'Major Damage',
      incident_type:        'Single Vehicle Collision',
      total_claim_amount:   '91000',
      vehicle_claim:        '72000',
      policy_annual_premium:'1650.00',
      umbrella_limit:       '5000000',
      insured_hobbies:      'polo',
      incident_city:        'Northbend',
      incident_date:        '2015-03-02',
      policy_state:         'NY',
      garage_id:            'G-005',
      claimant_id:          'CLM-C1',
    }
  },
  {
    name: 'Legit Claim (Clean)',
    desc: 'Low severity parking incident',
    data: {
      incident_severity:    'Minor Damage',
      incident_type:        'Parked Car',
      total_claim_amount:   '6200',
      vehicle_claim:        '4100',
      policy_annual_premium:'1120.00',
      umbrella_limit:       '0',
      insured_hobbies:      'reading',
      incident_city:        'Columbus',
      incident_date:        '2015-03-10',
      policy_state:         'OH',
      garage_id:            'G-099',
      claimant_id:          'CLM-Z9',
    }
  }
];

export default function XGBoostPredictor({ onPredict, cnnScore }) {
  const [form, setForm] = useState({
    incident_severity:    'Major Damage',
    total_claim_amount:   '',
    insured_hobbies:      'chess',
    vehicle_claim:        '',
    incident_type:        'Multi-vehicle Collision',
    umbrella_limit:       '0',
    policy_annual_premium:'',
    incident_city:        '',
    incident_date:        '',
    policy_state:         '',
    garage_id:            '',
    claimant_id:          '',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyPreset = (preset) => {
    setForm(preset.data);
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const payload = {
        incident_severity:    form.incident_severity,
        total_claim_amount:   parseFloat(form.total_claim_amount) || 0,
        insured_hobbies:      form.insured_hobbies,
        vehicle_claim:        parseFloat(form.vehicle_claim) || 0,
        incident_type:        form.incident_type,
        umbrella_limit:       parseFloat(form.umbrella_limit) || 0,
        policy_annual_premium:parseFloat(form.policy_annual_premium) || 0,
        incident_city:        form.incident_city || null,
        incident_date:        form.incident_date || null,
        policy_state:         form.policy_state  || null,
        garage_id:            form.garage_id     || null,
        claimant_id:          form.claimant_id   || null,
        cnn_fraud_score:      cnnScore !== null && cnnScore !== undefined ? parseFloat(cnnScore) : null,
      };

      const res = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (onPredict) onPredict(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const riskKey = result?.composite?.risk_level ?? result?.risk_level ?? 'MEDIUM';
  const riskStyle = result ? (RISK_STYLES[riskKey] ?? RISK_STYLES.MEDIUM) : null;
  const compScore = result?.composite?.score ?? result?.fraud_score ?? 0;
  const xgbScore  = result?.xgboost?.fraud_score ?? result?.fraud_score ?? 0;
  const gnnScore  = result?.gnn?.fraud_ring_score ?? 0;

  return (
    <section className="xgb-section">
      <div className="xgb-header">
        <span className="xgb-badge">XGBoost ML + GNN Ring Detection</span>
        <h2 className="xgb-title">Tabular &amp; Graph Fraud Intelligence</h2>
        <p className="xgb-subtitle">
          Submit claim details to run real-time inference through both <strong>XGBoost Anomaly Scoring</strong> and{' '}
          <strong>GNN Fraud Ring Message Passing</strong>. Results are automatically combined into the dossier below.
        </p>
      </div>

      {/* ── Preset Test Bar ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.6rem',
        marginBottom: '1.2rem',
        padding: '0.8rem 1rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 'var(--radius-md)',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          ⚡ QUICK TEST PRESETS:
        </span>
        {PRESETS.map(p => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '99px',
              color: '#c7d2fe',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={p.desc}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="xgb-layout">
        {/* FORM PANEL */}
        <form className="xgb-form" onSubmit={handleSubmit} id="xgb-predict-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="incident_severity">Incident Severity</label>
              <select id="incident_severity" name="incident_severity" value={form.incident_severity} onChange={handleChange}>
                {INCIDENT_SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="incident_type">Incident Type</label>
              <select id="incident_type" name="incident_type" value={form.incident_type} onChange={handleChange}>
                {INCIDENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="total_claim_amount">Total Claim Amount ($)</label>
              <input
                type="number" id="total_claim_amount" name="total_claim_amount"
                placeholder="e.g. 71610" value={form.total_claim_amount}
                onChange={handleChange} min="0" required
              />
            </div>
            <div className="form-group">
              <label htmlFor="vehicle_claim">Vehicle Claim Amount ($)</label>
              <input
                type="number" id="vehicle_claim" name="vehicle_claim"
                placeholder="e.g. 52080" value={form.vehicle_claim}
                onChange={handleChange} min="0" required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="policy_annual_premium">Annual Premium ($)</label>
              <input
                type="number" id="policy_annual_premium" name="policy_annual_premium"
                placeholder="e.g. 1406.91" value={form.policy_annual_premium}
                onChange={handleChange} min="0" step="0.01" required
              />
            </div>
            <div className="form-group">
              <label htmlFor="umbrella_limit">Umbrella Limit ($)</label>
              <input
                type="number" id="umbrella_limit" name="umbrella_limit"
                placeholder="e.g. 0 or 5000000" value={form.umbrella_limit}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row form-row--single">
            <div className="form-group">
              <label htmlFor="insured_hobbies">Insured Person&apos;s Hobbies</label>
              <select id="insured_hobbies" name="insured_hobbies" value={form.insured_hobbies} onChange={handleChange}>
                {HOBBIES.map(h => <option key={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* ── Network & Entity Identifiers ── */}
          <div className="form-section-label">
            🕸️ GNN Network Identifiers <span>(analyzed by Graph Neural Network)</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="garage_id">🏪 Garage ID (Repair Shop)</label>
              <input
                type="text" id="garage_id" name="garage_id"
                placeholder="e.g. G-001 or G-002" value={form.garage_id}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="claimant_id">👤 Claimant ID</label>
              <input
                type="text" id="claimant_id" name="claimant_id"
                placeholder="e.g. CLM-A1 or CLM-B1" value={form.claimant_id}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="incident_city">📍 Incident City</label>
              <input
                type="text" id="incident_city" name="incident_city"
                placeholder="e.g. Columbus, Arlington" value={form.incident_city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="incident_date">Incident Date</label>
              <input
                type="date" id="incident_date" name="incident_date"
                value={form.incident_date} onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row form-row--single">
            <div className="form-group">
              <label htmlFor="policy_state">Policy State</label>
              <select id="policy_state" name="policy_state" value={form.policy_state} onChange={handleChange}>
                <option value="">— Select State —</option>
                {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="xgb-submit-btn" disabled={loading} id="xgb-submit-btn">
            {loading ? (
              <span className="xgb-spinner">
                <span className="spinner-ring" /> Running XGBoost + GNN Graph Analysis...
              </span>
            ) : (
              <><span>⚡</span> Analyze Claim (XGBoost + GNN Fraud Ring)</>
            )}
          </button>

          {error && (
            <div className="xgb-error">
              <span>⚠️</span> {error}
            </div>
          )}
        </form>

        {/* ── LIVE PREVIEW RESULT PANEL ── */}
        {result && riskStyle && (
          <div className="xgb-result" style={{ '--risk-color': riskStyle.color, '--risk-bg': riskStyle.bg }}>
            {/* Top Score Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', width: '100%', marginBottom: '0.5rem' }}>
              {/* XGBoost Anomaly */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '0.6rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 700 }}>🧠 XGBOOST TABULAR</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: xgbScore >= 50 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                  {Math.round(xgbScore)}%
                </div>
              </div>

              {/* GNN Fraud Ring */}
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '8px',
                padding: '0.6rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>🕸️ GNN FRAUD RING</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: gnnScore >= 50 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                  {Math.round(gnnScore)}%
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div className="xgb-verdict">
              <div className="verdict-class" style={{ color: riskStyle.color }}>
                {result.composite?.verdict ? `${result.composite.verdict.replace('_', ' ')} • ${Math.round(compScore)}%` : (result.predicted_class === 'Fraud' ? '🚩 Fraudulent' : '✅ Legitimate')}
              </div>
              <div className="verdict-recommendation" style={{ fontSize: '0.82rem' }}>
                {result.composite?.recommendation_label || result.recommendation_label}
              </div>
            </div>

            {/* Ring flags if any */}
            {result.gnn?.network_flags && result.gnn.network_flags.length > 0 && (
              <div style={{
                width: '100%',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '6px',
                padding: '0.5rem 0.7rem',
                fontSize: '0.73rem',
                color: '#fde68a',
                lineHeight: 1.4,
              }}>
                <strong>⚠️ Ring Signal:</strong> {result.gnn.network_flags[0]}
              </div>
            )}

            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.7rem',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.73rem',
              color: '#c7d2fe',
              textAlign: 'center',
              width: '100%',
            }}>
              👇 Full <strong>Unified Tri-Modal Report</strong> generated below!
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
