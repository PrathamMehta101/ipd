import React, { useState, useRef } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const SEVERITIES = ['Major Damage', 'Minor Damage', 'Total Loss', 'Trivial Damage'];
const TYPES      = ['Multi-vehicle Collision', 'Parked Car', 'Single Vehicle Collision', 'Vehicle Theft'];
const HOBBIES    = [
  'base-jumping','basketball','board-games','bungie-jumping','camping','chess',
  'cross-fit','dancing','exercise','golf','hiking','kayaking','movies',
  'paintball','polo','reading','skydiving','sleeping','video-games','yachting',
];

const PRESETS = [
  {
    name: 'Ring A — G-001', isFraud: true,
    data: {
      incident_severity: 'Major Damage', incident_type: 'Multi-vehicle Collision',
      total_claim_amount: '84200', vehicle_claim: '64100',
      policy_annual_premium: '1380.00', umbrella_limit: '0',
      insured_hobbies: 'skydiving', incident_city: 'Columbus',
      incident_date: '2015-02-14', policy_state: 'OH',
      garage_id: 'G-001', claimant_id: 'CLM-A1',
      incident_description: 'I was stationary at the intersection sipping my morning coffee when another vehicle impacted my rear bumper with unbelievable violence. It was 100% not my fault whatsoever, completely unpreventable. The car was totally demolished and obliterated.',
    },
  },
  {
    name: 'Ring B — G-002', isFraud: true,
    data: {
      incident_severity: 'Total Loss', incident_type: 'Multi-vehicle Collision',
      total_claim_amount: '98500', vehicle_claim: '78900',
      policy_annual_premium: '1720.00', umbrella_limit: '6000000',
      insured_hobbies: 'base-jumping', incident_city: 'Arlington',
      incident_date: '2015-02-18', policy_state: 'IL',
      garage_id: 'G-002', claimant_id: 'CLM-B1',
      incident_description: 'The vehicle was forced off the roadway in an unavoidable collision during severe traffic. Catastrophic structural damage was sustained to the entire chassis, rendering it completely totaled beyond any repair.',
    },
  },
  {
    name: 'Serial Claimant — CLM-C1', isFraud: true,
    data: {
      incident_severity: 'Major Damage', incident_type: 'Single Vehicle Collision',
      total_claim_amount: '91000', vehicle_claim: '72000',
      policy_annual_premium: '1650.00', umbrella_limit: '5000000',
      insured_hobbies: 'polo', incident_city: 'Northbend',
      incident_date: '2015-03-02', policy_state: 'NY',
      garage_id: 'G-005', claimant_id: 'CLM-C1',
      incident_description: 'Collision occurred late at night while driving home. The car was contacted by an unknown barrier and extensive destruction was sustained across all panels.',
    },
  },
  {
    name: 'Legitimate Claim', isFraud: false,
    data: {
      incident_severity: 'Minor Damage', incident_type: 'Parked Car',
      total_claim_amount: '6200', vehicle_claim: '4100',
      policy_annual_premium: '1120.00', umbrella_limit: '0',
      insured_hobbies: 'reading', incident_city: 'Columbus',
      incident_date: '2015-03-10', policy_state: 'OH',
      garage_id: 'G-099', claimant_id: 'CLM-Z9',
      incident_description: 'I was parking outside a bakery at around 5 mph when my right front bumper scraped a concrete bollard. I stopped immediately and backed up. Only minor paint scrape and plastic scuff occurred.',
    },
  },
];

const DEFAULT_FORM = {
  incident_severity: 'Major Damage', incident_type: 'Multi-vehicle Collision',
  total_claim_amount: '', vehicle_claim: '', policy_annual_premium: '',
  umbrella_limit: '0', insured_hobbies: 'skydiving',
  incident_city: '', incident_date: '', policy_state: '',
  garage_id: '', claimant_id: '', incident_description: '',
};

