import os
import io
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image, ImageOps, ExifTags
import imagehash
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import init_db, get_db, ClaimEntry

app = FastAPI(
    title="Car Insurance Fraud Detection API",
    description="AI-powered car accident image preprocessing & XGBoost tabular fraud detection API",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
CNN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "cnn-context", "car_fraud_resnet50.pth")
XGB_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "xgboost_claim_fraud.pkl")
GNN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "gnn_fraud_ring.pth")
GNN_ARTIFACTS_PATH = os.path.join(os.path.dirname(__file__), "models", "gnn_artifacts.pkl")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

cnn_model = None
xgb_artifacts = None
gnn_model = None
gnn_artifacts = None
class_names = ["Fraud", "Non-Fraud"]


# ─── GNN Architecture for Fraud Ring Detection ───────────────────────────────
class GraphConvLayer(nn.Module):
    def __init__(self, in_features, out_features, dropout=0.2):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features, bias=True)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, a_norm):
        h = self.linear(x)
        h = torch.matmul(a_norm, h)
        return self.dropout(F.relu(h))


class FraudRingGNN(nn.Module):
    def __init__(self, in_dim, hidden_dim=64, out_dim=32, dropout=0.25):
        super().__init__()
        self.gc1 = GraphConvLayer(in_dim, hidden_dim, dropout)
        self.gc2 = GraphConvLayer(hidden_dim, out_dim, dropout)
        self.classifier = nn.Sequential(
            nn.Linear(out_dim + in_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )

    def forward(self, x, a_norm):
        h1 = self.gc1(x, a_norm)
        h2 = self.gc2(h1, a_norm)
        combined = torch.cat([h2, x], dim=1)
        logits = self.classifier(combined)
        return logits.squeeze(-1), h2


# Image transform pipeline matching training validation transform exactly
inference_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def load_cnn_model():
    global cnn_model, class_names
    abs_path = os.path.abspath(CNN_MODEL_PATH)
    if not os.path.exists(abs_path):
        print(f"Warning: CNN model file not found at {abs_path}")
        return False
    
    try:
        print(f"Loading ResNet50 model from: {abs_path} on device {device}")
        checkpoint = torch.load(abs_path, map_location=device)
        
        if isinstance(checkpoint, dict) and 'class_names' in checkpoint:
            class_names = checkpoint['class_names']
        
        # Build ResNet50 architecture matching training setup
        net = models.resnet50(weights=None)
        num_classes = len(class_names)
        net.fc = nn.Sequential(
            nn.Linear(net.fc.in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, num_classes)
        )
        
        state_dict = checkpoint['model_state_dict'] if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint else checkpoint
        net.load_state_dict(state_dict)
        net.to(device)
        net.eval()
        cnn_model = net
        print(f"CNN model loaded successfully! Classes: {class_names}")
        return True
    except Exception as e:
        print(f"Error loading CNN model: {e}")
        return False

def load_xgb_model():
    global xgb_artifacts
    abs_path = os.path.abspath(XGB_MODEL_PATH)
    if not os.path.exists(abs_path):
        print(f"Warning: XGBoost model not found at {abs_path}")
        return False
    try:
        xgb_artifacts = joblib.load(abs_path)
        print(f"XGBoost model loaded successfully! Features: {xgb_artifacts['feature_cols']}")
        return True
    except Exception as e:
        print(f"Error loading XGBoost model: {e}")
        return False

def load_gnn_model():
    global gnn_model, gnn_artifacts
    abs_state = os.path.abspath(GNN_MODEL_PATH)
    abs_art = os.path.abspath(GNN_ARTIFACTS_PATH)
    if not os.path.exists(abs_state) or not os.path.exists(abs_art):
        print(f"Warning: GNN model or artifacts not found at {abs_state}")
        return False
    try:
        gnn_artifacts = joblib.load(abs_art)
        state = torch.load(abs_state, map_location=device)
        model = FraudRingGNN(in_dim=gnn_artifacts['in_dim'], hidden_dim=64, out_dim=32, dropout=0.0)
        model.load_state_dict(state)
        model.to(device)
        model.eval()
        gnn_model = model
        print("GNN Fraud Ring model loaded successfully!")
        return True
    except Exception as e:
        print(f"Error loading GNN model: {e}")
        return False

# Attempt to load models on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    load_cnn_model()
    load_xgb_model()
    load_gnn_model()

def extract_exif_data(img: Image.Image) -> Dict[str, Any]:
    """Extract key EXIF forensic details if present."""
    exif_details = {
        "has_exif": False,
        "date_time": None,
        "camera_make": None,
        "camera_model": None,
        "software": None,
        "orientation_corrected": False
    }
    
    try:
        exif = img.getexif()
        if exif:
            exif_details["has_exif"] = True
            for tag_id, value in exif.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                if tag == 'DateTime' or tag == 'DateTimeOriginal':
                    exif_details["date_time"] = str(value)
                elif tag == 'Make':
                    exif_details["camera_make"] = str(value).strip()
                elif tag == 'Model':
                    exif_details["camera_model"] = str(value).strip()
                elif tag == 'Software':
                    exif_details["software"] = str(value).strip()
    except Exception:
        pass
        
    return exif_details

def preprocess_and_analyze(image_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Phase 1-5 Preprocessing & ResNet50 Inference pipeline."""
    start_time = time.time()
    
    # 1. Ingestion Format Standardization & Image Loading
    raw_img = Image.open(io.BytesIO(image_bytes))
    original_format = raw_img.format or "UNKNOWN"
    original_size = raw_img.size # (width, height)
    
    # Extract raw EXIF metadata
    exif_info = extract_exif_data(raw_img)
    
    # 2. EXIF Orientation Correction & Uniform RGB conversion
    corrected_img = ImageOps.exif_transpose(raw_img)
    orientation_adjusted = (corrected_img.size != raw_img.size) or (corrected_img != raw_img)
    rgb_img = corrected_img.convert("RGB")
    
    # 3. Fraud Forensic Check - Perceptual Hashing (pHash)
    img_phash = str(imagehash.phash(rgb_img))
    dhash = str(imagehash.dhash(rgb_img))
    
    # 4. Spatial Normalization (224x224) & Pixel Intensity Normalization (ImageNet mean & std)
    input_tensor = inference_transform(rgb_img) # shape: (3, 224, 224)
    input_batch = input_tensor.unsqueeze(0).to(device) # shape: (1, 3, 224, 224)
    
    # 5. Model Inference
    if cnn_model is None:
        load_cnn_model()
        
    if cnn_model is None:
        raise HTTPException(status_code=500, detail="CNN model is not initialized.")
        
    with torch.no_grad():
        logits = cnn_model(input_batch)
        probs = F.softmax(logits[0], dim=0)
        
    # Map probabilities to class names
    prob_dict = {class_names[i]: float(probs[i].item()) for i in range(len(class_names))}
    
    # Calculate Raw Fraud Probability from ResNet50
    fraud_idx = class_names.index("Fraud") if "Fraud" in class_names else 0
    raw_fraud_prob = prob_dict.get("Fraud", prob_dict.get(class_names[fraud_idx], 0.0))
    raw_non_fraud_prob = prob_dict.get("Non-Fraud", 1.0 - raw_fraud_prob)
    
    raw_fraud_score = round(raw_fraud_prob * 100, 2)
    
    proc_time_ms = round((time.time() - start_time) * 1000, 2)
    
    return {
        "filename": filename,
        "original_format": original_format,
        "original_dimensions": f"{original_size[0]}x{original_size[1]}",
        "processed_dimensions": "224x224",
        "processing_time_ms": proc_time_ms,
        "forensics": {
            "perceptual_hash": img_phash,
            "difference_hash": dhash,
            "exif": exif_info,
            "orientation_corrected": orientation_adjusted
        },
        "preprocessing_pipeline": [
            "Ingestion & RGB Conversion",
            "EXIF Auto-Orientation Correction",
            "Spatial Resizing to 224x224 px",
            "Tensor Scaling [0.0, 1.0]",
            "ImageNet Mean & Std Normalization",
            "Perceptual Hashing Fingerprint"
        ],
        "prediction": {
            "predicted_class": "Fraud" if raw_fraud_score >= 50.0 else "Non-Fraud",
            "fraud_score": raw_fraud_score, # 0.0 to 100.0
            "fraud_probability": round(raw_fraud_prob, 4),
            "non_fraud_probability": round(raw_non_fraud_prob, 4),
            "class_probabilities": prob_dict,
            "logits": [float(l.item()) for l in logits[0]]
        }
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "cnn_model_loaded": cnn_model is not None,
        "xgb_model_loaded": xgb_artifacts is not None,
        "gnn_model_loaded": gnn_model is not None,
        "device": str(device),
        "cnn_model_path": CNN_MODEL_PATH,
        "classes": class_names
    }

# ─── GNN Fraud Ring Inference ────────────────────────────────────────────────

def predict_gnn_fraud_ring(claim_dict: dict) -> dict:
    """Run Graph Neural Network message passing to detect organized fraud rings and network collusion."""
    if gnn_model is None or gnn_artifacts is None:
        load_gnn_model()
    if gnn_model is None or gnn_artifacts is None:
        return {
            "fraud_ring_score": 0.0,
            "fraud_ring_probability": 0.0,
            "ring_risk_level": "UNKNOWN",
            "ring_hub": None,
            "connected_claims": 0,
            "fraud_neighbors": 0,
            "network_flags": [],
            "recommendation_label": "GNN Model not initialized"
        }

    encoders = gnn_artifacts['encoders']
    scaler = gnn_artifacts['scaler']
    topo_scaler = gnn_artifacts['topo_scaler']
    ref_df = gnn_artifacts['ref_df']
    ref_X = gnn_artifacts['ref_X']
    ref_adj = gnn_artifacts['ref_adj']
    N_ref = len(ref_df)

    # 1. Numerics
    num_vals = np.array([[
        float(claim_dict.get('total_claim_amount') or 0),
        float(claim_dict.get('vehicle_claim') or 0),
        float(claim_dict.get('umbrella_limit') or 0),
        float(claim_dict.get('policy_annual_premium') or 0)
    ]])
    X_num = scaler.transform(num_vals)

    # 2. Categoricals
    cat_vals = []
    for col in gnn_artifacts['categorical_cols']:
        le = encoders[col]
        val = str(claim_dict.get(col) or 'Unknown')
        enc = le.transform([val])[0] if val in le.classes_ else le.transform([le.classes_[0]])[0]
        cat_vals.append(enc)
    X_cat = np.array([cat_vals])

    # 3. Topo features
    gid = (claim_dict.get('garage_id') or '').strip()
    cid = (claim_dict.get('claimant_id') or '').strip()
    city = (claim_dict.get('incident_city') or '').strip()

    g_count = gnn_artifacts['garage_counts'].get(gid, 1 if gid else 0)
    c_count = gnn_artifacts['claimant_counts'].get(cid, 1 if cid else 0)
    X_topo = topo_scaler.transform([[g_count, c_count]])

    query_x = np.hstack([X_num, X_cat, X_topo])

    # 4. Find neighbor matches in reference graph
    garage_matches = np.where(ref_df['garage_id'] == gid)[0] if gid else np.array([], dtype=int)
    claimant_matches = np.where(ref_df['claimant_id'] == cid)[0] if cid else np.array([], dtype=int)
    city_matches = np.where(ref_df['incident_city'] == city)[0] if city else np.array([], dtype=int)

    neighbor_indices = np.unique(np.concatenate([garage_matches, claimant_matches, city_matches[:20]])).astype(int)
    if len(neighbor_indices) == 0:
        neighbor_indices = np.random.choice(N_ref, size=15, replace=False)

    sub_indices = neighbor_indices
    K = len(sub_indices)

    sub_X = np.vstack([ref_X[sub_indices], query_x])
    sub_adj = np.zeros((K + 1, K + 1), dtype=np.float32)
    sub_adj[:K, :K] = ref_adj[np.ix_(sub_indices, sub_indices)]

    # Add edges to query node
    for local_i, global_i in enumerate(sub_indices):
        ref_row = ref_df.iloc[global_i]
        w = 0.0
        if gid and ref_row['garage_id'] == gid:
            w += 3.0
        if cid and ref_row['claimant_id'] == cid:
            w += 2.5
        if city and ref_row['incident_city'] == city and w > 0:
            w += 0.4
        if w > 0:
            sub_adj[local_i, K] = w
            sub_adj[K, local_i] = w

    np.fill_diagonal(sub_adj, 1.0)

    # Normalize: D^{-1/2} A D^{-1/2}
    deg = np.sum(sub_adj, axis=1)
    deg_inv_sqrt = np.zeros_like(deg)
    mask = deg > 0
    deg_inv_sqrt[mask] = 1.0 / np.sqrt(deg[mask])
    D_inv = np.diag(deg_inv_sqrt)
    sub_adj_norm = D_inv @ sub_adj @ D_inv

    with torch.no_grad():
        tx = torch.tensor(sub_X, dtype=torch.float32).to(device)
        ta = torch.tensor(sub_adj_norm, dtype=torch.float32).to(device)
        logits, _ = gnn_model(tx, ta)
        query_logit = logits[-1].item()
        prob = 1.0 / (1.0 + np.exp(-query_logit))
        fraud_ring_score = round(float(prob) * 100, 2)

    # Ring context analysis
    fraud_neighbors = sum(1 for gi in garage_matches if ref_df.iloc[gi]['fraud_reported'] == 1)
    claimant_fraud_neighbors = sum(1 for ci in claimant_matches if ref_df.iloc[ci]['fraud_reported'] == 1)
    total_fraud_neighbors = fraud_neighbors + claimant_fraud_neighbors

    network_flags = []
    if len(garage_matches) >= 3:
        network_flags.append(f"High-Density Garage: {gid} associated with {len(garage_matches)} prior claims ({fraud_neighbors} confirmed fraudulent)")
    elif len(garage_matches) > 0:
        network_flags.append(f"Linked Garage: {gid} has {len(garage_matches)} existing claims in network")

    if len(claimant_matches) >= 2:
        network_flags.append(f"Serial Claimant: {cid} has filed {len(claimant_matches)} prior claims across the database")

    if fraud_ring_score >= 80:
        ring_risk_level = "CRITICAL"
        rec_label = "Active Fraud Ring Member – Immediate Freeze & Syndicate Cross-Investigation"
    elif fraud_ring_score >= 50:
        ring_risk_level = "HIGH"
        rec_label = "High Network Collusion Risk – Flag Repair Facility & Audit Claim History"
    elif fraud_ring_score >= 25:
        ring_risk_level = "MEDIUM"
        rec_label = "Moderate Network Proximity – Check Adjuster Records for Prior Claims"
    else:
        ring_risk_level = "LOW"
        rec_label = "Isolated Claim – No Fraud Ring or Collusion Signal Detected"

    return {
        "fraud_ring_score": fraud_ring_score,
        "fraud_ring_probability": round(float(prob), 4),
        "ring_risk_level": ring_risk_level,
        "ring_hub": gid if len(garage_matches) >= 2 else (cid if len(claimant_matches) >= 2 else None),
        "connected_claims": len(garage_matches) + len(claimant_matches),
        "fraud_neighbors": total_fraud_neighbors,
        "network_flags": network_flags,
        "recommendation_label": rec_label
    }

# ─── XGBoost Tabular Predict Endpoint ───────────────────────────────────────

class TabularClaimInput(BaseModel):
    # ML features
    incident_severity:     str
    total_claim_amount:    float
    insured_hobbies:       str
    vehicle_claim:         float
    incident_type:         str
    umbrella_limit:        float
    policy_annual_premium: float
    # Metadata (stored, shown in graph)
    incident_city:         Optional[str] = None
    incident_date:         Optional[str] = None
    policy_state:          Optional[str] = None
    garage_id:             Optional[str] = None   # repair garage (strongest ring signal)
    claimant_id:           Optional[str] = None   # person filing the claim
    cnn_fraud_score:       Optional[float] = None # optional image fraud score from CNN ResNet50

@app.post("/api/predict")
def predict_tabular_fraud(payload: TabularClaimInput, db: Session = Depends(get_db)):
    """Run XGBoost tabular + GNN Graph Neural Network fraud ring prediction and persist result to DB."""
    if xgb_artifacts is None:
        load_xgb_model()
    if xgb_artifacts is None:
        raise HTTPException(status_code=500, detail="XGBoost model is not loaded.")

    model_xgb        = xgb_artifacts['model']
    encoders         = xgb_artifacts['encoders']
    scaler           = xgb_artifacts['scaler']
    feature_cols     = xgb_artifacts['feature_cols']
    categorical_cols = xgb_artifacts['categorical_cols']
    numeric_cols     = xgb_artifacts['numeric_cols']

    # 1. XGBoost Tabular Anomaly Prediction
    row = {
        'incident_severity':    payload.incident_severity,
        'total_claim_amount':   payload.total_claim_amount,
        'insured_hobbies':      payload.insured_hobbies,
        'vehicle_claim':        payload.vehicle_claim,
        'incident_type':        payload.incident_type,
        'umbrella_limit':       payload.umbrella_limit,
        'policy_annual_premium':payload.policy_annual_premium,
    }
    X = pd.DataFrame([row])

    # Encode categoricals — handle unseen labels gracefully
    for col in categorical_cols:
        le  = encoders[col]
        val = X[col].iloc[0]
        X[col] = le.transform(X[col]) if val in le.classes_ else le.transform([le.classes_[0]])

    # Scale numerics
    X[numeric_cols] = scaler.transform(X[numeric_cols])

    # Predict
    proba          = model_xgb.predict_proba(X[feature_cols])[0]
    fraud_prob     = float(proba[1])
    non_fraud_prob = float(proba[0])
    fraud_score    = round(fraud_prob * 100, 2)
    predicted      = "Fraud" if fraud_score >= 50.0 else "Non-Fraud"

    if fraud_score < 30:
        risk_level           = "LOW"
        recommendation       = "AUTOMATED_APPROVAL"
        recommendation_label = "Low Risk – Fast-Track Automated Approval"
    elif fraud_score < 65:
        risk_level           = "MEDIUM"
        recommendation       = "MANUAL_REVIEW"
        recommendation_label = "Moderate Risk – Assign to Adjuster for Manual Review"
    elif fraud_score < 85:
        risk_level           = "HIGH"
        recommendation       = "PRIORITY_AUDIT"
        recommendation_label = "High Risk – Flag for SIU Investigation"
    else:
        risk_level           = "CRITICAL"
        recommendation       = "REJECT_AND_INVESTIGATE"
        recommendation_label = "Critical Fraud Risk – Immediate Claim Hold & Audit"

    # 2. GNN Graph Neural Network Fraud Ring Prediction
    claim_meta = {
        'incident_severity':    payload.incident_severity,
        'total_claim_amount':   payload.total_claim_amount,
        'insured_hobbies':      payload.insured_hobbies,
        'vehicle_claim':        payload.vehicle_claim,
        'incident_type':        payload.incident_type,
        'umbrella_limit':       payload.umbrella_limit,
        'policy_annual_premium':payload.policy_annual_premium,
        'incident_city':        payload.incident_city,
        'policy_state':         payload.policy_state,
        'garage_id':            payload.garage_id,
        'claimant_id':          payload.claimant_id,
    }
    gnn_result = predict_gnn_fraud_ring(claim_meta)

    # 3. Composite Tri-Modal Synthesis (CNN + XGBoost + GNN)
    cnn_score = payload.cnn_fraud_score
    if cnn_score is not None:
        composite_score = round(0.35 * fraud_score + 0.45 * gnn_result["fraud_ring_score"] + 0.20 * cnn_score, 1)
    else:
        composite_score = round(0.45 * fraud_score + 0.55 * gnn_result["fraud_ring_score"], 1)

    if composite_score >= 80 or gnn_result["fraud_ring_score"] >= 85:
        comp_verdict = "CRITICAL_FRAUD"
        comp_risk    = "CRITICAL"
        comp_rec     = "🚨 Critical Threat: Multi-Modal & Fraud Ring Syndicate Detected. Halt All Payments & Refer to SIU Command."
    elif composite_score >= 50 or fraud_score >= 60:
        comp_verdict = "HIGH_RISK"
        comp_risk    = "HIGH"
        comp_rec     = "🔴 High Fraud Risk: Significant Anomaly Detected Across Models. Detailed Senior Adjuster Audit Required."
    elif composite_score >= 30:
        comp_verdict = "MODERATE_RISK"
        comp_risk    = "MEDIUM"
        comp_rec     = "🟡 Moderate Risk: Secondary Verifications Recommended for Invoices and Shop Details."
    else:
        comp_verdict = "LEGITIMATE"
        comp_risk    = "LOW"
        comp_rec     = "✅ Clean Claim: Cross-Validated Legitimate Across Visual, Tabular, and Network Modalities."

    # ── Persist to database ──────────────────────────────────────────
    entry = ClaimEntry(
        incident_severity     = payload.incident_severity,
        incident_type         = payload.incident_type,
        insured_hobbies       = payload.insured_hobbies,
        total_claim_amount    = payload.total_claim_amount,
        vehicle_claim         = payload.vehicle_claim,
        umbrella_limit        = payload.umbrella_limit,
        policy_annual_premium = payload.policy_annual_premium,
        incident_city         = payload.incident_city,
        incident_date         = payload.incident_date,
        policy_state          = payload.policy_state,
        garage_id             = payload.garage_id,
        claimant_id           = payload.claimant_id,
        predicted_class       = predicted,
        fraud_score           = fraud_score,
        fraud_probability     = round(fraud_prob, 4),
        non_fraud_probability = round(non_fraud_prob, 4),
        risk_level            = risk_level,
        recommendation        = recommendation,
        recommendation_label  = recommendation_label,
        gnn_fraud_ring_score  = gnn_result["fraud_ring_score"],
        gnn_ring_risk         = gnn_result["ring_risk_level"],
        gnn_ring_hub          = gnn_result["ring_hub"],
        cnn_fraud_score       = cnn_score,
        composite_score       = composite_score,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "id":                   entry.id,
        "timestamp":            entry.created_at.isoformat() + "Z",
        "predicted_class":      predicted,
        "fraud_score":          fraud_score,
        "risk_level":           risk_level,
        "xgboost": {
            "fraud_score":          fraud_score,
            "fraud_probability":    round(fraud_prob, 4),
            "non_fraud_probability":round(non_fraud_prob, 4),
            "risk_level":           risk_level,
            "predicted_class":      predicted,
            "recommendation_label": recommendation_label,
        },
        "gnn": gnn_result,
        "cnn": {
            "fraud_score": cnn_score,
            "analyzed": cnn_score is not None,
        },
        "composite": {
            "score":                composite_score,
            "risk_level":           comp_risk,
            "verdict":              comp_verdict,
            "recommendation_label": comp_rec,
        },
        "recommendation":       recommendation,
        "recommendation_label": comp_rec,
        "model":                "Tri-Modal (CNN + XGBoost + GNN)",
        "features_used":        feature_cols,
    }


# ─── Claims History Endpoints ─────────────────────────────────────────────────

@app.get("/api/claims/stats")
def claims_stats(db: Session = Depends(get_db)):
    """Aggregate statistics across all stored claims."""
    from sqlalchemy import func
    total      = db.query(func.count(ClaimEntry.id)).scalar() or 0
    fraud_cnt  = db.query(func.count(ClaimEntry.id)).filter(ClaimEntry.predicted_class == "Fraud").scalar() or 0
    safe_cnt   = total - fraud_cnt
    avg_score  = db.query(func.avg(ClaimEntry.fraud_score)).scalar()
    risk_counts = {}
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        risk_counts[level] = db.query(func.count(ClaimEntry.id)).filter(ClaimEntry.risk_level == level).scalar() or 0
    return {
        "total_claims":    total,
        "fraud_count":     fraud_cnt,
        "non_fraud_count": safe_cnt,
        "fraud_rate":      round((fraud_cnt / total * 100), 2) if total else 0,
        "avg_fraud_score": round(avg_score, 2) if avg_score else 0,
        "risk_breakdown":  risk_counts,
    }


@app.get("/api/claims")
def list_claims(
    db: Session = Depends(get_db),
    skip:  int = Query(0,  ge=0,  description="Offset"),
    limit: int = Query(50, ge=1,  le=200, description="Page size"),
    risk:  Optional[str] = Query(None),
    predicted_class: Optional[str] = Query(None),
):
    """Paginated list of all stored claim predictions."""
    q = db.query(ClaimEntry).order_by(ClaimEntry.created_at.desc())
    if risk:
        q = q.filter(ClaimEntry.risk_level == risk.upper())
    if predicted_class:
        q = q.filter(ClaimEntry.predicted_class == predicted_class)
    total = q.count()
    rows  = q.offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "claims": [r.to_dict() for r in rows]}


@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    entry = db.query(ClaimEntry).filter(ClaimEntry.id == claim_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found.")
    return entry.to_dict()


@app.delete("/api/claims/{claim_id}")
def delete_claim(claim_id: int, db: Session = Depends(get_db)):
    entry = db.query(ClaimEntry).filter(ClaimEntry.id == claim_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found.")
    db.delete(entry)
    db.commit()
    return {"deleted": claim_id}


# ─── Graph Nodes Endpoint (Heterogeneous Knowledge Graph) ────────────────────

@app.get("/api/graph/nodes")
def graph_nodes(db: Session = Depends(get_db)):
    """
    Return a heterogeneous multi-type knowledge graph.
    Node types: claim, garage, claimant, city, state, incident_type
    Each claim connects to its related entity nodes via typed edges.
    Fraud rings become visible as clusters around shared garage/claimant hubs.
    """
    rows = db.query(ClaimEntry).order_by(ClaimEntry.created_at.asc()).all()

    nodes = []
    edges = []
    seen_nodes = set()
    seen_edges = set()

    # ── Helper: add entity node once ──────────────────────────────────────────
    def add_entity(nid, node_type, label, extra=None):
        if nid not in seen_nodes:
            seen_nodes.add(nid)
            n = {"id": nid, "type": node_type, "label": label}
            if extra:
                n.update(extra)
            nodes.append(n)

    def add_edge(src, tgt, rel, weight=1):
        key = (src, tgt)
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({"source": src, "target": tgt, "rel": rel, "weight": weight})

    # ── Count claims per entity for sizing ────────────────────────────────────
    from collections import defaultdict
    garage_counts   = defaultdict(int)
    claimant_counts = defaultdict(int)
    city_counts     = defaultdict(int)
    state_counts    = defaultdict(int)
    itype_counts    = defaultdict(int)

    for r in rows:
        if r.garage_id:     garage_counts[r.garage_id]    += 1
        if r.claimant_id:   claimant_counts[r.claimant_id] += 1
        if r.incident_city: city_counts[r.incident_city]   += 1
        if r.policy_state:  state_counts[r.policy_state]   += 1
        if r.incident_type: itype_counts[r.incident_type]  += 1

    # ── Build nodes and edges per claim ───────────────────────────────────────
    for r in rows:
        claim_id = f"claim_{r.id}"

        # Claim node
        if claim_id not in seen_nodes:
            seen_nodes.add(claim_id)
            nodes.append({
                "id":                   claim_id,
                "type":                 "claim",
                "label":                f"#{r.id}",
                "claim_db_id":          r.id,
                "fraud_score":          r.fraud_score,
                "risk_level":           r.risk_level,
                "predicted_class":      r.predicted_class,
                "incident_type":        r.incident_type,
                "incident_severity":    r.incident_severity,
                "incident_city":        r.incident_city or "Unknown",
                "incident_date":        r.incident_date or "—",
                "policy_state":         r.policy_state or "—",
                "garage_id":            r.garage_id or "—",
                "claimant_id":          r.claimant_id or "—",
                "total_claim_amount":   r.total_claim_amount,
                "vehicle_claim":        r.vehicle_claim,
                "insured_hobbies":      r.insured_hobbies,
                "recommendation_label": r.recommendation_label,
                "fraud_probability":    r.fraud_probability,
                "non_fraud_probability":r.non_fraud_probability,
                "created_at":           r.created_at.isoformat() + "Z" if r.created_at else None,
            })

        # ── Garage node + edge (strongest ring signal — weight 3) ────────────
        if r.garage_id:
            gid = f"garage_{r.garage_id}"
            add_entity(gid, "garage", r.garage_id, {
                "claim_count": garage_counts[r.garage_id],
                "garage_id":   r.garage_id,
            })
            add_edge(claim_id, gid, "REPAIRED_AT", weight=3)

        # ── Claimant node + edge (strong signal — weight 2) ──────────────────
        if r.claimant_id:
            cid = f"claimant_{r.claimant_id}"
            add_entity(cid, "claimant", r.claimant_id, {
                "claim_count":  claimant_counts[r.claimant_id],
                "claimant_id":  r.claimant_id,
            })
            add_edge(claim_id, cid, "FILED_BY", weight=2)

        # ── City node + edge ──────────────────────────────────────────────────
        if r.incident_city:
            city_id = f"city_{r.incident_city}"
            add_entity(city_id, "city", r.incident_city, {
                "claim_count": city_counts[r.incident_city],
                "city_name":   r.incident_city,
            })
            add_edge(claim_id, city_id, "OCCURRED_IN", weight=1)

        # ── State node + edge ─────────────────────────────────────────────────
        if r.policy_state:
            state_id = f"state_{r.policy_state}"
            add_entity(state_id, "state", r.policy_state, {
                "claim_count": state_counts[r.policy_state],
            })
            add_edge(claim_id, state_id, "POLICY_IN", weight=1)

        # ── Incident type node + edge ─────────────────────────────────────────
        if r.incident_type:
            # Shorten label for readability
            short = (
                r.incident_type.replace("Multi-vehicle Collision", "Multi-Coll.")
                .replace("Single Vehicle Collision", "Single-Coll.")
                .replace("Vehicle Theft", "Theft")
            )
            itype_id = f"itype_{r.incident_type}"
            add_entity(itype_id, "incident_type", short, {
                "claim_count":  itype_counts[r.incident_type],
                "full_label":   r.incident_type,
            })
            add_edge(claim_id, itype_id, "INCIDENT_TYPE", weight=1)

    return {
        "nodes": nodes,
        "edges": edges,
        "total": len(nodes),
        "claim_count": len(rows),
    }


# ─── Seed Endpoint ────────────────────────────────────────────────────────────

@app.post("/api/seed")
def seed_database(db: Session = Depends(get_db)):
    """Populate DB with 30 realistic dummy claims for demo/testing."""
    import random, math
    random.seed(42)

    samples = [
        # (sev, type, hobby, total, vehicle, umbrella, premium, city, date, state, garage_id, claimant_id)
        # ── Ring A: Garage "G-001" Columbus cluster (all routed through same garage)
        ("Major Damage",   "Multi-vehicle Collision", "skydiving",    71610, 52080, 0,       1406.91, "Columbus",    "2015-01-25", "OH", "G-001", "CLM-A1"),
        ("Major Damage",   "Multi-vehicle Collision", "bungie-jumping",64100,51280, 0,       1351.10, "Columbus",    "2015-01-02", "OH", "G-001", "CLM-A2"),
        ("Major Damage",   "Multi-vehicle Collision", "skydiving",    93600, 74880, 0,       1289.40, "Columbus",    "2015-02-10", "OH", "G-001", "CLM-A3"),
        ("Major Damage",   "Single Vehicle Collision","skydiving",    88200, 70560, 0,       1310.00, "Columbus",    "2015-02-12", "OH", "G-001", "CLM-A1"),  # claimant repeats!
        ("Total Loss",     "Multi-vehicle Collision", "bungie-jumping",67000,53600, 0,       1450.00, "Columbus",    "2015-01-18", "OH", "G-001", "CLM-A4"),
        ("Major Damage",   "Multi-vehicle Collision", "bungie-jumping",72000,57600, 0,       1380.00, "Columbus",    "2015-01-19", "OH", "G-001", "CLM-A2"),  # claimant repeats!

        # ── Ring B: Garage "G-002" Arlington cluster
        ("Major Damage",   "Single Vehicle Collision","board-games",  63400, 50720, 6000000, 1415.74, "Arlington",   "2015-01-10", "IL", "G-002", "CLM-B1"),
        ("Major Damage",   "Vehicle Theft",           "skydiving",    12000,  9600, 0,       1200.00, "Arlington",   "2015-03-01", "IL", "G-002", "CLM-B2"),
        ("Total Loss",     "Multi-vehicle Collision", "sleeping",    105000, 84000, 6000000, 1900.00, "Arlington",   "2015-02-05", "IL", "G-002", "CLM-B1"),  # claimant repeats!
        ("Major Damage",   "Multi-vehicle Collision", "base-jumping", 82000, 65600, 0,       1520.00, "Arlington",   "2015-01-30", "IL", "G-002", "CLM-B3"),

        # ── Ring C: Same claimant "CLM-C1" across multiple cities (staged accidents)
        ("Total Loss",     "Single Vehicle Collision","polo",         95000, 76000, 5000000, 1750.00, "Springfield", "2015-02-25", "SC", "G-003", "CLM-C1"),
        ("Major Damage",   "Vehicle Theft",           "base-jumping", 18000, 14400, 0,       1150.00, "Columbus",    "2015-03-08", "OH", "G-004", "CLM-C1"),
        ("Major Damage",   "Multi-vehicle Collision", "yachting",     58000, 46400, 8000000, 1680.00, "Northbend",   "2015-01-15", "NY", "G-005", "CLM-C1"),

        # ── Independent / legit claims
        ("Minor Damage",   "Single Vehicle Collision","board-games",  34650, 23100, 5000000, 1413.14, "Columbus",    "2015-02-22", "OH", None, "CLM-D1"),
        ("Minor Damage",   "Vehicle Theft",           "board-games",   6500,  4550, 6000000, 1583.91, "Arlington",   "2015-02-17", "IL", None, "CLM-D2"),
        ("Minor Damage",   "Multi-vehicle Collision", "board-games",  78650, 50050, 0,       1333.35, "Springfield", "2015-01-13", "NY", None, "CLM-D3"),
        ("Total Loss",     "Multi-vehicle Collision", "base-jumping", 51590, 32830, 0,       1137.03, "Columbus",    "2015-02-27", "IL", None, "CLM-D4"),
        ("Total Loss",     "Single Vehicle Collision","golf",         27700, 22160, 0,       1442.99, "Arlington",   "2015-01-30", "IL", None, "CLM-D5"),
        ("Total Loss",     "Single Vehicle Collision","camping",      42300, 32900, 0,       1315.68, "Hillsdale",   "2015-01-05", "IL", None, "CLM-D6"),
        ("Total Loss",     "Single Vehicle Collision","dancing",      87010, 63280, 4000000, 1253.12, "Northbend",   "2015-01-06", "OH", None, "CLM-D7"),
        ("Total Loss",     "Single Vehicle Collision","reading",      56520, 42390, 3000000, 1215.36, "Northbend",   "2015-01-22", "SC", None, "CLM-D8"),
        ("Minor Damage",   "Parked Car",              "bungie-jumping", 7280,  5040, 0,        936.61, "Springfield", "2015-01-08", "OH", None, "CLM-D9"),
        ("Minor Damage",   "Vehicle Theft",           "reading",       5070,  3510, 5000000, 1197.22, "Riverwood",   "2015-01-21", "IN", None, "CLM-D10"),
        ("Minor Damage",   "Parked Car",              "chess",         4500,  3200, 0,         980.00, "Riverwood",   "2015-03-05", "VA", None, "CLM-D11"),
        ("Trivial Damage", "Single Vehicle Collision","hiking",        2200,  1500, 0,         870.00, "Hillsdale",   "2015-03-10", "NC", None, "CLM-D12"),
        ("Minor Damage",   "Vehicle Theft",           "kayaking",      8000,  5600, 2000000, 1100.00, "Northbend",   "2015-02-20", "NY", None, "CLM-D13"),
        ("Minor Damage",   "Parked Car",              "movies",        3800,  2700, 0,         920.00, "Riverwood",   "2015-03-15", "IN", None, "CLM-D14"),
        ("Trivial Damage", "Single Vehicle Collision","exercise",      1900,  1300, 0,         860.00, "Hillsdale",   "2015-03-20", "NC", None, "CLM-D15"),
        ("Minor Damage",   "Single Vehicle Collision","chess",        22000, 17600, 0,       1050.00, "Riverwood",   "2015-02-28", "VA", None, "CLM-D16"),
    ]

    if xgb_artifacts is None:
        load_xgb_model()
    if xgb_artifacts is None:
        return {"error": "XGBoost model not loaded — cannot seed."}

    model_xgb        = xgb_artifacts['model']
    encoders         = xgb_artifacts['encoders']
    scaler           = xgb_artifacts['scaler']
    feature_cols     = xgb_artifacts['feature_cols']
    categorical_cols = xgb_artifacts['categorical_cols']
    numeric_cols     = xgb_artifacts['numeric_cols']

    added = 0
    import pandas as pd
    for s in samples:
        sev, itype, hobby, total, veh, umb, prem, city, date, state, garage, claimant = s
        row = {
            'incident_severity':    sev,
            'total_claim_amount':   total,
            'insured_hobbies':      hobby,
            'vehicle_claim':        veh,
            'incident_type':        itype,
            'umbrella_limit':       umb,
            'policy_annual_premium':prem,
        }
        X = pd.DataFrame([row])
        for col in categorical_cols:
            le  = encoders[col]
            val = X[col].iloc[0]
            X[col] = le.transform(X[col]) if val in le.classes_ else le.transform([le.classes_[0]])
        X[numeric_cols] = scaler.transform(X[numeric_cols])
        proba = model_xgb.predict_proba(X[feature_cols])[0]
        fraud_prob     = float(proba[1])
        non_fraud_prob = float(proba[0])
        fraud_score    = round(fraud_prob * 100, 2)
        predicted      = "Fraud" if fraud_score >= 50.0 else "Non-Fraud"
        if fraud_score < 30:   rl, rec, rlabel = "LOW",      "AUTOMATED_APPROVAL",    "Low Risk – Fast-Track Automated Approval"
        elif fraud_score < 65: rl, rec, rlabel = "MEDIUM",   "MANUAL_REVIEW",         "Moderate Risk – Assign to Adjuster for Manual Review"
        elif fraud_score < 85: rl, rec, rlabel = "HIGH",     "PRIORITY_AUDIT",        "High Risk – Flag for SIU Investigation"
        else:                  rl, rec, rlabel = "CRITICAL", "REJECT_AND_INVESTIGATE","Critical Fraud Risk – Immediate Claim Hold & Audit"

        entry = ClaimEntry(
            incident_severity=sev, incident_type=itype, insured_hobbies=hobby,
            total_claim_amount=total, vehicle_claim=veh, umbrella_limit=umb,
            policy_annual_premium=prem, incident_city=city, incident_date=date, policy_state=state,
            garage_id=garage, claimant_id=claimant,
            predicted_class=predicted, fraud_score=fraud_score,
            fraud_probability=round(fraud_prob,4), non_fraud_probability=round(non_fraud_prob,4),
            risk_level=rl, recommendation=rec, recommendation_label=rlabel,
        )
        db.add(entry)
        added += 1

    db.commit()
    return {"seeded": added, "message": f"Added {added} dummy claim entries to the database."}

@app.post("/api/analyze")
async def analyze_claim_images(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No image files uploaded.")
        
    results = []
    hashes = []
    duplicate_warnings = []
    
    for file in files:
        contents = await file.read()
        analysis = preprocess_and_analyze(contents, file.filename)
        
        phash = analysis["forensics"]["perceptual_hash"]
        if phash in hashes:
            duplicate_warnings.append(f"Duplicate photo detected: '{file.filename}' matches another photo in this submission!")
        hashes.append(phash)
        
        results.append(analysis)
        
    # Calculate Aggregated Claim Fraud Score
    scores = [r["prediction"]["fraud_score"] for r in results]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    max_score = max(scores) if scores else 0.0
    
    # Duplicate penalty if photos are recycled across claim
    duplicate_penalty = 25.0 if duplicate_warnings else 0.0
    overall_fraud_score = min(100.0, round((max_score * 0.70) + (avg_score * 0.30) + duplicate_penalty, 2))
    
    if overall_fraud_score < 30.0:
        overall_risk = "LOW"
        recommendation = "AUTOMATED_APPROVAL"
        recommendation_label = "Low Risk - Fast-Track Automated Approval"
    elif overall_fraud_score < 65.0:
        overall_risk = "MEDIUM"
        recommendation = "MANUAL_REVIEW"
        recommendation_label = "Moderate Risk - Assign to Adjuster for Manual Review"
    elif overall_fraud_score < 85.0:
        overall_risk = "HIGH"
        recommendation = "PRIORITY_AUDIT"
        recommendation_label = "High Risk - Flag for Special Investigation Unit (SIU)"
    else:
        overall_risk = "CRITICAL"
        recommendation = "REJECT_AND_INVESTIGATE"
        recommendation_label = "Critical Fraud Risk - Immediate Claim Hold & Audit"

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "total_images_analyzed": len(results),
        "overall_fraud_score": overall_fraud_score,
        "overall_risk_level": overall_risk,
        "recommendation": recommendation,
        "recommendation_label": recommendation_label,
        "duplicate_warnings": duplicate_warnings,
        "image_results": results
    }

# Serve frontend static build ONLY (do NOT mount raw src/ — it swallows API routes in dev mode)
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")

