import React from 'react';

export default function PipelineVisualizer({ currentStep, statusText }) {
  const steps = [
    { id: 1, title: '1. Format Standardization', desc: 'Converting to uniform RGB matrix', icon: 'fa-file-export' },
    { id: 2, title: '2. EXIF Auto-Orientation', desc: 'Correcting image orientation tags', icon: 'fa-arrows-rotate' },
    { id: 3, title: '3. Spatial Normalization', desc: 'Resizing tensor to 224 × 224 px', icon: 'fa-crop-simple' },
    { id: 4, title: '4. ImageNet Standardization', desc: 'Mean & Std pixel normalization', icon: 'fa-sliders' },
    { id: 5, title: '5. Perceptual Forensics', desc: 'Generating pHash duplicate checks', icon: 'fa-fingerprint' },
    { id: 6, title: '6. ResNet50 Inference', desc: 'Softmax probability calculation', icon: 'fa-network-wired' }
  ];

  return (
    <section className="pipeline-section glass-panel">
      <div className="pipeline-header">
        <h3><i className="fa-solid fa-gears spinning"></i> Executing Preprocessing & CNN Pipeline</h3>
        <span className="pipeline-step-count">{statusText}</span>
      </div>
      <div className="pipeline-steps">
        {steps.map(s => {
          let stepClass = 'step-card';
          let checkIcon = <i className="fa-solid fa-clock"></i>;

          if (currentStep > s.id) {
            stepClass = 'step-card completed';
            checkIcon = <i className="fa-solid fa-check text-success"></i>;
          } else if (currentStep === s.id) {
            stepClass = 'step-card active';
            checkIcon = <i className="fa-solid fa-spinner fa-spin"></i>;
          }

          return (
            <div key={s.id} className={stepClass}>
              <div className="step-icon"><i className={`fa-solid ${s.icon}`}></i></div>
              <div className="step-info">
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
              <div className="step-check">{checkIcon}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
