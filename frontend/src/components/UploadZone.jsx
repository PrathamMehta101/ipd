import React, { useRef } from 'react';

export default function UploadZone({ files, setFiles, onAnalyze, onSampleAdd }) {
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      addFiles(droppedFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const addFiles = (newFiles) => {
    setFiles(prev => {
      const updated = [...prev];
      newFiles.forEach(f => {
        if (!updated.some(sf => sf.name === f.name && sf.size === f.size)) {
          updated.push(f);
        }
      });
      return updated;
    });
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <section className="upload-card glass-panel">
      <div className="card-header">
        <h2><i className="fa-solid fa-cloud-arrow-up"></i> Upload Accident Images</h2>
        <div className="sample-actions">
          <span className="sample-label">Quick Test:</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onSampleAdd(true)}>
            <i className="fa-solid fa-triangle-exclamation text-danger"></i> Load Fraud Demo
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onSampleAdd(false)}>
            <i className="fa-solid fa-circle-check text-success"></i> Load Authentic Demo
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div className="drop-zone" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => fileInputRef.current?.click()}>
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          accept="image/*" 
          className="file-input" 
          onChange={handleFileChange}
        />
        <div className="drop-zone-content">
          <div className="upload-icon-pulse">
            <i className="fa-solid fa-images"></i>
          </div>
          <h3>Drag & Drop Car Accident Photos Here</h3>
          <p>Supports PNG, JPG, JPEG, WEBP or HEIC images</p>
          <button type="button" className="btn btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            <i className="fa-solid fa-folder-open"></i> Browse Files
          </button>
        </div>
      </div>

      {/* Selected Files Preview Grid */}
      {files.length > 0 && (
        <div className="preview-container">
          <div className="preview-header">
            <h3>Selected Photos ({files.length})</h3>
            <button type="button" className="btn btn-text text-danger" onClick={() => setFiles([])}>
              <i className="fa-solid fa-trash-can"></i> Clear All
            </button>
          </div>
          <div className="preview-grid">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="preview-card">
                <img src={URL.createObjectURL(file)} alt={file.name} />
                <button type="button" className="preview-remove-btn" onClick={() => removeFile(idx)} title="Remove">
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="preview-name">{file.name}</div>
              </div>
            ))}
          </div>

          <div className="action-bar">
            <button type="button" className="btn btn-large btn-gradient" onClick={onAnalyze}>
              <i className="fa-solid fa-microchip"></i> Preprocess & Analyze Claim
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
