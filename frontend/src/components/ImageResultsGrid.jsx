import React from 'react';

export default function ImageResultsGrid({ imageResults, files }) {
  if (!imageResults || imageResults.length === 0) return null;

  return (
    <div className="breakdown-container glass-panel">
      <div className="breakdown-header">
        <h3><i className="fa-solid fa-layer-group"></i> Image-by-Image Preprocessing & Neural Net Output</h3>
      </div>
      <div className="image-results-grid">
        {imageResults.map((result, idx) => {
          const fileObj = files[idx] || files[0];
          const isFraud = result.prediction.predicted_class === 'Fraud';
          const score = result.prediction.fraud_score;
          const badgeClass = score >= 65 ? 'risk-badge HIGH' : (score >= 30 ? 'risk-badge MEDIUM' : 'risk-badge LOW');
          const previewSrc = fileObj ? URL.createObjectURL(fileObj) : '';

          return (
            <div key={`${result.filename}-${idx}`} className="image-result-card">
              <div className="result-img-wrapper">
                <img src={previewSrc} alt={result.filename} />
                <span className={`${badgeClass} result-badge`}>{result.prediction.predicted_class}</span>
              </div>

              <div className="result-body">
                <div className="result-filename" title={result.filename}>{result.filename}</div>

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
                  <span>ImageNet Standardization:</span>
                  <span className="forensic-val">&mu;=[0.485,0.456,0.406]</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
