import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const RISK_META = {
  LOW:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Low',      dot: '🟢' },
  MEDIUM:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Medium',   dot: '🟡' },
  HIGH:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    label: 'High',     dot: '🔴' },
  CRITICAL: { color: '#dc2626', bg: 'rgba(220,38,38,0.18)',    label: 'Critical', dot: '🚨' },
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function RiskPill({ level }) {
  const m = RISK_META[level] || RISK_META.LOW;
  return (
    <span className="risk-pill" style={{ color: m.color, background: m.bg }}>
      {m.dot} {m.label}
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 85 ? '#dc2626' : score >= 65 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#10b981';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
      </div>
      <span className="score-bar-num" style={{ color }}>{score}</span>
    </div>
  );
}

export default function ClaimsHistory() {
  const [claims, setClaims]     = useState([]);
  const [stats, setStats]       = useState(null);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(0);
  const [filterRisk, setFilterRisk] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [expanded, setExpanded] = useState(null);  // expanded row ID

  const LIMIT = 10;

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/claims/stats`);
      if (res.ok) setStats(await res.json());
    } catch (_) {}
  }, []);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip:  page * LIMIT,
        limit: LIMIT,
        ...(filterRisk  ? { risk: filterRisk }             : {}),
        ...(filterClass ? { predicted_class: filterClass } : {}),
      });
      const res = await fetch(`${API_BASE}/api/claims?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims);
        setTotal(data.total);
      }
    } catch (_) {}
    setLoading(false);
  }, [page, filterRisk, filterClass]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/api/claims/${id}`, { method: 'DELETE' });
      setClaims(prev => prev.filter(c => c.id !== id));
      fetchStats();
    } catch (_) {}
    setDeletingId(null);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <section className="history-section">
      {/* Header */}
      <div className="history-header">
        <div>
          <span className="history-badge">SQLite Database</span>
          <h2 className="history-title">Claims Intelligence Store</h2>
          <p className="history-subtitle">Live record of every XGBoost prediction — persisted, filterable, and auditable.</p>
        </div>
        <button className="refresh-btn" onClick={() => { fetchClaims(); fetchStats(); }} id="refresh-claims-btn">
          ↻ Refresh
        </button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="stats-row">
          <StatCard label="Total Claims"     value={stats.total_claims}     color="#60a5fa" />
          <StatCard label="Fraud Detected"   value={stats.fraud_count}      sub={`${stats.fraud_rate}% rate`} color="#ef4444" />
          <StatCard label="Non-Fraud"        value={stats.non_fraud_count}  color="#10b981" />
          <StatCard label="Avg Fraud Score"  value={`${stats.avg_fraud_score}`} sub="out of 100" color="#f59e0b" />
          <StatCard label="Critical / High"  value={`${stats.risk_breakdown.CRITICAL} / ${stats.risk_breakdown.HIGH}`} color="#dc2626" />
        </div>
      )}

      {/* Filters */}
      <div className="history-filters">
        <select
          className="filter-select" id="filter-risk"
          value={filterRisk} onChange={e => { setFilterRisk(e.target.value); setPage(0); }}
        >
          <option value="">All Risk Levels</option>
          <option value="LOW">🟢 Low</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="HIGH">🔴 High</option>
          <option value="CRITICAL">🚨 Critical</option>
        </select>

        <select
          className="filter-select" id="filter-class"
          value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(0); }}
        >
          <option value="">All Predictions</option>
          <option value="Fraud">🚩 Fraud</option>
          <option value="Non-Fraud">✅ Non-Fraud</option>
        </select>

        <span className="filter-count">{total} record{total !== 1 ? 's' : ''} found</span>
      </div>

      {/* Table */}
      <div className="history-table-wrap">
        {loading ? (
          <div className="history-loading">
            <span className="spinner-ring" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <span>Loading claims...</span>
          </div>
        ) : claims.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">🗄️</div>
            <div>No claims in the database yet.</div>
            <div className="history-empty-sub">Run an XGBoost analysis above to add the first entry.</div>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Date</th>
                <th>Incident Type</th>
                <th>Severity</th>
                <th>Claim ($)</th>
                <th>Fraud Score</th>
                <th>Verdict</th>
                <th>Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <React.Fragment key={c.id}>
                  <tr
                    className={`history-row ${expanded === c.id ? 'history-row--expanded' : ''}`}
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="td-id">#{c.id}</td>
                    <td className="td-date">{new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="td-type">{c.incident_type}</td>
                    <td>{c.incident_severity}</td>
                    <td className="td-amount">${c.total_claim_amount.toLocaleString()}</td>
                    <td><ScoreBar score={c.fraud_score} /></td>
                    <td>
                      <span className={`verdict-pill ${c.predicted_class === 'Fraud' ? 'verdict-fraud' : 'verdict-safe'}`}>
                        {c.predicted_class === 'Fraud' ? '🚩 Fraud' : '✅ Safe'}
                      </span>
                    </td>
                    <td><RiskPill level={c.risk_level} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="delete-btn"
                        title="Delete entry"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        id={`delete-claim-${c.id}`}
                      >
                        {deletingId === c.id ? '…' : '🗑'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === c.id && (
                    <tr className="detail-row">
                      <td colSpan={9}>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">Garage ID</span>
                            <span className="detail-val" style={{ color: '#f59e0b' }}>{c.garage_id || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Claimant ID</span>
                            <span className="detail-val" style={{ color: '#06b6d4' }}>{c.claimant_id || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Incident City</span>
                            <span className="detail-val" style={{ color: '#10b981' }}>{c.incident_city || '—'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">GNN Ring Score</span>
                            <span className="detail-val" style={{ color: (c.gnn_fraud_ring_score || 0) >= 50 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                              {Math.round(c.gnn_fraud_ring_score || 0)}%
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Composite Score</span>
                            <span className="detail-val" style={{ color: (c.composite_score || c.fraud_score) >= 50 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                              {Math.round(c.composite_score || c.fraud_score)}%
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Vehicle Claim</span>
                            <span className="detail-val">${c.vehicle_claim.toLocaleString()}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Annual Premium</span>
                            <span className="detail-val">${c.policy_annual_premium.toLocaleString()}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Hobby</span>
                            <span className="detail-val">{c.insured_hobbies}</span>
                          </div>
                          <div className="detail-item detail-item--full">
                            <span className="detail-label">Recommendation</span>
                            <span className="detail-val">{c.recommendation_label}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="page-info">Page {page + 1} of {totalPages}</span>
          <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </section>
  );
}
