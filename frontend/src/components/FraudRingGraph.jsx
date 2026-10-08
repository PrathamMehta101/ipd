import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(coseBilkent);

const API_BASE = 'http://127.0.0.1:8000';

const RISK_COLOR = {
  LOW:      '#10b981',
  MEDIUM:   '#f59e0b',
  HIGH:     '#ef4444',
  CRITICAL: '#dc2626',
};

const RISK_GLOW = {
  LOW:      'rgba(16,185,129,0.5)',
  MEDIUM:   'rgba(245,158,11,0.5)',
  HIGH:     'rgba(239,68,68,0.5)',
  CRITICAL: 'rgba(220,38,38,0.7)',
};

const TYPE_CONFIG = {
  claim: {
    color: '#ef4444',
    icon: '📄',
    label: 'Claim',
    shape: 'ellipse',
    border: '#ffffff',
  },
  garage: {
    color: '#f59e0b',
    icon: '🏪',
    label: 'Garage',
    shape: 'hexagon',
    border: '#fbbf24',
  },
  claimant: {
    color: '#06b6d4',
    icon: '👤',
    label: 'Claimant',
    shape: 'diamond',
    border: '#67e8f9',
  },
  city: {
    color: '#10b981',
    icon: '📍',
    label: 'City',
    shape: 'round-rectangle',
    border: '#34d399',
  },
  state: {
    color: '#6366f1',
    icon: '🏛️',
    label: 'State',
    shape: 'star',
    border: '#818cf8',
  },
  incident_type: {
    color: '#ec4899',
    icon: '💥',
    label: 'Type',
    shape: 'tag',
    border: '#f472b6',
  },
};

