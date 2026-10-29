import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import UnifiedClaimStudio from './components/UnifiedClaimStudio';
import ResultsSlideshow from './components/ResultsSlideshow';
import FraudRingGraph from './components/FraudRingGraph';
import ClaimsHistory from './components/ClaimsHistory';

const API_BASE = 'http://127.0.0.1:8000';

const STEPS = [
  { label: 'Ingest', desc: 'Standardize inputs' },
  { label: 'EXIF',   desc: 'Forensic hashing' },
  { label: 'CNN',    desc: 'ResNet50 vision' },
  { label: 'XGB',    desc: 'Tabular anomaly' },
  { label: 'GNN',    desc: 'Ring detection' },
  { label: 'Compose',desc: 'Multi-modal synthesis' },
];

function PipelineBar({ step, text }) {
  return (
    <div className="proc-bar">
      <div className="proc-spin" />
      <div>
        <div className="proc-txt">{text || 'Initialising pipeline…'}</div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.2rem', flex: 1,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: i < step ? 'var(--blue-900)' : i === step - 1 ? 'var(--blue-700)' : 'var(--bg-raised)',
                border: `1px solid ${i < step ? 'var(--blue-700)' : 'var(--border-dim)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.55rem', color: i < step ? 'var(--blue-300)' : 'var(--txt-lo)',
                transition: 'all 0.3s',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.55rem', color: i < step ? 'var(--blue-400)' : 'var(--txt-lo)' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab]               = useState('analysis');
  const [status, setStatus]         = useState({ online: false, device: 'cpu' });
  const [files, setFiles]           = useState([]);
  const [processing, setProcessing] = useState(false);
  const [pipeStep, setPipeStep]     = useState(0);
  const [pipeText, setPipeText]     = useState('');
  const [results, setResults]       = useState(null);
  const [histKey, setHistKey]       = useState(0);
  const [newestId, setNewestId]     = useState(null);

  const refreshHistory = useCallback(() => setHistKey(k => k + 1), []);

  /* ── health poll ── */
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
          const d = await res.json();
          setStatus({ online: true, device: d.device, xgb: d.xgb_model_loaded, gnn: d.gnn_model_loaded });
        }
      } catch { setStatus({ online: false, device: 'cpu' }); }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleStart = async () => {
    setProcessing(true);
    setResults(null);
    const texts = [
      'Ingesting images & standardizing inputs…',
      'Forensic EXIF & perceptual hash analysis…',
      'ResNet50 deep convolutional inference…',
      'XGBoost tabular anomaly evaluation…',
      'GNN fraud ring message passing…',
      'Multi-modal composite synthesis…',
    ];
    for (let i = 1; i <= 6; i++) {
      setPipeStep(i);
      setPipeText(texts[i - 1]);
      await new Promise(r => setTimeout(r, 180));
    }
  };

  const handleComplete = (data, form) => {
    setProcessing(false);
    refreshHistory();
    setResults({ ...data, files });
    if (data.id) setNewestId(data.id);
  };

  const handleError = msg => {
    setProcessing(false);
    alert(`Analysis failed: ${msg}`);
  };

  /* sample image generator using real photographic assets */
  const handleSampleAdd = async isFraud => {
    try {
      const url = isFraud ? '/src/assets/sample_crash.jpg' : '/src/assets/sample_scratch.jpg';
      const res = await fetch(url);
      const blob = await res.blob();
      const fname = isFraud ? 'incident_collision_damage.jpg' : 'minor_bollard_scuff.jpg';
      const file = new File([blob], fname, { type: 'image/jpeg' });
      setFiles(p => p.some(f => f.name === file.name) ? p : [...p, file]);
    } catch {
      // fallback to basic file if fetch fails
      const fname = isFraud ? 'incident_collision_damage.jpg' : 'minor_bollard_scuff.jpg';
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      canvas.toBlob(blob => {
        const file = new File([blob], fname, { type: 'image/jpeg' });
        setFiles(p => p.some(f => f.name === file.name) ? p : [...p, file]);
      }, 'image/jpeg');
    }
  };

  return (
    <div className="app-shell">
      <Header status={status} activeTab={tab} setActiveTab={setTab} />

      {/* ── Analysis page ── */}
      {tab === 'analysis' && (
        <main className="page">
          <UnifiedClaimStudio
            files={files} setFiles={setFiles}
            onAnalyzeStart={handleStart}
            onAnalyzeComplete={handleComplete}
            onAnalyzeError={handleError}
            isProcessing={processing}
            onSampleAdd={handleSampleAdd}
          />

          {processing && (
            <PipelineBar step={pipeStep} text={pipeText} />
          )}

          {results && !processing && (
            <ResultsSlideshow data={results} files={files} />
          )}
        </main>
      )}

      {/* ── Network Graph page ── */}
      {tab === 'graph' && (
        <div className="graph-page-wrap">
          <FraudRingGraph
            refreshKey={histKey}
            newestClaimId={newestId}
            onNewestDismissed={() => setNewestId(null)}
          />
        </div>
      )}

      {/* ── Case Database page ── */}
      {tab === 'history' && (
        <main className="page-wide">
          <div className="ph">
            <span className="ph-label">Archive</span>
            <h1 className="ph-title">Case <em>Database</em></h1>
            <p className="ph-sub">All previously analyzed claims, sorted by submission time.</p>
          </div>
          <ClaimsHistory key={histKey} />
        </main>
      )}

      <footer className="footer">
        <span>IntelliClaim — ResNet50 · XGBoost · GNN · FNOL NLP</span>
        <span style={{ color: 'var(--blue-900)' }}>
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
