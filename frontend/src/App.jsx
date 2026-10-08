import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import UnifiedClaimStudio from './components/UnifiedClaimStudio';
import PipelineVisualizer from './components/PipelineVisualizer';
import GNNFraudRingResult from './components/GNNFraudRingResult';
import TriModalFraudReport from './components/TriModalFraudReport';
import DashboardResults from './components/DashboardResults';
import ImageResultsGrid from './components/ImageResultsGrid';
import FraudRingGraph from './components/FraudRingGraph';
import ClaimsHistory from './components/ClaimsHistory';

const API_BASE = 'http://127.0.0.1:8000';

const TABS = [
  { id: 'analysis',  label: '🔍 Claim Analysis',       desc: 'Tri-Modal AI (CNN + XGBoost + GNN)' },
  { id: 'graph',     label: '🕸 Fraud Network Graph',  desc: 'Interactive ring detection'  },
  { id: 'history',   label: '🗄 Claims Database',      desc: 'Full historical record'       },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    device: 'cpu',
    classes: [],
    xgb_model_loaded: false,
    gnn_model_loaded: false,
  });
  const [files, setFiles]                             = useState([]);
  const [isProcessing, setIsProcessing]               = useState(false);
  const [pipelineStep, setPipelineStep]               = useState(0);
  const [pipelineStatusText, setPipelineStatusText]   = useState('');
  const [results, setResults]                         = useState(null);
  const [triModalReport, setTriModalReport]           = useState(null);
  const [gnnOutput, setGnnOutput]                     = useState(null);
  const [submittedClaim, setSubmittedClaim]           = useState(null);
  const [historyKey, setHistoryKey]                   = useState(0);
  const [newestClaimId, setNewestClaimId]             = useState(null);

  const handlePredictComplete = useCallback(() => setHistoryKey(k => k + 1), []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus({
            online: true,
            device: data.device,
            classes: data.classes,
            xgb_model_loaded: data.xgb_model_loaded,
            gnn_model_loaded: data.gnn_model_loaded,
          });
        }
      } catch {
        setBackendStatus({ online: false, device: 'cpu', classes: [] });
      }
    };
    checkHealth();
    const iv = setInterval(checkHealth, 4000);
    return () => clearInterval(iv);
  }, []);

  const handleSampleAdd = (isFraud) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (isFraud) {
      const grad = ctx.createLinearGradient(0,0,400,300);
      grad.addColorStop(0,'#312e81'); grad.addColorStop(0.5,'#4c0519'); grad.addColorStop(1,'#0f172a');
      ctx.fillStyle = grad; ctx.fillRect(0,0,400,300);
      ctx.fillStyle='#94a3b8'; ctx.fillRect(80,100,240,120);
      ctx.fillStyle='#ef4444'; ctx.font='bold 16px Outfit,sans-serif';
      ctx.fillText('SAMPLE CLAIM #9041 (FRAUD DEMO)',30,45);
      ctx.font='12px JetBrains Mono,sans-serif';
      ctx.fillText('Recycled Vehicle Photo / Staged Claim',30,70);
    } else {
      const grad = ctx.createLinearGradient(0,0,400,300);
      grad.addColorStop(0,'#064e3b'); grad.addColorStop(0.5,'#0f172a'); grad.addColorStop(1,'#1e293b');
      ctx.fillStyle = grad; ctx.fillRect(0,0,400,300);
      ctx.fillStyle='#cbd5e1'; ctx.fillRect(60,110,280,110);
      ctx.fillStyle='#f59e0b'; ctx.fillRect(240,130,80,70);
      ctx.fillStyle='#34d399'; ctx.font='bold 16px Outfit,sans-serif';
      ctx.fillText('SAMPLE CLAIM #1029 (AUTHENTIC ACCIDENT)',30,45);
      ctx.font='12px JetBrains Mono,sans-serif';
      ctx.fillText('Real Frontal Impact Damage Photo',30,70);
    }
    canvas.toBlob((blob) => {
      const filename = isFraud ? 'sample_fraud_claim_photo.jpg' : 'sample_authentic_accident.jpg';
      const file = new File([blob], filename, { type: 'image/jpeg' });
      setFiles(prev => prev.some(sf => sf.name===file.name && sf.size===file.size) ? prev : [...prev, file]);
    }, 'image/jpeg');
  };

  const handleUnifiedStart = async () => {
    setIsProcessing(true);
    setResults(null);
    setTriModalReport(null);
    setGnnOutput(null);

    const steps = [
      'Ingesting images & standardizing inputs...',
      'Forensic EXIF & perceptual duplicate hashing...',
      'ResNet50 Deep Convolutional Neural Network...',
      'XGBoost Tabular Anomaly Feature Evaluation...',
      'GNN Graph Neural Network Message Passing...',
      'Multi-Modal Tri-Modal Composite Synthesis...'
    ];

    for (let step = 1; step <= 6; step++) {
      setPipelineStep(step);
      setPipelineStatusText(steps[step - 1]);
      await new Promise(r => setTimeout(r, 160));
    }
  };

  const handleUnifiedComplete = (data, form) => {
    setIsProcessing(false);
    handlePredictComplete(); // refresh history & graph
    setResults(data);
    setTriModalReport(data);
    setGnnOutput(data.gnn);
    setSubmittedClaim({ ...form, garage_id: form.garage_id || data.garage_id, claimant_id: form.claimant_id || data.claimant_id });
    // Track the exact DB ID of this new claim so the graph can highlight it
    if (data.id) setNewestClaimId(data.id);
  };

  const handleUnifiedError = (errMsg) => {
    setIsProcessing(false);
    alert(`Analysis Failed: ${errMsg}`);
  };

  return (
    <div className="app-container">
      <Header status={backendStatus} />

      {/* ─── Tab Navigation ─── */}
      <nav className="tab-nav" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab-btn ${activeTab === t.id ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab-label">{t.label}</span>
            <span className="tab-desc">{t.desc}</span>
          </button>
        ))}
      </nav>

      {/* ─── Tab: Claim Analysis ─── */}
      {activeTab === 'analysis' && (
        <main className="main-content">
          <Hero />

          {/* Unified Single-Action Studio: Images + Tabular + GNN */}
          <UnifiedClaimStudio
            files={files}
            setFiles={setFiles}
            onAnalyzeStart={handleUnifiedStart}
            onAnalyzeComplete={handleUnifiedComplete}
            onAnalyzeError={handleUnifiedError}
            isProcessing={isProcessing}
            onSampleAdd={handleSampleAdd}
          />

          {isProcessing && <PipelineVisualizer currentStep={pipelineStep} statusText={pipelineStatusText} />}

          {/* ── 1. PROMINENT GRAPH MODEL OUTPUT (GNN Fraud Ring Intelligence) ── */}
          {gnnOutput && (
            <GNNFraudRingResult
              gnn={gnnOutput}
              claimDetails={submittedClaim}
              onSwitchToGraph={() => setActiveTab('graph')}
            />
          )}

          {/* ── 2. Unified Tri-Modal Report (CNN + XGBoost + GNN) ── */}
          {triModalReport && (
            <TriModalFraudReport
              data={triModalReport}
              onSwitchToGraph={() => setActiveTab('graph')}
            />
          )}

          {/* ── 3. CNN Image Results (if photos were analyzed) ── */}
          {results && results.image_results && results.image_results.length > 0 && (
            <>
              <DashboardResults results={results} files={files} />
              <ImageResultsGrid imageResults={results.image_results} files={files} />
            </>
          )}
        </main>
      )}

      {/* ─── Tab: Fraud Network Graph (full-page) ─── */}
      {activeTab === 'graph' && (
        <div className="graph-page-wrap">
          <FraudRingGraph
            refreshKey={historyKey}
            newestClaimId={newestClaimId}
            onNewestDismissed={() => setNewestClaimId(null)}
          />
        </div>
      )}

      {/* ─── Tab: Claims Database ─── */}
      {activeTab === 'history' && (
        <main className="main-content">
          <ClaimsHistory key={historyKey} />
        </main>
      )}

      <footer className="footer">
        <p>AutoShield AI Fraud Detection System • Powered by PyTorch ResNet50, XGBoost &amp; Graph Neural Network (GNN)</p>
      </footer>
    </div>
  );
}