export default function FraudRingGraph({ refreshKey, newestClaimId, onNewestDismissed }) {
  const containerRef       = useRef(null);
  const cyRef              = useRef(null);
  const newestClaimIdRef   = useRef(newestClaimId);  // keep in sync for cy event handlers

  const [graphData, setGraphData]     = useState(null);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [seeding, setSeeding]         = useState(false);
  const [layoutName, setLayoutName]   = useState('cose-bilkent');
  const [filterRisk, setFilterRisk]   = useState('ALL');
  const [filterType, setFilterType]   = useState('ALL');
  const [seedMsg, setSeedMsg]         = useState('');
  const [stats, setStats]             = useState({
    nodes: 0,
    edges: 0,
    claims: 0,
    fraud: 0,
    untouched: 0,
    garages: 0,
    claimants: 0,
    cities: 0,
    hubs: 0,
  });

  // Keep ref in sync whenever prop changes so tap handlers always see latest value
  useEffect(() => { newestClaimIdRef.current = newestClaimId; }, [newestClaimId]);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/graph/nodes`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);

        const claimNodes      = data.nodes.filter(n => n.type === 'claim');
        const fraudClaims     = claimNodes.filter(n => n.predicted_class === 'Fraud');
        const untouchedClaims = claimNodes.filter(n => n.is_untouched);
        const garageNodes     = data.nodes.filter(n => n.type === 'garage');
        const claimantNodes   = data.nodes.filter(n => n.type === 'claimant');
        const cityNodes       = data.nodes.filter(n => n.type === 'city');
        const ringHubs        = data.nodes.filter(
          n => (n.type === 'garage' || n.type === 'claimant') && (n.claim_count >= 2)
        );

        setStats({
          nodes:     data.nodes.length,
          edges:     data.edges.length,
          claims:    claimNodes.length,
          fraud:     fraudClaims.length,
          untouched: untouchedClaims.length,
          garages:   garageNodes.length,
          claimants: claimantNodes.length,
          cities:    cityNodes.length,
          hubs:      ringHubs.length,
        });
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  const handleMarkReviewed = async (claimId) => {
    try {
      const res = await fetch(`${API_BASE}/api/claims/${claimId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyst_verdict: 'REVIEWED' }),
      });
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, is_untouched: false, label: `#${claimId}` } : null);
        await fetchGraph();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph, refreshKey]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/seed`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setSeedMsg(d.message || 'Seeded 30 claims!');
        await fetchGraph();
      } else {
        setSeedMsg(`Error ${res.status}`);
      }
    } catch (e) {
      setSeedMsg('Backend unreachable');
    }
    setSeeding(false);
  };

  // Build / rebuild Cytoscape
  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // 1. Filter claims by risk if set
    let visibleClaims = graphData.nodes.filter(n => n.type === 'claim');
    if (filterRisk !== 'ALL') {
      if (filterRisk === 'UNTOUCHED') {
        visibleClaims = visibleClaims.filter(c => c.is_untouched);
      } else {
        visibleClaims = visibleClaims.filter(c => c.risk_level === filterRisk);
      }
    }
    const visibleClaimIds = new Set(visibleClaims.map(c => c.id));

    // 2. Identify relevant edges
    const activeEdges = graphData.edges.filter(e => visibleClaimIds.has(e.source));

    // 3. Connect entity nodes that are linked to visible claims
    const linkedEntityIds = new Set();
    activeEdges.forEach(e => {
      linkedEntityIds.add(e.target);
    });

    // 4. Filter by entity type if requested
    let visibleEntities = graphData.nodes.filter(
      n => n.type !== 'claim' && linkedEntityIds.has(n.id)
    );
    if (filterType !== 'ALL') {
      visibleEntities = visibleEntities.filter(n => n.type === filterType);
    }
    const visibleEntityIds = new Set(visibleEntities.map(e => e.id));

    // Final nodes and edges
    const finalNodes = [...visibleClaims, ...visibleEntities];
    const finalNodeIds = new Set(finalNodes.map(n => n.id));

    const finalEdges = graphData.edges.filter(
      e => finalNodeIds.has(e.source) && finalNodeIds.has(e.target)
    );

    if (finalNodes.length === 0) return;

    const elements = [
      ...finalNodes.map(n => ({
        group: 'nodes',
        data: { ...n },
      })),
      ...finalEdges.map((e, i) => ({
        group: 'edges',
        data: {
          id:     `edge-${e.source}-${e.target}-${i}`,
          source: e.source,
          target: e.target,
          rel:    e.rel || 'CONNECTED',
          weight: e.weight || 1,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // Base node styling
        {
          selector: 'node',
          style: {
            'font-family':        'Outfit, sans-serif',
            'font-weight':        'bold',
            'text-valign':        'center',
            'text-halign':        'center',
            'text-outline-width': 1.8,
            'text-outline-color': 'rgba(0,0,0,0.85)',
            'color':              '#ffffff',
            'transition-property':'background-color, border-color, width, height, opacity',
            'transition-duration':'0.18s',
          },
        },
        // Base Claim Node
        {
          selector: 'node[type = "claim"]',
          style: {
            'shape':              'ellipse',
            'background-color':   (el) => RISK_COLOR[el.data('risk_level')] || '#6b7280',
            'border-width':       (el) => el.data('predicted_class') === 'Fraud' ? 3.5 : 1.5,
            'border-color':       (el) => el.data('predicted_class') === 'Fraud' ? '#ffffff' : 'rgba(255,255,255,0.4)',
            'width':              (el) => Math.max(34, ((el.data('fraud_score') || 50) / 100) * 36 + 24),
            'height':             (el) => Math.max(34, ((el.data('fraud_score') || 50) / 100) * 36 + 24),
            'label':              'data(label)',
            'font-size':          '11px',
            'font-weight':        'bold',
          },
        },
        // Untouched / Unanalyzed Claim Nodes — subtle cyan border only, no glow
        {
          selector: 'node[type = "claim"][?is_untouched]',
          style: {
            'border-width':   3,
            'border-style':   'solid',
            'border-color':   '#38bdf8',
            'border-opacity': 1,
            'font-size':      '11px',
            'font-weight':    'bold',
          },
        },
        // Newest submitted claim — precise single-node amber pulse
        {
          selector: 'node.newest-node',
          style: {
            'border-width':    6,
            'border-style':    'solid',
            'border-color':    '#fbbf24',
            'border-opacity':  1,
            'overlay-color':   '#f59e0b',
            'overlay-padding': 12,
            'overlay-opacity': 0.55,
            'font-size':       '13px',
            'font-weight':     'bold',
          },
        },
        // Garage Node (Anchor hub)
        {
          selector: 'node[type = "garage"]',
          style: {
            'shape':            'hexagon',
            'background-color': '#d97706',
            'border-width':     3,
            'border-color':     '#fde68a',
            'width':            (el) => Math.min(84, 56 + (el.data('claim_count') || 1) * 4),
            'height':           (el) => Math.min(84, 56 + (el.data('claim_count') || 1) * 4),
            'label':            (el) => `🏪 ${el.data('label')}`,
            'font-size':        '11px',
            'font-weight':      'bold',
          },
        },
        // Claimant Node
        {
          selector: 'node[type = "claimant"]',
          style: {
            'shape':            'diamond',
            'background-color': '#0891b2',
            'border-width':     3,
            'border-color':     '#a5f3fc',
            'width':            (el) => Math.min(74, 48 + (el.data('claim_count') || 1) * 6),
            'height':           (el) => Math.min(74, 48 + (el.data('claim_count') || 1) * 6),
            'label':            (el) => `👤 ${el.data('label')}`,
            'font-size':        '10px',
            'font-weight':      'bold',
          },
        },
        // City Node
        {
          selector: 'node[type = "city"]',
          style: {
            'shape':            'round-rectangle',
            'background-color': '#059669',
            'border-width':     2,
            'border-color':     '#6ee7b7',
            'width':            (el) => Math.max(60, (el.data('label') || '').length * 8 + 28),
            'height':           34,
            'label':            (el) => `📍 ${el.data('label')}`,
            'font-size':        '10px',
            'font-weight':      'bold',
          },
        },
        // State Node
        {
          selector: 'node[type = "state"]',
          style: {
            'shape':            'star',
            'background-color': '#4f46e5',
            'border-width':     2,
            'border-color':     '#c7d2fe',
            'width':            42,
            'height':           42,
            'label':            (el) => `🏛️ ${el.data('label')}`,
            'font-size':        '9px',
            'font-weight':      'bold',
          },
        },
        // Incident Type Node
        {
          selector: 'node[type = "incident_type"]',
          style: {
            'shape':            'tag',
            'background-color': '#db2777',
            'border-width':     2,
            'border-color':     '#fbcfe8',
            'width':            (el) => Math.max(56, (el.data('label') || '').length * 7 + 24),
            'height':           30,
            'label':            (el) => `💥 ${el.data('label')}`,
            'font-size':        '9.5px',
            'font-weight':      'bold',
          },
        },
        // Selected / Hover state
        {
          selector: 'node:selected, node.selected',
          style: {
            'border-width':   5,
            'border-color':   '#ffffff',
            'overlay-color':  '#ffffff',
            'overlay-padding': 12,
            'overlay-opacity': 0.45,
          },
        },
        // Base edge styling
        {
          selector: 'edge',
          style: {
            'curve-style':        'bezier',
            'width':              1.8,
            'line-color':         'rgba(148,163,184,0.35)',
            'opacity':            0.6,
            'target-arrow-shape': 'triangle',
            'arrow-scale':        0.8,
            'target-arrow-color': 'rgba(148,163,184,0.35)',
          },
        },
        // Edge styling by relation
        {
          selector: 'edge[rel = "REPAIRED_AT"]',
          style: {
            'line-color':         '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'width':              3.4,
            'opacity':            0.85,
            'line-style':         'solid',
          },
        },
        {
          selector: 'edge[rel = "FILED_BY"]',
          style: {
            'line-color':         '#06b6d4',
            'target-arrow-color': '#06b6d4',
            'width':              2.8,
            'opacity':            0.85,
            'line-style':         'solid',
          },
        },
        {
          selector: 'edge[rel = "OCCURRED_IN"]',
          style: {
            'line-color':         '#10b981',
            'target-arrow-color': '#10b981',
            'width':              1.8,
            'opacity':            0.65,
            'line-style':         'dashed',
          },
        },
        {
          selector: 'edge[rel = "INCIDENT_TYPE"]',
          style: {
            'line-color':         '#ec4899',
            'target-arrow-color': '#ec4899',
            'width':              1.6,
            'opacity':            0.6,
            'line-style':         'dashed',
          },
        },
        {
          selector: 'edge[rel = "POLICY_IN"]',
          style: {
            'line-color':         '#6366f1',
            'target-arrow-color': '#6366f1',
            'width':              1.4,
            'opacity':            0.5,
            'line-style':         'dotted',
          },
        },
        // Neighborhood highlight / dim classes
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'z-index': 9999,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 4.5,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'opacity': 1,
            'width':   4,
            'z-index': 9999,
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.12,
          },
        },
      ],
      layout: {
        name:             layoutName === 'cose-bilkent' ? 'cose-bilkent' : layoutName,
        animate:          true,
        animationDuration:800,
        fit:              true,
        padding:          50,
        nodeRepulsion:    18000,
        idealEdgeLength:  130,
        edgeElasticity:   0.4,
        gravity:          0.2,
        numIter:          2500,
        tile:             true,
        randomize:        false,
      },
      minZoom:            0.15,
      maxZoom:            4,
      wheelSensitivity:   0.25,
      autoungrabify:      false,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled:false,
    });

    // Apply newest-node class to the exact just-submitted claim
    const applyNewestHighlight = () => {
      cy.nodes().removeClass('newest-node');
      if (newestClaimIdRef.current != null) {
        const targetNodeId = `claim_${newestClaimIdRef.current}`;
        const targetNode = cy.getElementById(targetNodeId);
        if (targetNode && targetNode.length > 0) {
          targetNode.addClass('newest-node');
        }
      }
    };

    cy.on('layoutstop', applyNewestHighlight);
    // Also apply immediately in case layout already finished
    applyNewestHighlight();

    // Tap node: select, illuminate neighborhood, and dismiss newest highlight if it's the new claim
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelected(node.data());

      // Dismiss the newest highlight when any claim is tapped
      const nodeId = node.data('id');
      const expectedId = `claim_${newestClaimIdRef.current}`;
      if (nodeId === expectedId && node.hasClass('newest-node')) {
        node.removeClass('newest-node');
        newestClaimIdRef.current = null;
        if (onNewestDismissed) onNewestDismissed();
      }

      const neighborhood = node.neighborhood().add(node);
      cy.elements().removeClass('highlighted faded');
      neighborhood.addClass('highlighted');
      cy.elements().not(neighborhood).addClass('faded');
    });

    // Tap background: deselect and reset
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelected(null);
        cy.elements().removeClass('highlighted faded');
      }
    });

    cyRef.current = cy;
    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [graphData, filterRisk, filterType, layoutName]);

  const fitGraph = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  };

  // Helper to find claims connected to the selected entity
  const getConnectedClaims = () => {
    if (!selected || !graphData || selected.type === 'claim') return [];
    const claimIds = new Set();
    graphData.edges.forEach(e => {
      if (e.target === selected.id) {
        claimIds.add(e.source);
      }
    });
    return graphData.nodes.filter(n => n.type === 'claim' && claimIds.has(n.id));
  };

  const connectedClaims = getConnectedClaims();
  const nodeTypeCfg = selected ? (TYPE_CONFIG[selected.type] || TYPE_CONFIG.claim) : null;
  const inspectorColor = selected?.type === 'claim'
    ? (RISK_COLOR[selected.risk_level] || '#6b7280')
    : (nodeTypeCfg?.color || '#3b82f6');

  return (
    <div className="graph-page">
      {/* ── Top Toolbar ── */}
      <div className="gp-toolbar">
        <div className="gp-toolbar-left">
          <span className="gp-badge">🕸 Heterogeneous Knowledge Graph</span>
          <h1 className="gp-title">Fraud Ring Intelligence Network</h1>
          <p className="gp-subtitle">
            Multitype graph mapping Claims, Repair Garages, Claimants, Cities &amp; Collision Patterns
          </p>
        </div>

        <div className="gp-toolbar-right">
          {/* Quick Metrics */}
          <div className="gp-stat-row">
            <div className="gp-stat"><span>{stats.nodes}</span>Total Nodes</div>
            <div className="gp-stat" style={{ color: '#ef4444' }}><span>{stats.fraud}</span>Fraud Claims</div>
            <div className="gp-stat" style={{ color: '#f59e0b' }}><span>{stats.garages}</span>Garages</div>
            <div className="gp-stat" style={{ color: '#06b6d4' }}><span>{stats.claimants}</span>Claimants</div>
            <div className="gp-stat" style={{ color: '#10b981' }}><span>{stats.cities}</span>Cities</div>
            <div className="gp-stat" style={{ color: '#ec4899' }}><span>{stats.hubs}</span>Ring Hubs</div>
          </div>

          {/* Controls */}
          <div className="gp-controls">
            {/* Risk Filter */}
            <select
              className="gp-select"
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value)}
              id="gp-filter-risk"
            >
              <option value="ALL">Risk: All</option>
              <option value="LOW">🟢 Low Risk</option>
              <option value="MEDIUM">🟡 Medium Risk</option>
              <option value="HIGH">🔴 High Risk</option>
              <option value="CRITICAL">🚨 Critical Risk</option>
            </select>

            {/* Entity Type Filter */}
            <select
              className="gp-select"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              id="gp-filter-type"
            >
              <option value="ALL">Entities: All Types</option>
              <option value="garage">🏪 Garages Only</option>
              <option value="claimant">👤 Claimants Only</option>
              <option value="city">📍 Cities Only</option>
              <option value="incident_type">💥 Incident Types</option>
              <option value="state">🏛️ States</option>
            </select>

            {/* Layout */}
            <select
              className="gp-select"
              value={layoutName}
              onChange={e => setLayoutName(e.target.value)}
              id="gp-layout-select"
            >
              <option value="cose-bilkent">Physics Layout</option>
              <option value="concentric">Concentric Hubs</option>
              <option value="circle">Circular Ring</option>
              <option value="grid">Grid Matrix</option>
            </select>

            <button className="gp-btn" onClick={fitGraph} title="Fit to View" id="gp-fit-btn">
              🔍 Fit
            </button>
            <button className="gp-btn" onClick={fetchGraph} disabled={loading} id="gp-refresh-btn">
              {loading ? '⏳' : '↻ Refresh'}
            </button>
            <button className="gp-btn gp-btn--seed" onClick={handleSeed} disabled={seeding} id="gp-seed-btn">
              {seeding ? '⏳ Seeding…' : '🌱 Seed DB'}
            </button>
          </div>
          {seedMsg && <div className="gp-seed-msg">{seedMsg}</div>}

          {/* Newest claim indicator banner */}
          {newestClaimId != null && (
            <div className="newest-claim-banner" style={{ marginTop: '0.5rem' }}>
              <span>⭐ New Claim #{newestClaimId} highlighted on graph</span>
              <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>— click the node to dismiss</span>
              <button
                className="ncb-dismiss"
                type="button"
                title="Dismiss highlight"
                onClick={() => {
                  // Also remove it from the graph directly
                  if (cyRef.current) {
                    cyRef.current.nodes().removeClass('newest-node');
                  }
                  newestClaimIdRef.current = null;
                  if (onNewestDismissed) onNewestDismissed();
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="gp-legend">
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#ef4444', border: '2px solid #fff' }} />
          Claim (Fraud)
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#10b981' }} />
          Claim (Legit)
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#f59e0b', borderRadius: '2px' }} />
          🏪 Garage Hub
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#06b6d4', borderRadius: '1px', transform: 'rotate(45deg)' }} />
          👤 Claimant
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#10b981', borderRadius: '4px' }} />
          📍 City / Location
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#ec4899', borderRadius: '2px' }} />
          💥 Incident Type
        </span>
        <span className="gp-legend-item">
          <span className="gp-legend-dot" style={{ background: '#6366f1' }} />
          🏛️ State
        </span>
        <span className="gp-legend-item" style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
          🖱 Drag nodes · Click to isolate ring · Scroll to zoom
        </span>
      </div>

      {/* ── Main Canvas & Inspector ── */}
      <div className="gp-main">
        {/* Canvas */}
        <div className="gp-canvas-wrap">
          {loading && !graphData && (
            <div className="gp-overlay">
              <span className="spinner-ring" style={{ width: 36, height: 36, borderWidth: 3 }} />
              <span>Building Knowledge Graph…</span>
            </div>
          )}
          {graphData && graphData.nodes.length === 0 && (
            <div className="gp-overlay">
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🕸️</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Graph is empty</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.3rem', marginBottom: '1rem' }}>
                Click <strong style={{ color: '#6ee7b7' }}>🌱 Seed DB</strong> to load demo claims and fraud rings.
              </div>
              <button
                className="gp-btn gp-btn--seed"
                style={{ fontSize: '1rem', padding: '0.6rem 1.5rem' }}
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? '⏳ Seeding…' : '🌱 Seed 30 Demo Claims'}
              </button>
              {seedMsg && <div className="gp-seed-msg" style={{ marginTop: '0.5rem' }}>{seedMsg}</div>}
            </div>
          )}
          <div ref={containerRef} className="gp-canvas" />
        </div>

        {/* ── Inspector Panel ── */}
        {selected ? (
          <div className="gp-inspector" style={{ '--node-color': inspectorColor }}>
            <div className="gpi-header">
              <div className="gpi-id">
                {selected.type === 'claim' && `Claim #${selected.claim_db_id || selected.id.replace('claim_', '')}`}
                {selected.type === 'garage' && `🏪 Garage ${selected.label}`}
                {selected.type === 'claimant' && `👤 Claimant ${selected.label}`}
                {selected.type === 'city' && `📍 Location: ${selected.label}`}
                {selected.type === 'incident_type' && `💥 Type: ${selected.full_label || selected.label}`}
                {selected.type === 'state' && `🏛️ State: ${selected.label}`}
              </div>
              <button className="gpi-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* ── 1. CLAIM INSPECTOR ── */}
            {selected.type === 'claim' && (
              <>
                <div className="gpi-gauge-row">
                  <svg viewBox="0 0 110 65" className="gpi-gauge-svg">
                    <path
                      d="M10,58 A48,48 0 0,1 100,58"
                      fill="none"
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10,58 A48,48 0 0,1 100,58"
                      fill="none"
                      stroke={inspectorColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${((selected.fraud_score || 0) / 100) * 150.8} 150.8`}
                      style={{ filter: `drop-shadow(0 0 6px ${inspectorColor})` }}
                    />
                    <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill="white">
                      {Math.round(selected.fraud_score || 0)}
                    </text>
                    <text x="55" y="62" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">
                      FRAUD SCORE
                    </text>
                  </svg>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: inspectorColor, marginBottom: '0.4rem' }}>
                      {selected.predicted_class === 'Fraud' ? '🚩 Fraudulent' : '✅ Legitimate'}
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        background: `${inspectorColor}22`,
                        color: inspectorColor,
                        padding: '0.25rem 0.7rem',
                        borderRadius: '99px',
                      }}
                    >
                      {selected.risk_level} RISK
                    </span>
                  </div>
                </div>

                <div className="gpi-chain-box">
                  <div className="gpi-chain-item">
                    <span className="gpi-chain-label">🏪 Repair Garage</span>
                    <span className="gpi-chain-val" style={{ color: '#f59e0b' }}>
                      {selected.garage_id || '—'}
                    </span>
                  </div>
                  <div className="gpi-chain-item">
                    <span className="gpi-chain-label">👤 Claimant</span>
                    <span className="gpi-chain-val" style={{ color: '#06b6d4' }}>
                      {selected.claimant_id || '—'}
                    </span>
                  </div>
                  <div className="gpi-chain-item">
                    <span className="gpi-chain-label">📍 Incident City</span>
                    <span className="gpi-chain-val" style={{ color: '#10b981' }}>
                      {selected.incident_city || '—'}
                    </span>
                  </div>
                </div>

                <div className="gpi-grid">
                  {[
                    ['Collision Type', selected.incident_type],
                    ['Severity',       selected.incident_severity],
                    ['Date',           selected.incident_date],
                    ['State',          selected.policy_state],
                    ['Hobbies',        selected.insured_hobbies],
                    ['Total Claim',    `$${Number(selected.total_claim_amount || 0).toLocaleString()}`],
                    ['Vehicle Claim',  `$${Number(selected.vehicle_claim || 0).toLocaleString()}`],
                    ['Fraud Prob',     `${((selected.fraud_probability || 0) * 100).toFixed(1)}%`],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="gpi-cell">
                      <span className="gpi-cell-label">{lbl}</span>
                      <span className="gpi-cell-val">{val}</span>
                    </div>
                  ))}
                </div>

                {selected.recommendation_label && (
                  <div className="gpi-rec">{selected.recommendation_label}</div>
                )}
              </>
            )}

            {/* ── 2. GARAGE INSPECTOR (FRAUD RING ANCHOR) ── */}
            {selected.type === 'garage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em' }}>
                    FRAUD RING CONCENTRATION HUB
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
                    {selected.claim_count} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Claims routed through this shop</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                    {selected.claim_count >= 3
                      ? '⚠️ CRITICAL RING WARNING: Unusually high claim density. Indicates a staged collision ring or repair shop billing collusion.'
                      : 'ℹ️ Moderate activity. Monitored for potential syndication.'}
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  Connected Claims ({connectedClaims.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {connectedClaims.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Claim #{c.claim_db_id || c.label}</span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: RISK_COLOR[c.risk_level],
                        background: `${RISK_COLOR[c.risk_level]}22`,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '99px',
                      }}>
                        {c.risk_level} ({Math.round(c.fraud_score || 0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. CLAIMANT INSPECTOR ── */}
            {selected.type === 'claimant' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.08em' }}>
                    CLAIMANT PROFILE
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
                    {selected.claim_count} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Claims Filed</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.4rem', lineHeight: 1.4 }}>
                    {selected.claim_count >= 2
                      ? '🚨 SERIAL CLAIMANT ALERT: Multiple claims filed across jurisdictions or time intervals. Strong signal of organized fraud.'
                      : 'ℹ️ Single claim history.'}
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  Associated Claims ({connectedClaims.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {connectedClaims.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Claim #{c.claim_db_id || c.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{c.incident_city || 'City —'} · Garage {c.garage_id || '—'}</div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: RISK_COLOR[c.risk_level],
                        background: `${RISK_COLOR[c.risk_level]}22`,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '99px',
                      }}>
                        {c.risk_level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 4. CITY / STATE / INCIDENT TYPE INSPECTOR ── */}
            {(selected.type === 'city' || selected.type === 'state' || selected.type === 'incident_type') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: inspectorColor, letterSpacing: '0.08em' }}>
                    {selected.type.toUpperCase()} ATTRIBUTE HUB
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
                    {selected.full_label || selected.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                    Total linked claims: <strong style={{ color: '#fff' }}>{selected.claim_count || connectedClaims.length}</strong>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  Connected Claims ({connectedClaims.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {connectedClaims.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Claim #{c.claim_db_id || c.label}</span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: RISK_COLOR[c.risk_level],
                        background: `${RISK_COLOR[c.risk_level]}22`,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '99px',
                      }}>
                        {c.risk_level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state prompt */
          <div className="gp-inspector gp-inspector--empty">
            <div style={{ fontSize: '2.2rem' }}>🕸️</div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
              Interactive Network Guide
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
              Click any node to illuminate its connected fraud ring and inspect details.
            </div>

            {/* Edge Legend */}
            <div className="gp-ring-legend">
              <div style={{ fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.06em' }}>
                RELATIONSHIP CONNECTIONS
              </div>
              {[
                ['━━━', '#f59e0b', 'REPAIRED_AT (Garage Ring)'],
                ['━━━', '#06b6d4', 'FILED_BY (Claimant)'],
                ['╌╌╌', '#10b981', 'OCCURRED_IN (City)'],
                ['╌╌╌', '#ec4899', 'INCIDENT_TYPE (Pattern)'],
                ['····', '#6366f1', 'POLICY_IN (State)'],
              ].map(([dash, col, lbl]) => (
                <div key={lbl} className="gp-ring-row">
                  <span style={{ color: col, fontFamily: 'monospace', fontSize: '1rem', width: '38px' }}>
                    {dash}
                  </span>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{lbl}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '0.6rem',
              padding: '0.6rem 0.8rem',
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.73rem',
              color: 'var(--text-dim)',
              lineHeight: 1.4,
              textAlign: 'center',
            }}>
              💡 <strong>Pro Tip:</strong> Click on <strong style={{ color: '#f59e0b' }}>🏪 G-001</strong> to instantly see all 6 collision claims channeled through Columbus.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
