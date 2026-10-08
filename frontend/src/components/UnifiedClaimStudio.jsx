import React, { useState, useRef } from "react";

const API_BASE = "http://127.0.0.1:8000";

const INCIDENT_SEVERITIES = [
  "Major Damage",
  "Minor Damage",
  "Total Loss",
  "Trivial Damage",
];
const INCIDENT_TYPES = [
  "Multi-vehicle Collision",
  "Parked Car",
  "Single Vehicle Collision",
  "Vehicle Theft",
];
const HOBBIES = [
  "base-jumping",
  "basketball",
  "board-games",
  "bungie-jumping",
  "camping",
  "chess",
  "cross-fit",
  "dancing",
  "exercise",
  "golf",
  "hiking",
  "kayaking",
  "movies",
  "paintball",
  "polo",
  "reading",
  "skydiving",
  "sleeping",
  "video-games",
  "yachting",
];

const PRESETS = [
  {
    name: "Ring A (Garage G-001)",
    desc: "Columbus collision ring routed to G-001 with CLM-A1",
    isFraud: true,
    data: {
      incident_severity: "Major Damage",
      incident_type: "Multi-vehicle Collision",
      total_claim_amount: "84200",
      vehicle_claim: "64100",
      policy_annual_premium: "1380.00",
      umbrella_limit: "0",
      insured_hobbies: "skydiving",
      incident_city: "Columbus",
      incident_date: "2015-02-14",
      policy_state: "OH",
      garage_id: "G-001",
      claimant_id: "CLM-A1",
    },
  },
  {
    name: "Ring B (Garage G-002)",
    desc: "Arlington total loss syndicate routed to G-002",
    isFraud: true,
    data: {
      incident_severity: "Total Loss",
      incident_type: "Multi-vehicle Collision",
      total_claim_amount: "98500",
      vehicle_claim: "78900",
      policy_annual_premium: "1720.00",
      umbrella_limit: "6000000",
      insured_hobbies: "base-jumping",
      incident_city: "Arlington",
      incident_date: "2015-02-18",
      policy_state: "IL",
      garage_id: "G-002",
      claimant_id: "CLM-B1",
    },
  },
  {
    name: "Serial Claimant (CLM-C1)",
    desc: "Staged single vehicle claim in Northbend",
    isFraud: true,
    data: {
      incident_severity: "Major Damage",
      incident_type: "Single Vehicle Collision",
      total_claim_amount: "91000",
      vehicle_claim: "72000",
      policy_annual_premium: "1650.00",
      umbrella_limit: "5000000",
      insured_hobbies: "polo",
      incident_city: "Northbend",
      incident_date: "2015-03-02",
      policy_state: "NY",
      garage_id: "G-005",
      claimant_id: "CLM-C1",
    },
  },
  {
    name: "Legitimate Claim (Clean)",
    desc: "Low severity parking accident with isolated entities",
    isFraud: false,
    data: {
      incident_severity: "Minor Damage",
      incident_type: "Parked Car",
      total_claim_amount: "6200",
      vehicle_claim: "4100",
      policy_annual_premium: "1120.00",
      umbrella_limit: "0",
      insured_hobbies: "reading",
      incident_city: "Columbus",
      incident_date: "2015-03-10",
      policy_state: "OH",
      garage_id: "G-099",
      claimant_id: "CLM-Z9",
    },
  },
];

