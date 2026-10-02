import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import UploadZone from './components/UploadZone';
import PipelineVisualizer from './components/PipelineVisualizer';
import DashboardResults from './components/DashboardResults';
import ImageResultsGrid from './components/ImageResultsGrid';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [backendStatus, setBackendStatus] = useState({ online: false, device: 'cpu', classes: [] });
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineStatusText, setPipelineStatusText] = useState('');
  const [results, setResults] = useState(null);

  // Check Backend Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus({ online: true, device: data.device, classes: data.classes });
        }
      } catch (err) {
        setBackendStatus({ online: false, device: 'cpu', classes: [] });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 4000);
    return () => clearInterval(interval);
  }, []);

  // Demo Sample Generator
  const handleSampleAdd = (isFraud) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    if (isFraud) {
      // Simulate Fraud / Duplicate Photo Claim
      const grad = ctx.createLinearGradient(0, 0, 400, 300);
      grad.addColorStop(0, '#312e81');
      grad.addColorStop(0.5, '#4c0519');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 300);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(80, 100, 240, 120);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillText('SAMPLE CLAIM #9041 (FRAUD DEMO)', 30, 45);
      ctx.font = '12px JetBrains Mono, sans-serif';
      ctx.fillText('Recycled Vehicle Photo / Staged Claim', 30, 70);
    } else {
      // Authentic Collision Photo Sample
      const grad = ctx.createLinearGradient(0, 0, 400, 300);
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 300);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(60, 110, 280, 110);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(240, 130, 80, 70);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillText('SAMPLE CLAIM #1029 (AUTHENTIC ACCIDENT)', 30, 45);
      ctx.font = '12px JetBrains Mono, sans-serif';
      ctx.fillText('Real Frontal Impact Damage Photo', 30, 70);
    }

    canvas.toBlob((blob) => {
      const filename = isFraud ? 'sample_fraud_claim_photo.jpg' : 'sample_authentic_accident.jpg';
      const file = new File([blob], filename, { type: 'image/jpeg' });
      setFiles(prev => {
        if (!prev.some(sf => sf.name === file.name && sf.size === file.size)) {
          return [...prev, file];
        }
        return prev;
      });
    }, 'image/jpeg');
  };

  // Analyze Action
  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setResults(null);
    setIsProcessing(true);

    // Run 6-step visualizer animation
    for (let step = 1; step <= 6; step++) {
      setPipelineStep(step);
      setPipelineStatusText(`Executing Step ${step} of 6...`);
      await new Promise(r => setTimeout(r, 250));
    }

    setPipelineStatusText('Running ResNet50 Neural Network...');

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      alert(`Analysis Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <Header status={backendStatus} />
      
      <main className="main-content">
        <Hero />
        
        <UploadZone 
          files={files} 
          setFiles={setFiles} 
          onAnalyze={handleAnalyze} 
          onSampleAdd={handleSampleAdd} 
        />

        {isProcessing && (
          <PipelineVisualizer 
            currentStep={pipelineStep} 
            statusText={pipelineStatusText} 
          />
        )}

        {results && (
          <>
            <DashboardResults results={results} files={files} />
            <ImageResultsGrid imageResults={results.image_results} files={files} />
          </>
        )}
      </main>

      <footer className="footer">
        <p>AutoShield AI Fraud Detection System • Powered by React & PyTorch ResNet50 Backbone</p>
      </footer>
    </div>
  );
}