export default function UnifiedClaimStudio({
  files, setFiles,
  onAnalyzeStart, onAnalyzeComplete, onAnalyzeError,
  isProcessing, onSampleAdd,
}) {
  const fileRef = useRef(null);
  const estimateRef = useRef(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [estimateFile, setEstimateFile] = useState(null);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const attachSampleEstimate = () => {
    const sampleInvoice = `PRELIMINARY BODY SHOP REPAIR ESTIMATE
Facility: Premier Collision Center (G-001) - Certified Auto Body
Claimant File: CLM-A1 | Vehicle: 2018 Sedan
--------------------------------------------------------------------------------
LINE ITEM DESCRIPTION                       HOURS   RATE ($)   PARTS ($)   TOTAL ($)
1. R&I Front Bumper Cover & Grille           8.5     115.00      780.00    1,757.50
2. Hood Outer Shell Replacement & Align      6.2     110.00    1,250.00    1,932.00
3. Headlamp Assembly LED Passenger Side      2.5     110.00      890.00    1,165.00
4. Radiator Support & Condenser Overhaul     7.0     115.00      920.00    1,725.00
5. Rear Quarter Panel Glass Seal (Unrelated) 3.5     115.00      480.00      882.50
6. Structural Frame Pull & Laser Measuring   5.0     125.00        0.00      625.00
--------------------------------------------------------------------------------
SUBTOTAL LABOR & PARTS:                                                   $8,087.00
STATE HAZMAT & SHOP DISPOSAL SUPPLIES:                                      $240.00
TOTAL AUDITED REPAIR ESTIMATE:                                            $8,327.00`;
    const f = new File([sampleInvoice], 'body_shop_estimate_g001.txt', { type: 'text/plain' });
    setEstimateFile(f);
  };

  const applyPreset = preset => {
    setForm(preset.data);
    if (preset.isFraud && !estimateFile) {
      attachSampleEstimate();
    }
    if (files.length === 0 && onSampleAdd) onSampleAdd(preset.isFraud);
  };

  const addFiles = newFs => setFiles(prev => {
    const upd = [...prev];
    newFs.forEach(f => { if (!upd.some(sf => sf.name === f.name && sf.size === f.size)) upd.push(f); });
    return upd;
  });

  const handleDrop = e => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (isProcessing) return;
    onAnalyzeStart?.();
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      if (estimateFile) {
        fd.append('estimate_file', estimateFile);
      }
      Object.entries(form).forEach(([k, v]) => fd.append(k, v || ''));
      const res = await fetch(`${API_BASE}/api/unified-analyze`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Error ${res.status}`); }
      const data = await res.json();
      onAnalyzeComplete?.(data, form);
    } catch (err) {
      onAnalyzeError?.(err.message);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="ph">
        <span className="ph-label">Claim Intake</span>
        <h1 className="ph-title">Submit a <em>Claim</em> for Analysis</h1>
        <p className="ph-sub">
          Provide accident photos, repair invoices, and policy details. The AI pipeline evaluates visual, tampering, tabular, network, and linguistic signals simultaneously.
        </p>
      </div>

      {/* Quick scenarios */}
      <div className="presets-bar">
        <span className="presets-lbl">Scenarios</span>
        {PRESETS.map(p => (
          <button
            key={p.name}
            type="button"
            className={`preset-pill ${p.isFraud ? 'preset-fraud' : 'preset-ok'}`}
            onClick={() => applyPreset(p)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '1rem', alignItems: 'start' }}>

          {/* ── Left: image & estimate upload ── */}
          <div className="card">
            <span className="card-label">Accident Photos</span>

            <div
              className="drop-zone"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <div className="drop-zone-icon">📷</div>
              <div className="drop-zone-title">Drop images here or click to browse</div>
              <div className="drop-zone-sub">JPEG, PNG, WEBP — multiple files allowed</div>
            </div>
            <input
              ref={fileRef}
              type="file" multiple accept="image/*"
              className="file-input"
              onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = ''; }}
            />

            {files.length > 0 && (
              <div className="thumb-grid">
                {files.map((f, i) => (
                  <div className="thumb" key={i}>
                    <img src={URL.createObjectURL(f)} alt={f.name} />
                    <button className="thumb-rm" type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Garage Estimate Invoice Upload (Layer 2) */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span className="card-label" style={{ margin: 0 }}>Repair Invoice / Estimate</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.62rem', padding: '0.2rem 0.5rem' }}
                  onClick={attachSampleEstimate}
                >
                  + Sample Padded Invoice
                </button>
              </div>

              {!estimateFile ? (
                <div
                  className="drop-zone"
                  style={{ padding: '0.8rem', minHeight: 'auto', background: 'rgba(59,130,246,0.02)', borderColor: 'rgba(59,130,246,0.18)' }}
                  onClick={() => estimateRef.current?.click()}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.15rem' }}>📄 Upload Garage Invoice (PDF / Photo / TXT)</div>
                  <div className="drop-zone-sub" style={{ fontSize: '0.62rem' }}>Automatic OCR line-item audit vs OEM labor benchmarks</div>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', background: 'var(--bg-raised)', border: '1px solid var(--border-blue)',
                  borderRadius: 'var(--r-md)', fontSize: '0.72rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📑</span>
                    <div>
                      <div style={{ color: 'var(--txt-hi)', fontWeight: 500 }}>{estimateFile.name}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--txt-lo)', fontFamily: 'var(--mono)' }}>{(estimateFile.size / 1024).toFixed(1)} KB · Ready for OCR Audit</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem' }}
                    onClick={() => setEstimateFile(null)}
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                ref={estimateRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                className="file-input"
                onChange={e => {
                  if (e.target.files?.[0]) setEstimateFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
              <div className="sec-label">FNOL Statement</div>
              <div className="field">
                <textarea
                  name="incident_description"
                  value={form.incident_description}
                  onChange={set}
                  placeholder="Describe the incident in the claimant's own words…"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* ── Right: policy form ── */}
          <div className="card">
            <span className="card-label">Policy & Incident Details</span>

            <div className="sec-label">Incident</div>
            <div className="g2" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Severity</label>
                <select name="incident_severity" value={form.incident_severity} onChange={set}>
                  {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <select name="incident_type" value={form.incident_type} onChange={set}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" name="incident_date" value={form.incident_date} onChange={set} />
              </div>
              <div className="field">
                <label>City</label>
                <input type="text" name="incident_city" value={form.incident_city} onChange={set} placeholder="Columbus" />
              </div>
            </div>

            <div className="sec-label">Financials</div>
            <div className="g2" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Total Claim ($)</label>
                <input type="number" name="total_claim_amount" value={form.total_claim_amount} onChange={set} placeholder="84200" />
              </div>
              <div className="field">
                <label>Vehicle Claim ($)</label>
                <input type="number" name="vehicle_claim" value={form.vehicle_claim} onChange={set} placeholder="64100" />
              </div>
              <div className="field">
                <label>Annual Premium ($)</label>
                <input type="number" name="policy_annual_premium" value={form.policy_annual_premium} onChange={set} placeholder="1380" />
              </div>
              <div className="field">
                <label>Umbrella Limit ($)</label>
                <input type="number" name="umbrella_limit" value={form.umbrella_limit} onChange={set} placeholder="0" />
              </div>
            </div>

            <div className="sec-label">Entity IDs</div>
            <div className="g2" style={{ marginBottom: '0.75rem' }}>
              <div className="field">
                <label>Garage ID</label>
                <input type="text" name="garage_id" value={form.garage_id} onChange={set} placeholder="G-001" />
              </div>
              <div className="field">
                <label>Claimant ID</label>
                <input type="text" name="claimant_id" value={form.claimant_id} onChange={set} placeholder="CLM-A1" />
              </div>
              <div className="field">
                <label>Policy State</label>
                <input type="text" name="policy_state" value={form.policy_state} onChange={set} placeholder="OH" />
              </div>
              <div className="field">
                <label>Hobbies</label>
                <select name="insured_hobbies" value={form.insured_hobbies} onChange={set}>
                  {HOBBIES.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={isProcessing}
              style={{ marginTop: '0.5rem' }}
            >
              {isProcessing ? '⟳ Running Analysis…' : 'Run AI Fraud Analysis'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