export default function UnifiedClaimStudio({
  files,
  setFiles,
  onAnalyzeStart,
  onAnalyzeComplete,
  onAnalyzeError,
  isProcessing,
  onSampleAdd,
}) {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    incident_severity: "Major Damage",
    total_claim_amount: "84200",
    insured_hobbies: "skydiving",
    vehicle_claim: "64100",
    incident_type: "Multi-vehicle Collision",
    umbrella_limit: "0",
    policy_annual_premium: "1380.00",
    incident_city: "Columbus",
    incident_date: "2015-02-14",
    policy_state: "OH",
    garage_id: "G-001",
    claimant_id: "CLM-A1",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyPreset = (preset) => {
    setForm(preset.data);
    if (files.length === 0 && onSampleAdd) {
      onSampleAdd(preset.isFraud);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
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
    e.target.value = "";
  };

  const addFiles = (newFiles) => {
    setFiles((prev) => {
      const updated = [...prev];
      newFiles.forEach((f) => {
        if (!updated.some((sf) => sf.name === f.name && sf.size === f.size)) {
          updated.push(f);
        }
      });
      return updated;
    });
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMasterSubmit = async (e) => {
    e.preventDefault();
    if (isProcessing) return;

    if (onAnalyzeStart) onAnalyzeStart();

    try {
      const formData = new FormData();
      // 1. Append files for CNN
      files.forEach((f) => {
        formData.append("files", f);
      });

      // 2. Append tabular & entity fields for XGBoost & GNN
      formData.append("incident_severity", form.incident_severity);
      formData.append("total_claim_amount", form.total_claim_amount || "0");
      formData.append("insured_hobbies", form.insured_hobbies);
      formData.append("vehicle_claim", form.vehicle_claim || "0");
      formData.append("incident_type", form.incident_type);
      formData.append("umbrella_limit", form.umbrella_limit || "0");
      formData.append(
        "policy_annual_premium",
        form.policy_annual_premium || "0",
      );
      formData.append("incident_city", form.incident_city || "");
      formData.append("incident_date", form.incident_date || "");
      formData.append("policy_state", form.policy_state || "");
      formData.append("garage_id", form.garage_id || "");
      formData.append("claimant_id", form.claimant_id || "");

      const res = await fetch(`${API_BASE}/api/unified-analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || `Server responded with status ${res.status}`,
        );
      }

      const data = await res.json();
      if (onAnalyzeComplete) {
        onAnalyzeComplete(data, form);
      }
    } catch (err) {
      if (onAnalyzeError) {
        onAnalyzeError(err.message);
      } else {
        alert(`Analysis Error: ${err.message}`);
      }
    }
  };

  return (
    <section
      className="glass-panel"
      style={{
        padding: "2rem",
        borderRadius: "var(--radius-lg)",
        marginBottom: "2rem",
        border: "1px solid var(--bg-card-border)",
        background: "rgba(16, 23, 39, 0.78)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: "1.4rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.3rem 0.8rem",
            borderRadius: "99px",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            color: "#c7d2fe",
            fontSize: "0.75rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "0.6rem",
          }}
        >
          ⚡ Unified Multi-Modal AI Intake Studio
        </div>
        <h2
          style={{
            fontSize: "1.8rem",
            fontWeight: 800,
            color: "#f8fafc",
            margin: 0,
          }}
        >
          Tri-Modal Claim Investigation
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.92rem",
            marginTop: "0.4rem",
            maxWidth: "850px",
          }}
        >
          Upload accident photos and provide policy details. A{" "}
          <strong>single click</strong> automatically coordinates{" "}
          <strong>ResNet50 Computer Vision</strong>,{" "}
          <strong>XGBoost Tabular Anomaly Detection</strong>, and{" "}
          <strong>GNN Fraud Ring Message Passing</strong>.
        </p>
      </div>

      {/* ── Preset Test Bar ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "1.8rem",
          padding: "0.8rem 1rem",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}
        >
          ⚡ QUICK DEMO SCENARIOS:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            style={{
              padding: "0.35rem 0.8rem",
              fontSize: "0.78rem",
              fontWeight: 700,
              background: p.isFraud
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${p.isFraud ? "rgba(239, 68, 68, 0.35)" : "rgba(16, 185, 129, 0.35)"}`,
              borderRadius: "99px",
              color: p.isFraud ? "#fca5a5" : "#86efac",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={p.desc}
          >
            {p.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleMasterSubmit}>
        {/* ── Two Columns: Left = Images (CNN), Right = Form (XGBoost + GNN) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "1.8rem",
            alignItems: "start",
          }}
        >
          {/* ════ LEFT COLUMN: ACCIDENT IMAGES (CNN) ════ */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "var(--radius-md)",
              padding: "1.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span style={{ fontSize: "1.2rem" }}>🖼️</span>
                <div>
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      margin: 0,
                      color: "#f8fafc",
                    }}
                  >
                    Accident Photos
                  </h3>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#60a5fa",
                      fontWeight: 700,
                    }}
                  >
                    ANALYZED BY RESNET50 CNN
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                  onClick={() => onSampleAdd(true)}
                >
                  + Fraud Photo
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                  onClick={() => onSampleAdd(false)}
                >
                  + Authentic Photo
                </button>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              className="drop-zone"
              style={{
                padding: "1.8rem 1rem",
                minHeight: "140px",
                cursor: "pointer",
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                className="file-input"
                onChange={handleFileChange}
              />
              <div className="drop-zone-content">
                <div
                  className="upload-icon-pulse"
                  style={{
                    width: "42px",
                    height: "42px",
                    fontSize: "1.2rem",
                    margin: "0 auto 0.6rem auto",
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <h4 style={{ fontSize: "0.95rem", margin: 0 }}>
                  Drag &amp; drop photos or browse
                </h4>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-dim)",
                    margin: "0.2rem 0 0 0",
                  }}
                >
                  PNG, JPG, WEBP • Automated EXIF extraction &amp; duplicate
                  hashing
                </p>
              </div>
            </div>

            {/* Image Previews */}
            {files.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.6rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Attached Photos ({files.length}):</span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    Clear All
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))",
                    gap: "0.6rem",
                    maxHeight: "180px",
                    overflowY: "auto",
                    paddingRight: "0.2rem",
                  }}
                >
                  {files.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      style={{
                        position: "relative",
                        borderRadius: "6px",
                        overflow: "hidden",
                        aspectRatio: "1",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          background: "rgba(0,0,0,0.7)",
                          border: "none",
                          color: "#fff",
                          borderRadius: "50%",
                          width: "18px",
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════ RIGHT COLUMN: TABULAR & GNN ENTITY DATA ════ */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "var(--radius-md)",
              padding: "1.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span style={{ fontSize: "1.2rem" }}>🧠</span>
              <div>
                <h3
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    margin: 0,
                    color: "#f8fafc",
                  }}
                >
                  Claim Details &amp; Network Entities
                </h3>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "#a78bfa",
                    fontWeight: 700,
                  }}
                >
                  ANALYZED BY XGBOOST (TABULAR) &amp; GNN (FRAUD RING)
                </span>
              </div>
            </div>

            {/* Severity & Type */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="incident_severity">Incident Severity</label>
                <select
                  id="incident_severity"
                  name="incident_severity"
                  value={form.incident_severity}
                  onChange={handleChange}
                >
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="incident_type">Incident Type</label>
                <select
                  id="incident_type"
                  name="incident_type"
                  value={form.incident_type}
                  onChange={handleChange}
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amounts */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="total_claim_amount">
                  Total Claim Amount ($)
                </label>
                <input
                  type="number"
                  id="total_claim_amount"
                  name="total_claim_amount"
                  value={form.total_claim_amount}
                  onChange={handleChange}
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="vehicle_claim">Vehicle Claim ($)</label>
                <input
                  type="number"
                  id="vehicle_claim"
                  name="vehicle_claim"
                  value={form.vehicle_claim}
                  onChange={handleChange}
                  min="0"
                  required
                />
              </div>
            </div>

            {/* Premium & Umbrella */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="policy_annual_premium">
                  Annual Premium ($)
                </label>
                <input
                  type="number"
                  id="policy_annual_premium"
                  name="policy_annual_premium"
                  value={form.policy_annual_premium}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="umbrella_limit">Umbrella Limit ($)</label>
                <input
                  type="number"
                  id="umbrella_limit"
                  name="umbrella_limit"
                  value={form.umbrella_limit}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Hobbies */}
            <div className="form-row form-row--single">
              <div className="form-group">
                <label htmlFor="insured_hobbies">Insured Hobbies</label>
                <select
                  id="insured_hobbies"
                  name="insured_hobbies"
                  value={form.insured_hobbies}
                  onChange={handleChange}
                >
                  {HOBBIES.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Network Entities (GNN Specific) ── */}
            <div
              style={{
                background: "rgba(245, 158, 11, 0.06)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                borderRadius: "8px",
                padding: "0.8rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "#fbbf24",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>🕸️</span> GNN Network Collusion Identifiers
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="garage_id" style={{ color: "#fde68a" }}>
                    🏪 Garage ID (Repair Shop)
                  </label>
                  <input
                    type="text"
                    id="garage_id"
                    name="garage_id"
                    placeholder="e.g. G-001 or G-002"
                    value={form.garage_id}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="claimant_id" style={{ color: "#fde68a" }}>
                    👤 Claimant ID
                  </label>
                  <input
                    type="text"
                    id="claimant_id"
                    name="claimant_id"
                    placeholder="e.g. CLM-A1 or CLM-B1"
                    value={form.claimant_id}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="incident_city">📍 Incident City</label>
                  <input
                    type="text"
                    id="incident_city"
                    name="incident_city"
                    placeholder="e.g. Columbus"
                    value={form.incident_city}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="policy_state">State</label>
                  <select
                    id="policy_state"
                    name="policy_state"
                    value={form.policy_state}
                    onChange={handleChange}
                  >
                    <option value="">— Select State —</option>
                    {[
                      "AL",
                      "AK",
                      "AZ",
                      "AR",
                      "CA",
                      "CO",
                      "CT",
                      "DE",
                      "FL",
                      "GA",
                      "HI",
                      "ID",
                      "IL",
                      "IN",
                      "IA",
                      "KS",
                      "KY",
                      "LA",
                      "ME",
                      "MD",
                      "MA",
                      "MI",
                      "MN",
                      "MS",
                      "MO",
                      "MT",
                      "NE",
                      "NV",
                      "NH",
                      "NJ",
                      "NM",
                      "NY",
                      "NC",
                      "ND",
                      "OH",
                      "OK",
                      "OR",
                      "PA",
                      "RI",
                      "SC",
                      "SD",
                      "TN",
                      "TX",
                      "UT",
                      "VT",
                      "VA",
                      "WA",
                      "WV",
                      "WI",
                      "WY",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════ THE ONE MASTER BUTTON ════ */}
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button
            type="submit"
            disabled={isProcessing}
            id="unified-analyze-master-btn"
            style={{
              width: "100%",
              maxWidth: "750px",
              padding: "1.2rem 2.4rem",
              fontSize: "1.15rem",
              fontWeight: 800,
              borderRadius: "99px",
              background:
                "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              border: "none",
              color: "#ffffff",
              boxShadow: "0 10px 30px -5px rgba(99, 102, 241, 0.5)",
              cursor: isProcessing ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
            }}
          >
            {isProcessing ? (
              <span
                style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
              >
                <span className="spinner-ring" /> Running ResNet50 CNN + XGBoost
                + GNN Models...
              </span>
            ) : (
              <>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "1.25rem",
                  }}
                >
                  <span>⚡</span> Run Complete Tri-Modal AI Analysis (CNN +
                  XGBoost + GNN)
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    opacity: 0.88,
                    fontWeight: 500,
                  }}
                >
                  {files.length > 0
                    ? `Pipes ${files.length} accident photo(s) to CNN ResNet50 · Tabular features to XGBoost · Network entities to GNN`
                    : "Pipes tabular features to XGBoost · Network entities to GNN Fraud Ring"}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
