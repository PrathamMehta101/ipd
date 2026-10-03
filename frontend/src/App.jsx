import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import UploadZone from './components/UploadZone';
import PipelineVisualizer from './components/PipelineVisualizer';
import DashboardResults from './components/DashboardResults';
import ImageResultsGrid from './components/ImageResultsGrid';
import XGBoostPredictor from './components/XGBoostPredictor';
import FraudRingGraph from './components/FraudRingGraph';
import ClaimsHistory from './components/ClaimsHistory';
import TriModalFraudReport from './components/TriModalFraudReport';

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
  const [files, setFiles]                 = useState([]);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [pipelineStep, setPipelineStep]   = useState(0);
  const [pipelineStatusText, setPipelineStatusText] = useState('');
  const [results, setResults]             = useState(null);
  const [triModalReport, setTriModalReport] = useState(null);
  const [historyKey, setHistoryKey]       = useState(0);

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

  const handleAnalyze = async () => {
    if (!files.length) return;
    setResults(null);
    setIsProcessing(true);
    for (let step = 1; step <= 6; step++) {
      setPipelineStep(step);
      setPipelineStatusText(`Executing Step ${step} of 6...`);
      await new Promise(r => setTimeout(r, 220));
    }
    setPipelineStatusText('Running ResNet50 Neural Network...');
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setResults(data);

      const cnnScore = data.summary?.highest_fraud_score ?? data.image_results?.[0]?.prediction?.fraud_score ?? 75;
      // If a tri-modal report is already present or to initialize one:
      setTriModalReport(prev => {
        if (!prev) {
          return {
            id: 'IMAGE-REF',
            timestamp: new Date().toISOString(),
            cnn: { fraud_score: cnnScore, analyzed: true },
            xgboost: { fraud_score: 45, risk_level: 'MEDIUM', recommendation_label: 'Awaiting tabular submission' },
            gnn: { fraud_ring_score: 20, ring_risk_level: 'LOW', network_flags: [] },
            composite: {
              score: Math.round(cnnScore * 0.5 + 30),
              risk_level: cnnScore >= 60 ? 'HIGH' : 'MEDIUM',
              verdict: cnnScore >= 60 ? 'HIGH_RISK' : 'MODERATE_RISK',
              recommendation_label: 'Visual analysis complete. Submit claim form below for GNN ring detection.'
            }
          };
        }
        const updatedComp = Math.round(0.35 * (prev.xgboost?.fraud_score || 50) + 0.45 * (prev.gnn?.fraud_ring_score || 50) + 0.20 * cnnScore);
        return {
          ...prev,
          cnn: { fraud_score: cnnScore, analyzed: true },
          composite: {
            ...prev.composite,
            score: updatedComp,
          }
        };
      });
    } catch (err) {
      alert(`Analysis Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const cnnScore = results
    ? (results.summary?.highest_fraud_score ?? results.image_results?.[0]?.prediction?.fraud_score ?? null)
    : null;

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
          <UploadZone files={files} setFiles={setFiles} onAnalyze={handleAnalyze} onSampleAdd={handleSampleAdd} />
          
          <XGBoostPredictor
            cnnScore={cnnScore}
            onPredict={(predData) => {
              handlePredictComplete();
              setTriModalReport(predData);
            }}
          />

          {isProcessing && <PipelineVisualizer currentStep={pipelineStep} statusText={pipelineStatusText} />}

          {/* ── Unified Tri-Modal Report (CNN + XGBoost + GNN) ── */}
          {triModalReport && (
            <TriModalFraudReport
              data={triModalReport}
              onSwitchToGraph={() => setActiveTab('graph')}
            />
          )}

          {results && (
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
          <FraudRingGraph refreshKey={historyKey} />
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
