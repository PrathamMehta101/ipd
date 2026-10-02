import React from 'react';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-badge">
        <i className="fa-solid fa-brain"></i> ResNet50 Deep Learning Engine
      </div>
      <h1>Automated Car Accident <span className="gradient-text">Fraud Assessment</span></h1>
      <p className="hero-desc">
        Upload car damage photos for instant automated preprocessing, perceptual forensic hashing, and deep learning ResNet50 fraud scoring.
      </p>
    </section>
  );
}
