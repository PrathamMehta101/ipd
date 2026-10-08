import React from 'react';

const RISK_BADGES = {
  CRITICAL: {
    bg: 'rgba(220, 38, 38, 0.18)',
    border: 'rgba(220, 38, 38, 0.45)',
    color: '#ef4444',
    icon: '🚨',
    label: 'CRITICAL FRAUD RING SYNDICATE',
  },
  HIGH: {
    bg: 'rgba(245, 158, 11, 0.18)',
    border: 'rgba(245, 158, 11, 0.45)',
    color: '#f59e0b',
    icon: '🔴',
    label: 'HIGH NETWORK COLLUSION RISK',
  },
  MEDIUM: {
    bg: 'rgba(59, 130, 246, 0.18)',
    border: 'rgba(59, 130, 246, 0.45)',
    color: '#60a5fa',
    icon: '🟡',
    label: 'MODERATE NETWORK PROXIMITY',
  },
  LOW: {
    bg: 'rgba(16, 185, 129, 0.18)',
    border: 'rgba(16, 185, 129, 0.45)',
    color: '#10b981',
    icon: '✅',
    label: 'ISOLATED CLAIM (NO SYNDICATE)',
  },
};

export default function GNNFraudRingResult({ gnn, claimDetails, onSwitchToGraph }) {
  if (!gnn) return null;

  const score = gnn.fraud_ring_score ?? 0;
  const riskKey = gnn.ring_risk_level ?? (score >= 80 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW');
  const badge = RISK_BADGES[riskKey] || RISK_BADGES.LOW;

  const gid = claimDetails?.garage_id || gnn.ring_hub;
  const cid = claimDetails?.claimant_id;
  const city = claimDetails?.incident_city;

  return (
    <section className="gnn-result-card glass-panel" style={{
      marginTop: '1.5rem',
      padding: '1.8rem',
      border: `1px solid ${badge.border}`,
      boxShadow: `0 10px 30px -10px ${badge.bg}`,
      borderRadius: 'var(--radius-lg)',
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(16px)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '1.2rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(220,38,38,0.2) 100%)',
            border: '1px solid rgba(245,158,11,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}>
            🕸️
          </div>
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#f59e0b',
              textTransform: 'uppercase',
            }}>
              Graph Neural Network (GNN) Model Output
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Fraud Ring &amp; Network Collusion Intelligence
            </h3>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.9rem',
            borderRadius: '99px',
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            color: badge.color,
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}>
            {badge.icon} {badge.label}
          </span>
          {onSwitchToGraph && (
            <button
              type="button"
              onClick={onSwitchToGraph}
              className="btn btn-outline btn-sm"
              style={{
                borderColor: 'rgba(245,158,11,0.5)',
                color: '#fbbf24',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.8rem',
              }}
            >
              <i className="fa-solid fa-circle-nodes"></i> View in Network Graph
            </button>
          )}
        </div>
      </div>

      {/* ── Main Ring Score & Verdict Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.2rem',
        marginBottom: '1.5rem',
      }}>
        {/* Score Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: badge.color,
          }} />
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            GNN Fraud Ring Collusion Score
          </div>
          <div style={{
            fontSize: '3.2rem',
            fontWeight: 900,
            lineHeight: 1.1,
            marginTop: '0.5rem',
            color: badge.color,
            textShadow: `0 0 20px ${badge.color}40`,
          }}>
            {score.toFixed(1)}%
          </div>
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-dim)',
            marginTop: '0.3rem',
            fontFamily: 'var(--font-mono)',
          }}>
            Probability: {(gnn.fraud_ring_probability ?? (score / 100)).toFixed(4)}
          </div>
          <div style={{
            marginTop: '0.8rem',
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '99px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, score))}%`,
              height: '100%',
              background: badge.color,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Hub & Collusion Diagnosis Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '1.4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Detected Syndicate Hub &amp; Entities
          </div>

          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>🏪 Repair Facility (Garage):</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: gid ? '#fbbf24' : 'var(--text-dim)' }}>
                {gid || 'Not specified'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>👤 Claimant Profile:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: cid ? '#38bdf8' : 'var(--text-dim)' }}>
                {cid || 'Not specified'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 Incident Location:</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: city ? '#34d399' : 'var(--text-dim)' }}>
                {city || 'Columbus'}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '0.8rem',
            fontSize: '0.82rem',
            color: badge.color,
            fontWeight: 700,
            lineHeight: 1.35,
          }}>
            👉 {gnn.recommendation_label || 'GNN analysis executed.'}
          </div>
        </div>
      </div>

      {/* ── 4 Topological Graph Metric Counters ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.8rem',
        marginBottom: '1.5rem',
      }}>
        {/* Metric 1 */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '10px',
          padding: '0.9rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
            🔗 Connected Claims
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
            {gnn.connected_claims ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Links in graph</div>
        </div>

        {/* Metric 2 */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '10px',
          padding: '0.9rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
            🚨 Fraudulent Neighbors
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: (gnn.fraud_neighbors ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
            {gnn.fraud_neighbors ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Confirmed fraudulent</div>
        </div>

        {/* Metric 3 */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.06)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '10px',
          padding: '0.9rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
            🏪 Garage Volume
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
            {gnn.garage_matches_count ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            ({gnn.garage_fraud_count ?? 0} confirmed fraud)
          </div>
        </div>

        {/* Metric 4 */}
        <div style={{
          background: 'rgba(6, 182, 212, 0.06)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: '10px',
          padding: '0.9rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            👤 Claimant Repeat Filings
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
            {gnn.claimant_matches_count ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            ({gnn.claimant_fraud_count ?? 0} confirmed fraud)
          </div>
        </div>
      </div>

      {/* ── Network & Collusion Flags ── */}
      {gnn.network_flags && gnn.network_flags.length > 0 && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.2rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 800,
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <span>⚠️</span> Active Graph Collusion Flags ({gnn.network_flags.length})
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {gnn.network_flags.map((flag, idx) => (
              <li key={idx} style={{
                fontSize: '0.82rem',
                color: '#fecaca',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                lineHeight: 1.4,
              }}>
                <span style={{ color: '#ef4444' }}>•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Connected Neighbor Claims Table (Subgraph Trace) ── */}
      {gnn.matched_neighbors && gnn.matched_neighbors.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 'var(--radius-md)',
          padding: '1.2rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.8rem',
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#e2e8f0' }}>
              🔍 Connected Graph Neighbors (Top {gnn.matched_neighbors.length} Linked Nodes)
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Topological ties discovered via GNN message passing
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.78rem',
              textAlign: 'left',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Graph Relation</th>
                  <th style={{ padding: '0.5rem' }}>Facility / Person</th>
                  <th style={{ padding: '0.5rem' }}>Incident Type</th>
                  <th style={{ padding: '0.5rem' }}>City</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Claim Amount</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Prior Verdict</th>
                </tr>
              </thead>
              <tbody>
                {gnn.matched_neighbors.map((nb, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: nb.fraud_reported ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                  }}>
                    <td style={{ padding: '0.5rem', color: '#c7d2fe', fontWeight: 600 }}>{nb.relation}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                      {nb.garage_id || nb.claimant_id || nb.entity}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{nb.incident_type || 'Collision'}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{nb.incident_city || '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      ${Number(nb.total_claim_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: nb.fraud_reported ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: nb.fraud_reported ? '#f87171' : '#34d399',
                      }}>
                        {nb.fraud_reported ? '🚩 FRAUD' : '✅ CLEAN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
