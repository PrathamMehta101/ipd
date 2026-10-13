import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

function riskBadge(level) {
  const map = {
    CRITICAL: 'badge-red',
    HIGH:     'badge-red',
    MEDIUM:   'badge-dim',
    LOW:      'badge-green',
  };
  return map[level] || 'badge-dim';
}

function ScoreBar({ score }) {
  const color = score >= 75 ? '#f87171' : score >= 45 ? '#93c5fd' : '#6ee7b7';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color, minWidth: 28, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  );
}

export default function ClaimsHistory() {
  const [claims, setClaims]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(0);
  const [filterRisk, setFilterRisk] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [expanded, setExpanded]     = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const LIMIT = 12;

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
        skip: page * LIMIT, limit: LIMIT,
        ...(filterRisk  ? { risk: filterRisk }             : {}),
        ...(filterClass ? { predicted_class: filterClass } : {}),
      });
      const res = await fetch(`${API_BASE}/api/claims?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims); setTotal(data.total);
      }
    } catch (_) {}
    setLoading(false);
  }, [page, filterRisk, filterClass]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const handleDelete = async id => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/api/claims/${id}`, { method: 'DELETE' });
      setClaims(p => p.filter(c => c.id !== id));
      fetchStats();
    } catch (_) {}
    setDeletingId(null);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Stats row */}
      {stats && (
        <div className="stats">
          {[
            { n: stats.total_claims,     l: 'Total Claims' },
            { n: stats.fraud_count,      l: 'Fraud Detected' },
            { n: stats.non_fraud_count,  l: 'Legitimate' },
            { n: `${stats.avg_fraud_score}`, l: 'Avg Risk Score' },
            { n: `${stats.risk_breakdown?.CRITICAL ?? 0} / ${stats.risk_breakdown?.HIGH ?? 0}`, l: 'Critical / High' },
          ].map(s => (
            <div className="stat" key={s.l}>
              <div className="stat-n">{s.n}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', color: 'var(--txt-hi)', fontFamily: 'var(--sans)', fontSize: '0.8rem', padding: '0.4rem 0.7rem', outline: 'none', appearance: 'none' }}
          value={filterRisk} onChange={e => { setFilterRisk(e.target.value); setPage(0); }}
        >
          <option value="">All Risk Levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', color: 'var(--txt-hi)', fontFamily: 'var(--sans)', fontSize: '0.8rem', padding: '0.4rem 0.7rem', outline: 'none', appearance: 'none' }}
          value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(0); }}
        >
          <option value="">All Verdicts</option>
          <option value="Fraud">Fraud</option>
          <option value="Non-Fraud">Legitimate</option>
        </select>

        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--txt-lo)', marginLeft: 'auto' }}>
          {total} record{total !== 1 ? 's' : ''}
        </span>

        <button className="btn btn-ghost btn-sm" onClick={() => { fetchClaims(); fetchStats(); }}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--txt-lo)', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
            <div style={{ width: 14, height: 14, border: '2px solid rgba(59,130,246,0.15)', borderTopColor: 'var(--blue-500)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            Loading…
          </div>
        ) : claims.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--txt-lo)', fontSize: '0.82rem' }}>
            No claims found. Run an analysis to populate the database.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th><th>Date</th><th>Type</th><th>Severity</th>
                  <th>Claim $</th><th>Fraud Score</th><th>Verdict</th><th>Risk</th><th />
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="tbl-id">#{c.id}</td>
                      <td style={{ color: 'var(--txt-lo)', fontFamily: 'var(--mono)', fontSize: '0.68rem' }}>
                        {new Date(c.created_at).toLocaleDateString('en-IN', { dateStyle: 'short' })}
                      </td>
                      <td>{c.incident_type}</td>
                      <td>{c.incident_severity}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>${(c.total_claim_amount || 0).toLocaleString()}</td>
                      <td style={{ minWidth: 120 }}><ScoreBar score={Math.round(c.fraud_score)} /></td>
                      <td>
                        <span className={`badge ${c.predicted_class === 'Fraud' ? 'badge-red' : 'badge-green'}`}>
                          {c.predicted_class === 'Fraud' ? 'FRAUD' : 'OK'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${riskBadge(c.risk_level)}`}>{c.risk_level}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.2rem 0.5rem', color: 'var(--txt-lo)' }}
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                        >
                          {deletingId === c.id ? '…' : '×'}
                        </button>
                      </td>
                    </tr>

                    {expanded === c.id && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '0', borderTop: '1px solid var(--border-dim)',
                            background: 'rgba(255,255,255,0.01)',
                          }}>
                            {[
                              ['Garage ID', c.garage_id || '—'],
                              ['Claimant ID', c.claimant_id || '—'],
                              ['City', c.incident_city || '—'],
                              ['GNN Ring', `${Math.round(c.gnn_fraud_ring_score || 0)}%`],
                              ['Composite', `${Math.round(c.composite_score || c.fraud_score)}%`],
                              ['Premium', `$${(c.policy_annual_premium || 0).toLocaleString()}`],
                              ['Hobby', c.insured_hobbies || '—'],
                              ['Recommendation', c.recommendation_label || '—'],
                            ].map(([lbl, val]) => (
                              <div key={lbl} style={{ padding: '0.65rem 0.9rem', borderRight: '1px solid var(--border-dim)', borderBottom: '1px solid var(--border-dim)' }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--txt-lo)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{lbl}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--txt-hi)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Layer 7: Legal PDF Export & Chain of Custody Seal */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.65rem 1rem', background: 'rgba(15,23,42,0.4)',
                            borderTop: '1px solid var(--border-dim)', flexWrap: 'wrap', gap: '0.5rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--blue-400)', fontSize: '0.75rem' }}>🔒</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--txt-mid)' }}>
                                Evidence Digest: {c.evidence_sha256 ? `${c.evidence_sha256.slice(0, 24)}…` : 'Certified Chain of Custody'}
                              </span>
                            </div>
                            <a
                              href={`${API_BASE}/api/claims/${c.id}/export-pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                            >
                              📄 Download Legal PDF Evidence Package
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--txt-mid)' }}>
            {page + 1} / {totalPages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
