import React, { useState } from 'react';

export default function ImageResultsGrid({ imageResults, files }) {
  const [viewModes, setViewModes] = useState({}); // { [idx]: 'overlay' | 'heatmap' | 'original' }

  if (!imageResults || imageResults.length === 0) return null;

  const setCardMode = (idx, mode) => {
    setViewModes(prev => ({ ...prev, [idx]: mode }));
  };

  return (
    <div className="breakdown-container glass-panel">
      <div className="breakdown-header">
        <h3><i className="fa-solid fa-layer-group"></i> Image Preprocessing, ResNet50 Inference &amp; Grad-CAM Saliency</h3>
      </div>
      <div className="image-results-grid">
        {imageResults.map((result, idx) => {
          const fileObj = files[idx] || files[0];
          const isFraud = result.prediction.predicted_class === 'Fraud';
          const score = result.prediction.fraud_score;
          const badgeClass = score >= 65 ? 'risk-badge HIGH' : (score >= 30 ? 'risk-badge MEDIUM' : 'risk-badge LOW');
          const previewSrc = fileObj ? URL.createObjectURL(fileObj) : '';
          const gradcam = result.gradcam;
          const hasCam = gradcam && gradcam.available;
          const currentMode = viewModes[idx] || (hasCam ? 'overlay' : 'original');

          let displayedSrc = previewSrc;
          if (hasCam) {
            if (currentMode === 'overlay' && gradcam.overlay_base64) {
              displayedSrc = gradcam.overlay_base64;
            } else if (currentMode === 'heatmap' && gradcam.heatmap_base64) {
              displayedSrc = gradcam.heatmap_base64;
            }
          }

          return (
            <div key={`${result.filename}-${idx}`} className="image-result-card">
              <div className="result-img-wrapper">
                <img src={displayedSrc} alt={result.filename} />
                <span className={`${badgeClass} result-badge`}>{result.prediction.predicted_class}</span>

                {hasCam && (
                  <div className="card-cam-switch">
                    <button
                      type="button"
                      className={`cam-mode-btn ${currentMode === 'original' ? 'active' : ''}`}
                      onClick={() => setCardMode(idx, 'original')}
                      title="Original Photo"
                    >
                      Photo
                    </button>
                    <button
                      type="button"
                      className={`cam-mode-btn ${currentMode === 'heatmap' ? 'active' : ''}`}
                      onClick={() => setCardMode(idx, 'heatmap')}
                      title="Attention Heatmap"
                    >
                      Heatmap
                    </button>
                    <button
                      type="button"
                      className={`cam-mode-btn ${currentMode === 'overlay' ? 'active' : ''}`}
                      onClick={() => setCardMode(idx, 'overlay')}
                      title="Grad-CAM Neural Overlay"
                    >
                      Grad-CAM
                    </button>
                  </div>
                )}
              </div>

              <div className="result-body">
                <div className="result-filename" title={result.filename}>{result.filename}</div>

                {hasCam && (
                  <div className="card-cam-hotspot">
                    <span className="cam-hotspot-label">Focus:</span>
                    <span className="cam-hotspot-val">🎯 {gradcam.focus_region}</span>
                    <span className="cam-hotspot-pct">({gradcam.peak_activation_pct}%)</span>
                  </div>
                )}

                <div className="prob-bar-wrapper">
                  <div className="prob-labels">
                    <span>Fraud Confidence</span>
                    <span className={isFraud ? 'text-danger' : 'text-success'}>{score.toFixed(1)}%</span>
                  </div>
                  <div className="prob-track">
                    <div 
                      className="prob-fill" 
                      style={{ 
                        width: `${score}%`, 
                        background: isFraud ? 'var(--color-danger)' : 'var(--color-success)' 
                      }}
                    ></div>
                  </div>
                </div>

                <div className="forensic-tags">
                  <span className="tag"><i className="fa-solid fa-arrows-left-right"></i> {result.processed_dimensions}</span>
                  <span className="tag"><i className="fa-solid fa-palette"></i> RGB</span>
                  <span className="tag"><i className="fa-solid fa-clock"></i> {result.processing_time_ms} ms</span>
                  <span className="tag"><i className="fa-solid fa-fingerprint"></i> {result.forensics.perceptual_hash.substring(0, 8)}...</span>
                </div>
              </div>

              <div className="forensic-drawer">
                <div className="forensic-line">
                  <span>EXIF Orientation:</span>
                  <span className="forensic-val">{result.forensics.orientation_corrected ? 'Yes (Auto-Rotated)' : 'Original Angle'}</span>
                </div>
                <div className="forensic-line">
                  <span>Perceptual Hash (pHash):</span>
                  <span className="forensic-val">{result.forensics.perceptual_hash}</span>
                </div>
                <div className="forensic-line">
                  <span>Grad-CAM Target Layer:</span>
                  <span className="forensic-val">ResNet50 layer4[-1]</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

