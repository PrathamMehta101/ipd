import os
import io
import re
import time
import base64
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image, ImageOps, ExifTags
import imagehash
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import init_db, get_db, ClaimEntry
from siu_service import compute_evidence_hashes, generate_siu_brief, build_legal_pdf_report
from tampering_service import perform_ela, verify_exif_geofencing, check_salvage_auction_match, analyze_estimate_document


# ─── Numpy → Python Type Sanitizer ──────────────────────────────────────────
def sanitize_numpy(obj):
    """
    Recursively converts numpy scalar and array types to native Python types
    so FastAPI's jsonable_encoder never raises TypeError on numpy.int64 etc.
    """
    if isinstance(obj, dict):
        return {k: sanitize_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_numpy(i) for i in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj


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

def jet_colormap(val_norm: np.ndarray) -> np.ndarray:
    """Vectorized Jet colormap mapping 2D [0, 1] floats to (H, W, 3) uint8 RGB."""
    four_val = 4.0 * np.clip(val_norm, 0.0, 1.0)
    r = np.clip(np.minimum(four_val - 1.5, -four_val + 4.5), 0.0, 1.0)
    g = np.clip(np.minimum(four_val - 0.5, -four_val + 3.5), 0.0, 1.0)
    b = np.clip(np.minimum(four_val + 0.5, -four_val + 2.5), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def compute_gradcam(rgb_img: Image.Image, target_class_idx: Optional[int] = None) -> Dict[str, Any]:
    """
    Compute Gradient-weighted Class Activation Mapping (Grad-CAM) on ResNet50 layer4[-1].
    Highlights which spatial pixel regions the CNN relied on to classify the damage photo.
    Returns Base64 encoded heatmap and visual alpha-overlay data URLs.
    """
    if cnn_model is None:
        load_cnn_model()
    if cnn_model is None:
        return {"available": False, "reason": "CNN model not loaded"}

    activations = []
    gradients = []

    def forward_hook(module, inp, out):
        activations.clear()
        activations.append(out)

    def backward_hook(module, grad_in, grad_out):
        gradients.clear()
        gradients.append(grad_out[0])

    try:
        target_layer = cnn_model.layer4[-1]
    except Exception as e:
        return {"available": False, "reason": f"Target layer not found: {e}"}

    handle_f = target_layer.register_forward_hook(forward_hook)
    handle_b = target_layer.register_full_backward_hook(backward_hook)

    try:
        # Prepare input tensor with gradients enabled
        tensor = inference_transform(rgb_img).unsqueeze(0).to(device)
        tensor.requires_grad_(True)

        cnn_model.zero_grad()
        logits = cnn_model(tensor)

        # Target class: default to predicted class or class "Fraud" (idx 0)
        if target_class_idx is None:
            target_class_idx = int(torch.argmax(logits[0]).item())

        score = logits[0, target_class_idx]
        score.backward()

        if not activations or not gradients:
            return {"available": False, "reason": "No activation or gradient captured"}

        act = activations[0]
        grad = gradients[0]

        # Global average pool the gradients over width and height
        alpha = torch.mean(grad, dim=(2, 3), keepdim=True)
        # Weighted sum across channels + ReLU to keep features with positive influence
        cam = F.relu(torch.sum(alpha * act, dim=1, keepdim=True))

        cam_min = cam.min()
        cam_max = cam.max()
        cam_norm = (cam - cam_min) / (cam_max - cam_min + 1e-8)

        # Upsample to match original image dimensions for pixel-perfect alignment
        orig_w, orig_h = rgb_img.size
        cam_upsampled = F.interpolate(
            cam_norm, size=(orig_h, orig_w), mode="bilinear", align_corners=False
        )[0, 0].detach().cpu().numpy()

        # Generate Jet colormap
        heat_rgb = jet_colormap(cam_upsampled)
        raw_arr = np.array(rgb_img)

        # Alpha blend: 55% original photo + 45% neural attention heatmap
        overlay_arr = (0.55 * raw_arr + 0.45 * heat_rgb).astype(np.uint8)

        # Encode overlay to JPEG Base64
        overlay_pil = Image.fromarray(overlay_arr)
        buf_overlay = io.BytesIO()
        overlay_pil.save(buf_overlay, format="JPEG", quality=82)
        overlay_b64 = "data:image/jpeg;base64," + base64.b64encode(buf_overlay.getvalue()).decode("utf-8")

        # Encode pure heatmap to JPEG Base64
        heat_pil = Image.fromarray(heat_rgb)
        buf_heat = io.BytesIO()
        heat_pil.save(buf_heat, format="JPEG", quality=82)
        heat_b64 = "data:image/jpeg;base64," + base64.b64encode(buf_heat.getvalue()).decode("utf-8")

        # Hotspot Focus Analysis
        h, w = cam_upsampled.shape
        h_third, w_third = max(1, h // 3), max(1, w // 3)
        grid_scores = {
            "Upper Hood & Grille Zone": float(cam_upsampled[0:h_third, 0:w_third].mean()),
            "Upper Windshield & Roof": float(cam_upsampled[0:h_third, w_third:2*w_third].mean()),
            "Upper Quarter Panel": float(cam_upsampled[0:h_third, 2*w_third:].mean()),
            "Driver-Side Fender": float(cam_upsampled[h_third:2*h_third, 0:w_third].mean()),
            "Direct Impact Core": float(cam_upsampled[h_third:2*h_third, w_third:2*w_third].mean()),
            "Passenger-Side Panel": float(cam_upsampled[h_third:2*h_third, 2*w_third:].mean()),
            "Lower Wheel & Suspension": float(cam_upsampled[2*h_third:, 0:w_third].mean()),
            "Front Bumper & Crumple Zone": float(cam_upsampled[2*h_third:, w_third:2*w_third].mean()),
            "Lower Undercarriage": float(cam_upsampled[2*h_third:, 2*w_third:].mean()),
        }
        dominant_region = max(grid_scores, key=grid_scores.get)
        peak_intensity = round(float(cam_upsampled.max()) * 100, 1)
        spread_pct = round(float(np.mean(cam_upsampled > 0.40)) * 100, 1)

        return {
            "available": True,
            "overlay_base64": overlay_b64,
            "heatmap_base64": heat_b64,
            "target_class": class_names[target_class_idx] if target_class_idx < len(class_names) else "Target",
            "focus_region": dominant_region,
            "peak_activation_pct": peak_intensity,
            "activation_spread_pct": spread_pct,
            "hotspot_description": f"ResNet50 visual attention concentrated primarily on {dominant_region} with {peak_intensity}% peak activation across {spread_pct}% of the visible damage area."
        }
    except Exception as e:
        print(f"Grad-CAM computation warning: {e}")
        return {"available": False, "reason": str(e)}
    finally:
        try:
            handle_f.remove()
            handle_b.remove()
        except Exception:
            pass


def compute_xgboost_shap(model_xgb, X_scaled_df: pd.DataFrame, feature_cols: List[str], raw_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes exact TreeSHAP feature attribution values using XGBoost's native C++ booster.
    Calculates the exact push towards fraud (positive SHAP) or push towards legitimacy (negative SHAP)
    for every tabular feature, providing transparent legal-grade interpretability.
    """
    try:
        booster = model_xgb.get_booster()
        dm = xgb.DMatrix(X_scaled_df[feature_cols].values, feature_names=feature_cols)
        contribs = booster.predict(dm, pred_contribs=True)
        # contribs shape: (1, num_features + 1), where last element is base margin
        shap_values = contribs[0, :-1]
        base_value = float(contribs[0, -1])

        FEATURE_LABELS = {
            "incident_severity": "Incident Severity",
            "total_claim_amount": "Total Claim Amount",
            "insured_hobbies": "Insured Hobbies",
            "vehicle_claim": "Vehicle Claim Amount",
            "incident_type": "Incident Type",
            "umbrella_limit": "Umbrella Policy Limit",
            "policy_annual_premium": "Annual Policy Premium"
        }

        FEATURE_DESCRIPTIONS = {
            "incident_severity": {
                "Major Damage": "Major damage classification strongly accelerates fraud suspicion in staged collisions.",
                "Total Loss": "Total loss severity requires extreme damage thresholds; anomalous if paired with low premiums.",
                "Minor Damage": "Minor damage claims historically present lower fraud probability.",
                "Trivial Damage": "Trivial damage aligns with standard low-risk parking lot claims."
            },
            "vehicle_claim": "Disproportionately high vehicle claim compared to standard repair valuations raises financial anomaly score.",
            "total_claim_amount": "Total aggregate claim size drives insurance liability exposure.",
            "umbrella_limit": "Zero umbrella coverage or sudden umbrella mismatch alters the risk profile.",
            "insured_hobbies": "Certain high-risk or leisure profile patterns exhibit statistically higher claim collusion.",
            "policy_annual_premium": "Premium-to-loss ratio: lower annual premium with massive claim amount triggers underwriting mismatch.",
            "incident_type": "Multi-vehicle collisions and hit-and-run scenarios carry elevated fraud ring collusion rates."
        }

        total_abs_shap = float(np.sum(np.abs(shap_values))) + 1e-8
        feature_breakdown = []

        for i, col in enumerate(feature_cols):
            s_val = float(shap_values[i])
            raw_v = raw_values.get(col, "N/A")

            # Format raw value
            if col in ["total_claim_amount", "vehicle_claim", "umbrella_limit", "policy_annual_premium"]:
                try:
                    display_val = f"${float(raw_v):,.0f}"
                except Exception:
                    display_val = str(raw_v)
            else:
                display_val = str(raw_v)

            impact_pct = round((abs(s_val) / total_abs_shap) * 100, 1)
            is_risk_driver = s_val > 0

            # Explanation snippet
            desc_map = FEATURE_DESCRIPTIONS.get(col, "")
            if isinstance(desc_map, dict):
                explanation = desc_map.get(str(raw_v), f"{FEATURE_LABELS.get(col, col)} has a {'risk-accelerating' if is_risk_driver else 'risk-mitigating'} influence.")
            else:
                explanation = desc_map if desc_map else f"{FEATURE_LABELS.get(col, col)} impact."

            feature_breakdown.append({
                "feature": col,
                "label": FEATURE_LABELS.get(col, col),
                "raw_value": display_val,
                "shap_value": round(s_val, 4),
                "impact_pct": impact_pct,
                "direction": "RISK_ACCELERATOR" if is_risk_driver else "RISK_MITIGATOR",
                "explanation": explanation
            })

        # Sort by absolute impact
        feature_breakdown.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        risk_drivers = [f for f in feature_breakdown if f["shap_value"] > 0]
        mitigating_factors = [f for f in feature_breakdown if f["shap_value"] <= 0]

        summary_text = (
            f"Top risk driver is '{risk_drivers[0]['label']}' ({risk_drivers[0]['raw_value']}) contributing +{risk_drivers[0]['impact_pct']}% towards fraud risk."
            if risk_drivers else "All tabular features indicate compliant, low-risk underwriting metrics."
        )

        return {
            "method": "TreeSHAP (Exact C++ Attribution)",
            "base_log_odds": round(base_value, 4),
            "features": feature_breakdown,
            "top_risk_drivers": risk_drivers[:3],
            "top_mitigating_factors": mitigating_factors[:3],
            "summary": summary_text
        }
    except Exception as e:
        print(f"XGBoost SHAP calculation warning: {e}")
        return {"method": "TreeSHAP", "error": str(e), "features": []}


def analyze_fnol_statement(
    text: Optional[str],
    claim_meta: Dict[str, Any],
    image_results: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Layer 4: Forensic NLP & Cross-Modal Contradiction Detection.
    Evaluates:
      1. Forensic Linguistic Cues (Passive voice, cognitive complexity/over-detailing, preemptive exoneration).
      2. Cross-Modal Contradictions (Narrative claims vs Tabular metrics vs CNN Grad-CAM spatial damage).
      3. Deception scoring & SIU Investigator interrogative recommendations.
    """
    if not text or not text.strip():
        return {
            "analyzed": False,
            "fnol_score": 0.0,
            "risk_level": "NEUTRAL",
            "word_count": 0,
            "linguistic_markers": {
                "passive_voice_count": 0,
                "active_voice_count": 0,
                "passive_voice_ratio": 0.0,
                "passive_level": "NONE",
                "exoneration_phrases": [],
                "sensory_trivia": [],
                "exaggeration_terms": [],
                "vagueness_score": 0.0,
            },
            "contradictions": [],
            "deception_flags": [],
            "investigator_tip": "No written FNOL statement was provided for linguistic examination.",
            "summary": "No written accident statement filed."
        }

    raw_text = text.strip()
    words = raw_text.split()
    word_count = len(words)
    text_lower = raw_text.lower()

    # ── 1. Forensic Linguistic Markers ──────────────────────────────
    # Passive voice & depersonalization markers (distancing culpability)
    passive_patterns = [
        r'\bwas impacted\b', r'\bwas struck\b', r'\bwas hit\b', r'\bgot hit\b',
        r'\bdamage was sustained\b', r'\bcollision occurred\b', r'\baccident took place\b',
        r'\bwas collided with\b', r'\bwas contacted\b', r'\bvehicle was forced\b',
        r'\bwas totaled\b', r'\bwas smashed\b'
    ]
    passive_count = sum(len(re.findall(p, text_lower)) for p in passive_patterns)

    # Active first-person action verbs (taking accountability)
    active_patterns = [
        r'\bi braked\b', r'\bi swerved\b', r'\bi stopped\b', r'\bi drove\b',
        r'\bi turned\b', r'\bi saw\b', r'\bi noticed\b', r'\bi pulled\b', r'\bi stepped\b'
    ]
    active_count = sum(len(re.findall(p, text_lower)) for p in active_patterns)

    passive_ratio = round((passive_count / max(1, passive_count + active_count)), 2)

    # Preemptive exoneration / absolute certainty claims
    exoneration_phrases = []
    exoneration_lexicon = [
        ("100% not my fault", "Absolute certainty exoneration"),
        ("completely innocent", "Preemptive innocence assertion"),
        ("impossible to avoid", "Unpreventability claim"),
        ("zero fault of mine", "Preemptive liability rejection"),
        ("not my fault whatsoever", "Categorical blame avoidance"),
        ("undeniably clear", "Excessive certainty claim"),
        ("obvious to anyone", "Social pressure modifier"),
        ("did nothing wrong", "Defensive posture modifier"),
    ]
    for phrase, label in exoneration_lexicon:
        if phrase in text_lower:
            exoneration_phrases.append(f"{phrase.title()} ({label})")

    # Superfluous sensory trivia (over-detailing unrelated elements to fabricate realism)
    sensory_trivia = []
    sensory_lexicon = [
        "sipping coffee", "drinking coffee", "listening to radio", "favorite song",
        "sunny morning", "beautiful afternoon", "picking up groceries", "talking to my friend",
        "minding my own business", "thinking about dinner", "listening to music"
    ]
    for s in sensory_lexicon:
        if s in text_lower:
            sensory_trivia.append(s)

    # Over-exaggeration adjectives
    exaggeration_terms = []
    exaggeration_lexicon = ["obliterated", "pulverized", "demolished", "catastrophic", "unbelievable violence", "exploded", "annihilated"]
    for e in exaggeration_lexicon:
        if e in text_lower:
            exaggeration_terms.append(e)

    # Vagueness regarding collision physics
    physics_mentions = bool(re.search(r'\b\d{1,3}\s*(mph|km\/h|miles per hour)\b', text_lower) or
                            re.search(r'\b(lane|intersection|signal|green light|red light|crosswalk|highway)\b', text_lower))
    vagueness_score = 75.0 if not physics_mentions and word_count > 25 else 20.0

    # ── 2. Cross-Modal Discrepancy & Contradiction Detection ──────────
    contradictions = []

    # A. Severity Contradictions
    claimed_severity = str(claim_meta.get("incident_severity") or "")
    total_claim = float(claim_meta.get("total_claim_amount") or 0)

    # Text says minor / small bump, but filing is Total Loss or > $50k
    text_claims_minor = bool(re.search(r'\b(minor|barely|slight scratch|tiny bump|tap|low speed|fender bender|paint scrape)\b', text_lower))
    text_claims_total = bool(re.search(r'\b(total loss|totaled|pulverized|demolished|unrepairable|wreck|destroyed|destroyed beyond)\b', text_lower))

    if text_claims_minor and (claimed_severity == "Total Loss" or total_claim >= 50000):
        contradictions.append({
            "category": "SEVERITY_UNDERSTATEMENT_CONTRADICTION",
            "severity": "CRITICAL",
            "title": "Minor Narrative vs Severe Tabular Claim Mismatch",
            "claimant_statement": "Statement describes minor low-speed tap or slight scratch",
            "system_evidence": f"Tabular filing claims '{claimed_severity}' valuation of ${total_claim:,.0f}",
            "risk_delta": 30.0
        })

    if text_claims_total and (claimed_severity in ["Minor Damage", "Trivial Damage"] or total_claim <= 5000):
        contradictions.append({
            "category": "SEVERITY_OVERSTATEMENT_CONTRADICTION",
            "severity": "HIGH",
            "title": "Catastrophic Narrative vs Trivial Claim Mismatch",
            "claimant_statement": "Statement claims vehicle was completely totaled and obliterated",
            "system_evidence": f"Tabular filing claims only '{claimed_severity}' with small sum (${total_claim:,.0f})",
            "risk_delta": 20.0
        })

    # B. Incident Type Contradictions
    claimed_type = str(claim_meta.get("incident_type") or "")
    text_mentions_multi = bool(re.search(r'\b(other car|another vehicle|truck|second car|semi|suv hit me|hit by)\b', text_lower))
    text_mentions_single = bool(re.search(r'\b(tree|guardrail|barrier|ditch|skidded off|curb|pole|wall|swerved into)\b', text_lower))

    if claimed_type == "Single Vehicle Collision" and text_mentions_multi and not text_mentions_single:
        contradictions.append({
            "category": "COLLISION_TYPE_MISMATCH",
            "severity": "HIGH",
            "title": "Multi-Vehicle Narrative vs Single-Vehicle Filing",
            "claimant_statement": "Narrative attributes impact to another vehicle/truck",
            "system_evidence": "Claim is formally registered as 'Single Vehicle Collision'",
            "risk_delta": 22.0
        })
    elif claimed_type == "Multi-vehicle Collision" and text_mentions_single and not text_mentions_multi:
        contradictions.append({
            "category": "COLLISION_TYPE_MISMATCH",
            "severity": "MEDIUM",
            "title": "Barrier/Ditch Narrative vs Multi-Vehicle Filing",
            "claimant_statement": "Narrative mentions solitary spin-out into barrier or ditch",
            "system_evidence": "Claim is registered as 'Multi-vehicle Collision'",
            "risk_delta": 18.0
        })

    # C. Visual Spatial / Grad-CAM Contradictions
    if image_results and len(image_results) > 0:
        primary_cam = image_results[0].get("gradcam")
        if primary_cam and primary_cam.get("available"):
            focus_zone = primary_cam.get("focus_region", "")

            text_says_rear = bool(re.search(r'\b(rear|rear-ended|back bumper|tail light|trunk|hit from behind)\b', text_lower))
            text_says_front = bool(re.search(r'\b(head-on|front bumper|hood|grille|radiator|headlight)\b', text_lower))

            if text_says_rear and any(k in focus_zone for k in ["Hood", "Grille", "Front Bumper", "Driver-Side Fender"]):
                contradictions.append({
                    "category": "SPATIAL_IMPACT_OPPOSITION",
                    "severity": "CRITICAL",
                    "title": "Rear-End Narrative vs Frontal Damage Saliency",
                    "claimant_statement": "Statement asserts vehicle was rear-ended / impacted from behind",
                    "system_evidence": f"ResNet50 Grad-CAM localized primary mechanical deformation to '{focus_zone}'",
                    "risk_delta": 35.0
                })
            elif text_says_front and any(k in focus_zone for k in ["Rear", "Back", "Trunk"]):
                contradictions.append({
                    "category": "SPATIAL_IMPACT_OPPOSITION",
                    "severity": "HIGH",
                    "title": "Frontal Narrative vs Rear Damage Saliency",
                    "claimant_statement": "Statement claims frontal collision",
                    "system_evidence": f"ResNet50 Grad-CAM localized primary damage to '{focus_zone}'",
                    "risk_delta": 25.0
                })

    # ── 3. Score Calculation ──────────────────────────────────────────
    base_linguistic_risk = 20.0
    if passive_ratio >= 0.65:
        base_linguistic_risk += 22.0
    elif passive_ratio >= 0.40:
        base_linguistic_risk += 12.0

    if exoneration_phrases:
        base_linguistic_risk += min(25.0, len(exoneration_phrases) * 12.0)

    if sensory_trivia:
        base_linguistic_risk += 10.0

    if exaggeration_terms:
        base_linguistic_risk += 10.0

    # Add contradiction penalties
    contradiction_penalty = sum(c["risk_delta"] for c in contradictions)
    fnol_score = min(100.0, round(base_linguistic_risk + contradiction_penalty, 1))

    if fnol_score >= 75.0 or any(c["severity"] == "CRITICAL" for c in contradictions):
        fnol_risk = "CRITICAL"
    elif fnol_score >= 50.0 or contradictions:
        fnol_risk = "HIGH"
    elif fnol_score >= 30.0:
        fnol_risk = "MEDIUM"
    else:
        fnol_risk = "LOW"

    # Deception flags list
    flags = []
    if passive_ratio >= 0.50:
        flags.append(f"High Psychological Distancing: {passive_count} passive voice constructs ({int(passive_ratio*100)}% passive ratio)")
    for ep in exoneration_phrases:
        flags.append(f"Preemptive Exoneration: '{ep}'")
    if sensory_trivia:
        flags.append(f"Sensory Trivia Distraction: claimant focused on irrelevant details ({', '.join(sensory_trivia[:2])})")
    for c in contradictions:
        flags.append(f"Cross-Modal Contradiction: {c['title']}")

    # Form investigator questioning recommendation
    if contradictions:
        investigator_tip = f"Priority Interrogation: Re-interview claimant on {contradictions[0]['category'].replace('_', ' ').lower()}. Specifically ask why '{contradictions[0]['claimant_statement']}' contradicts physical system findings: '{contradictions[0]['system_evidence']}'."
    elif exoneration_phrases:
        investigator_tip = "Behavioral Probe: Claimant demonstrated unprompted defensive exoneration. Request contemporaneous dashcam or bystander statements."
    else:
        investigator_tip = "Linguistic statement shows normal first-person agency and matches vehicular parameters."

    return {
        "analyzed": True,
        "word_count": word_count,
        "fnol_score": fnol_score,
        "risk_level": fnol_risk,
        "linguistic_markers": {
            "passive_voice_count": passive_count,
            "active_voice_count": active_count,
            "passive_voice_ratio": passive_ratio,
            "passive_level": "HIGH" if passive_ratio >= 0.5 else ("MODERATE" if passive_ratio >= 0.25 else "LOW"),
            "exoneration_phrases": exoneration_phrases,
            "sensory_trivia": sensory_trivia,
            "exaggeration_terms": exaggeration_terms,
            "vagueness_score": vagueness_score,
        },
        "contradictions": contradictions,
        "deception_flags": flags,
        "investigator_tip": investigator_tip,
        "summary": f"FNOL narrative evaluated with {fnol_risk} risk ({fnol_score}% score). Detected {len(contradictions)} cross-modal contradictions and {len(flags)} forensic linguistic markers."
    }


def preprocess_and_analyze(
    image_bytes: bytes,
    filename: str,
    incident_city: Optional[str] = None,
    incident_date: Optional[str] = None
) -> Dict[str, Any]:
    """Phase 1-5 Preprocessing & ResNet50 Inference pipeline + Layer 2 Tampering Forensics & Grad-CAM."""
    start_time = time.time()

    # 1. Ingestion Format Standardization & Image Loading
    raw_img = Image.open(io.BytesIO(image_bytes))
    original_format = raw_img.format or "UNKNOWN"
    original_size = raw_img.size  # (width, height)

    # Extract raw EXIF metadata
    exif_info = extract_exif_data(raw_img)

    # 2. EXIF Orientation Correction & Uniform RGB conversion
    corrected_img = ImageOps.exif_transpose(raw_img)
    orientation_adjusted = (corrected_img.size != raw_img.size) or (corrected_img != raw_img)
    rgb_img = corrected_img.convert("RGB")

    # 3. Fraud Forensic Check - Perceptual Hashing (pHash) & Difference Hashing (dHash)
    img_phash = str(imagehash.phash(rgb_img))
    dhash = str(imagehash.dhash(rgb_img))

    # Layer 2: Error Level Analysis (ELA)
    ela_result = perform_ela(image_bytes)

    # Layer 2: EXIF GPS & Date Geofencing
    geofence_result = verify_exif_geofencing(image_bytes, incident_city, incident_date)

    # Layer 2: Reverse Salvage / Auction Database Matching
    salvage_result = check_salvage_auction_match(img_phash, dhash)

    # 4. Spatial Normalization (224x224) & Pixel Intensity Normalization (ImageNet mean & std)
    input_tensor = inference_transform(rgb_img)  # shape: (3, 224, 224)
    input_batch = input_tensor.unsqueeze(0).to(device)  # shape: (1, 3, 224, 224)

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

    # 6. Explainable AI: Grad-CAM Visual Heatmap & Focus Extraction
    gradcam_result = compute_gradcam(rgb_img, target_class_idx=fraud_idx)

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
        "tampering": {
            "ela": ela_result,
            "geofence": geofence_result,
            "salvage_auction": salvage_result,
        },
        "gradcam": gradcam_result,
        "preprocessing_pipeline": [
            "Ingestion & RGB Conversion",
            "EXIF Auto-Orientation Correction",
            "Spatial Resizing to 224x224 px",
            "Tensor Scaling [0.0, 1.0]",
            "ImageNet Mean & Std Normalization",
            "Perceptual Hashing Fingerprint",
            "Error Level Analysis (ELA) Compression Mapping",
            "EXIF GPS & Date Geofencing Validation",
            "Reverse Salvage Auction Database Matcher",
            "Grad-CAM Attention Saliency Mapping"
        ],
        "prediction": {
            "predicted_class": "Fraud" if raw_fraud_score >= 50.0 else "Non-Fraud",
            "fraud_score": raw_fraud_score,  # 0.0 to 100.0
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

    matched_neighbors = []
    if gid:
        for gi in garage_matches[:8]:
            row = ref_df.iloc[gi]
            matched_neighbors.append({
                "relation": f"Shared Repair Garage ({gid})",
                "entity": gid,
                "claimant_id": str(row.get('claimant_id', 'Unknown')),
                "incident_city": str(row.get('incident_city', '')),
                "incident_type": str(row.get('incident_type', '')),
                "total_claim_amount": float(row.get('total_claim_amount', 0)),
                "fraud_reported": bool(row.get('fraud_reported', 0) == 1),
                "status": "FRAUD" if row.get('fraud_reported', 0) == 1 else "LEGITIMATE"
            })
    if cid:
        for ci in claimant_matches[:8]:
            row = ref_df.iloc[ci]
            matched_neighbors.append({
                "relation": f"Serial Claimant Record ({cid})",
                "entity": cid,
                "garage_id": str(row.get('garage_id', 'Unknown')),
                "incident_city": str(row.get('incident_city', '')),
                "incident_type": str(row.get('incident_type', '')),
                "total_claim_amount": float(row.get('total_claim_amount', 0)),
                "fraud_reported": bool(row.get('fraud_reported', 0) == 1),
                "status": "FRAUD" if row.get('fraud_reported', 0) == 1 else "LEGITIMATE"
            })

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

    network_attribution = {
        "method": "GNN Topological Edge Attribution",
        "primary_ring_hub": gid if len(garage_matches) >= 2 else (cid if len(claimant_matches) >= 2 else None),
        "garage_connection": {
            "entity": gid or "None Specified",
            "prior_claims_count": len(garage_matches),
            "fraud_ratio_pct": round((fraud_neighbors / len(garage_matches) * 100), 1) if len(garage_matches) > 0 else 0.0,
            "weight": 3.0 if gid else 0.0,
            "status": "HIGH_DENSITY_FACILITY" if len(garage_matches) >= 3 else ("KNOWN_FACILITY" if len(garage_matches) > 0 else "NEW_FACILITY")
        },
        "claimant_connection": {
            "entity": cid or "None Specified",
            "prior_claims_count": len(claimant_matches),
            "fraud_ratio_pct": round((claimant_fraud_neighbors / len(claimant_matches) * 100), 1) if len(claimant_matches) > 0 else 0.0,
            "weight": 2.5 if cid else 0.0,
            "status": "SERIAL_CLAIMANT" if len(claimant_matches) >= 2 else ("REPEAT_CLAIMANT" if len(claimant_matches) > 0 else "NEW_CLAIMANT")
        },
        "geographic_cluster": {
            "city": city or "Unknown",
            "cluster_matches": len(city_matches)
        },
        "key_reason": (
            f"Connected to repair facility {gid} with {len(garage_matches)} historical claims ({fraud_neighbors} confirmed fraud)."
            if fraud_neighbors > 0 else (
                f"Serial claimant profile: {cid} has {len(claimant_matches)} prior files across the database."
                if len(claimant_matches) >= 2 else "Isolated claim without syndication links."
            )
        )
    }

    return {
        "fraud_ring_score": fraud_ring_score,
        "fraud_ring_probability": round(float(prob), 4),
        "ring_risk_level": ring_risk_level,
        "ring_hub": gid if len(garage_matches) >= 2 else (cid if len(claimant_matches) >= 2 else None),
        "connected_claims": len(garage_matches) + len(claimant_matches),
        "fraud_neighbors": total_fraud_neighbors,
        "garage_matches_count": len(garage_matches),
        "garage_fraud_count": fraud_neighbors,
        "claimant_matches_count": len(claimant_matches),
        "claimant_fraud_count": claimant_fraud_neighbors,
        "city_matches_count": len(city_matches),
        "network_flags": network_flags,
        "network_attribution": network_attribution,
        "recommendation_label": rec_label,
        "matched_neighbors": matched_neighbors[:12],
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
    incident_description:  Optional[str] = None   # Layer 4: FNOL statement

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

    # 3. Layer 4: Forensic NLP & FNOL Analysis
    fnol_result = analyze_fnol_statement(payload.incident_description, claim_meta, None)

    # 4. Composite Synthesis
    cnn_score = payload.cnn_fraud_score
    if fnol_result["analyzed"]:
        f_score = fnol_result["fnol_score"]
        if cnn_score is not None:
            composite_score = round(0.30 * fraud_score + 0.35 * gnn_result["fraud_ring_score"] + 0.15 * cnn_score + 0.20 * f_score, 1)
        else:
            composite_score = round(0.40 * fraud_score + 0.40 * gnn_result["fraud_ring_score"] + 0.20 * f_score, 1)
    else:
        if cnn_score is not None:
            composite_score = round(0.35 * fraud_score + 0.45 * gnn_result["fraud_ring_score"] + 0.20 * cnn_score, 1)
        else:
            composite_score = round(0.45 * fraud_score + 0.55 * gnn_result["fraud_ring_score"], 1)

    if composite_score >= 80 or gnn_result["fraud_ring_score"] >= 85 or (fnol_result["analyzed"] and fnol_result["risk_level"] == "CRITICAL"):
        comp_verdict = "CRITICAL_FRAUD"
        comp_risk    = "CRITICAL"
        comp_rec     = "🚨 Critical Threat: Multi-Modal Syndicate or Narrative Contradiction Detected. Halt All Payments & Refer to SIU Command."
    elif composite_score >= 50 or fraud_score >= 60:
        comp_verdict = "HIGH_RISK"
        comp_risk    = "HIGH"
        comp_rec     = "🔴 High Fraud Risk: Significant Anomaly Detected Across Modalities. Detailed Senior Adjuster Audit Required."
    elif composite_score >= 30:
        comp_verdict = "MODERATE_RISK"
        comp_risk    = "MEDIUM"
        comp_rec     = "🟡 Moderate Risk: Secondary Verifications Recommended for Invoices and Shop Details."
    else:
        comp_verdict = "LEGITIMATE"
        comp_risk    = "LOW"
        comp_rec     = "✅ Clean Claim: Cross-Validated Legitimate Across Visual, Tabular, and Linguistic Modalities."

    # ── Explainable AI (XAI): TreeSHAP Attribution ─────────────────
    shap_data = compute_xgboost_shap(model_xgb, X, feature_cols, row)
    explainability = {
        "shap": shap_data,
        "network": gnn_result.get("network_attribution"),
        "gradcam": None,
        "fnol": fnol_result if fnol_result["analyzed"] else None,
        "summary": shap_data.get("summary")
    }

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
        shap_summary          = json.dumps(shap_data),
        xai_insights          = json.dumps(explainability),
        incident_description  = payload.incident_description,
        fnol_score            = fnol_result["fnol_score"] if fnol_result["analyzed"] else None,
        fnol_linguistic_flags = json.dumps(fnol_result["linguistic_markers"]) if fnol_result["analyzed"] else None,
        contradiction_flags   = json.dumps(fnol_result["contradictions"]) if fnol_result["analyzed"] else None,
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
        "garage_id":            payload.garage_id,
        "claimant_id":          payload.claimant_id,
        "incident_city":        payload.incident_city,
        "policy_state":         payload.policy_state,
        "incident_description": payload.incident_description,
        "fnol":                 fnol_result,
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
        "explainability":       explainability,
        "recommendation":       recommendation,
        "recommendation_label": comp_rec,
        "model":                "Tri-Modal + FNOL NLP (CNN + XGBoost + GNN + NLP)",
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


class ClaimReviewInput(BaseModel):
    analyst_verdict: Optional[str] = "REVIEWED"
    notes: Optional[str] = None

@app.post("/api/claims/{claim_id}/review")
def review_claim(claim_id: int, payload: Optional[ClaimReviewInput] = None, db: Session = Depends(get_db)):
    """Mark a claim as reviewed/analyzed by analyst so it is no longer untouched."""
    entry = db.query(ClaimEntry).filter(ClaimEntry.id == claim_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found.")
    entry.analyst_reviewed = True
    if payload:
        if payload.analyst_verdict:
            entry.analyst_verdict = payload.analyst_verdict
        if payload.notes:
            entry.notes = payload.notes
    db.commit()
    db.refresh(entry)
    return {"success": True, "claim": entry.to_dict()}


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
    total_claims = len(rows)
    for idx, r in enumerate(rows):
        claim_id = f"claim_{r.id}"
        is_untouched = not bool(r.analyst_reviewed)
        is_newest = (idx >= total_claims - 3)

        # Claim node
        if claim_id not in seen_nodes:
            seen_nodes.add(claim_id)
            nodes.append({
                "id":                   claim_id,
                "type":                 "claim",
                "label":                f"🆕 #{r.id}" if is_untouched else f"#{r.id}",
                "claim_db_id":          r.id,
                "fraud_score":          r.fraud_score,
                "risk_level":           r.risk_level,
                "predicted_class":      r.predicted_class,
                "is_untouched":         is_untouched,
                "analyst_reviewed":     bool(r.analyst_reviewed),
                "is_newest":            is_newest,
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

@app.post("/api/unified-analyze")
async def unified_analyze(
    files: List[UploadFile] = File(default=[]),
    estimate_file: Optional[UploadFile] = File(None),
    incident_severity: str = Form("Major Damage"),
    total_claim_amount: float = Form(0.0),
    insured_hobbies: str = Form("chess"),
    vehicle_claim: float = Form(0.0),
    incident_type: str = Form("Multi-vehicle Collision"),
    umbrella_limit: float = Form(0.0),
    policy_annual_premium: float = Form(0.0),
    incident_city: Optional[str] = Form(None),
    incident_date: Optional[str] = Form(None),
    policy_state: Optional[str] = Form(None),
    garage_id: Optional[str] = Form(None),
    claimant_id: Optional[str] = Form(None),
    incident_description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Unified Single-Button Execution Endpoint:
    1. Processes all uploaded accident images through ResNet50 (CNN) with Grad-CAM & Layer 2 ELA/Geofencing.
    2. Ingests & OCR audits Garage Repair Estimates / Invoices for Bill Padding.
    3. Processes tabular claim attributes through XGBoost with TreeSHAP.
    4. Passes network and topological signals through Graph Neural Network (GNN).
    5. Evaluates First Notice of Loss (FNOL) statement for linguistic cues & cross-modal contradictions.
    6. Computes Multimodal composite synthesis, immutable SHA-256 custody hashes & persists record.
    """
    # ── 1. CNN ResNet50 Image Processing + Layer 2 Forensics ──
    image_results = []
    hashes = []
    duplicate_warnings = []
    photo_buffers = {}
    
    if files:
        for file in files:
            if not file.filename:
                continue
            contents = await file.read()
            if len(contents) == 0:
                continue
            photo_buffers[file.filename] = contents
            analysis = preprocess_and_analyze(contents, file.filename, incident_city=incident_city, incident_date=incident_date)
            phash = analysis["forensics"]["perceptual_hash"]
            if phash in hashes:
                duplicate_warnings.append(f"Duplicate photo detected: '{file.filename}' matches another photo in this submission!")
            hashes.append(phash)
            image_results.append(analysis)

    # ── 1b. Layer 2: Garage Repair Estimate OCR & Bill Padding ──
    bill_padding_result = None
    if estimate_file and estimate_file.filename:
        est_bytes = await estimate_file.read()
        if len(est_bytes) > 0:
            bill_padding_result = analyze_estimate_document(est_bytes, estimate_file.filename)
            photo_buffers[estimate_file.filename] = est_bytes

    if not bill_padding_result:
        bill_padding_result = {
            "parsed": False,
            "message": "No garage repair invoice uploaded. Standard policy line-item audit recommended.",
            "total_items": 0,
            "total_billed": 0.0,
            "total_padding_detected": 0.0,
            "padding_percentage": 0.0,
            "bill_padding_risk_score": 0.0,
            "phantom_parts": [],
            "line_items": []
        }

    if image_results:
        scores = [r["prediction"]["fraud_score"] for r in image_results]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        max_score = max(scores) if scores else 0.0
        duplicate_penalty = 25.0 if duplicate_warnings else 0.0
        cnn_fraud_score = min(100.0, round((max_score * 0.70) + (avg_score * 0.30) + duplicate_penalty, 2))
        cnn_data = {
            "analyzed": True,
            "total_images": len(image_results),
            "fraud_score": cnn_fraud_score,
            "duplicate_warnings": duplicate_warnings,
            "image_results": image_results,
            "summary": {
                "total_images": len(image_results),
                "highest_fraud_score": max_score,
                "average_fraud_score": round(avg_score, 2),
                "duplicate_warnings": duplicate_warnings,
            }
        }
    else:
        cnn_fraud_score = None
        cnn_data = {
            "analyzed": False,
            "total_images": 0,
            "fraud_score": None,
            "duplicate_warnings": [],
            "image_results": [],
            "summary": None
        }

    # ── 1c. Layer 2 Tampering Summary & Cross-Modal Risk ──
    tampering_summary = {
        "total_photos_audited": len(image_results),
        "ela_tampering_detected": any(r.get("tampering", {}).get("ela", {}).get("tampering_detected", False) for r in image_results),
        "geofence_violations": [
            r["filename"] for r in image_results 
            if r.get("tampering", {}).get("geofence", {}).get("geofence_violation", False)
        ],
        "date_violations": [
            r["filename"] for r in image_results 
            if r.get("tampering", {}).get("geofence", {}).get("temporal_violation", False)
        ],
        "salvage_matches": [
            {
                "filename": r["filename"],
                "match": r.get("tampering", {}).get("salvage_auction", {})
            }
            for r in image_results
            if r.get("tampering", {}).get("salvage_auction", {}).get("match_found", False)
        ],
        "highest_ela_score": max([r.get("tampering", {}).get("ela", {}).get("tampering_score", 0.0) for r in image_results], default=0.0),
        "highest_geofence_risk": max([r.get("tampering", {}).get("geofence", {}).get("geofence_risk", 0.0) for r in image_results], default=0.0),
        "tampering_risk_score": 0.0,
    }
    t_penalty = 0.0
    if tampering_summary["ela_tampering_detected"]:
        t_penalty += 35.0
    if tampering_summary["geofence_violations"] or tampering_summary["date_violations"]:
        t_penalty += 25.0
    if tampering_summary["salvage_matches"]:
        t_penalty += 55.0
    if bill_padding_result.get("bill_padding_risk_score", 0.0) > 0:
        t_penalty += bill_padding_result.get("bill_padding_risk_score", 0.0) * 0.4
    tampering_summary["tampering_risk_score"] = min(100.0, round(t_penalty, 1))

    # ── 2. XGBoost Tabular Anomaly Processing ──
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

    row = {
        'incident_severity':    incident_severity,
        'total_claim_amount':   total_claim_amount,
        'insured_hobbies':      insured_hobbies,
        'vehicle_claim':        vehicle_claim,
        'incident_type':        incident_type,
        'umbrella_limit':       umbrella_limit,
        'policy_annual_premium':policy_annual_premium,
    }
    X = pd.DataFrame([row])
    for col in categorical_cols:
        le  = encoders[col]
        val = X[col].iloc[0]
        X[col] = le.transform(X[col]) if val in le.classes_ else le.transform([le.classes_[0]])

    X[numeric_cols] = scaler.transform(X[numeric_cols])
    proba          = model_xgb.predict_proba(X[feature_cols])[0]
    fraud_prob     = float(proba[1])
    non_fraud_prob = float(proba[0])
    xgb_fraud_score= round(fraud_prob * 100, 2)
    xgb_predicted  = "Fraud" if xgb_fraud_score >= 50.0 else "Non-Fraud"

    if xgb_fraud_score < 30:
        xgb_risk = "LOW"
        xgb_rec  = "AUTOMATED_APPROVAL"
        xgb_rec_label = "Low Risk – Fast-Track Automated Approval"
    elif xgb_fraud_score < 65:
        xgb_risk = "MEDIUM"
        xgb_rec  = "MANUAL_REVIEW"
        xgb_rec_label = "Moderate Risk – Assign to Adjuster for Manual Review"
    elif xgb_fraud_score < 85:
        xgb_risk = "HIGH"
        xgb_rec  = "PRIORITY_AUDIT"
        xgb_rec_label = "High Risk – Flag for SIU Investigation"
    else:
        xgb_risk = "CRITICAL"
        xgb_rec  = "REJECT_AND_INVESTIGATE"
        xgb_rec_label = "Critical Fraud Risk – Immediate Claim Hold & Audit"

    # ── 3. GNN Graph Neural Network Message Passing ──
    claim_meta = {
        'incident_severity':    incident_severity,
        'total_claim_amount':   total_claim_amount,
        'insured_hobbies':      insured_hobbies,
        'vehicle_claim':        vehicle_claim,
        'incident_type':        incident_type,
        'umbrella_limit':       umbrella_limit,
        'policy_annual_premium':policy_annual_premium,
        'incident_city':        incident_city,
        'policy_state':         policy_state,
        'garage_id':            garage_id,
        'claimant_id':          claimant_id,
    }
    gnn_result = predict_gnn_fraud_ring(claim_meta)

    # ── 4. Layer 4: Forensic NLP & FNOL Analysis ──
    fnol_result = analyze_fnol_statement(incident_description, claim_meta, image_results)

    # ── 5. Multi-Modal Composite Synthesis ──
    if fnol_result["analyzed"]:
        f_score = fnol_result["fnol_score"]
        if cnn_fraud_score is not None:
            composite_score = round(0.30 * xgb_fraud_score + 0.35 * gnn_result["fraud_ring_score"] + 0.15 * cnn_fraud_score + 0.20 * f_score, 1)
        else:
            composite_score = round(0.40 * xgb_fraud_score + 0.40 * gnn_result["fraud_ring_score"] + 0.20 * f_score, 1)
    else:
        if cnn_fraud_score is not None:
            composite_score = round(0.35 * xgb_fraud_score + 0.45 * gnn_result["fraud_ring_score"] + 0.20 * cnn_fraud_score, 1)
        else:
            composite_score = round(0.45 * xgb_fraud_score + 0.55 * gnn_result["fraud_ring_score"], 1)

    has_critical_contradiction = fnol_result["analyzed"] and any(c["severity"] == "CRITICAL" for c in fnol_result["contradictions"])
    has_salvage_scrap_match = bool(tampering_summary["salvage_matches"])
    has_tampered_photos = tampering_summary["ela_tampering_detected"]

    if composite_score >= 80 or gnn_result["fraud_ring_score"] >= 85 or has_critical_contradiction or has_salvage_scrap_match:
        comp_verdict = "CRITICAL_FRAUD"
        comp_risk    = "CRITICAL"
        if has_salvage_scrap_match:
            comp_rec = "🚨 Critical Threat: Scrap Vehicle Recycled from Copart/IAAI Total-Loss Auction. Immediate Denial & SIU Subpoena."
        elif has_tampered_photos:
            comp_rec = "🚨 Critical Threat: Digital Image Tampering / Cloned Damage Detected. Hold Claim & Subpoena Original RAW Files."
        else:
            comp_rec = "🚨 Critical Threat: Multi-Modal Syndicate or Narrative Contradiction Detected. Halt All Payments & Refer to SIU Command."
    elif composite_score >= 50 or xgb_fraud_score >= 60 or (fnol_result["analyzed"] and fnol_result["risk_level"] in ["CRITICAL", "HIGH"]) or tampering_summary["tampering_risk_score"] >= 40.0:
        comp_verdict = "HIGH_RISK"
        comp_risk    = "HIGH"
        comp_rec     = "🔴 High Fraud Risk: Significant Anomaly Detected Across Modalities. Detailed Senior Adjuster Audit Required."
    elif composite_score >= 30:
        comp_verdict = "MODERATE_RISK"
        comp_risk    = "MEDIUM"
        comp_rec     = "🟡 Moderate Risk: Secondary Verifications Recommended for Invoices and Shop Details."
    else:
        comp_verdict = "LEGITIMATE"
        comp_risk    = "LOW"
        comp_rec     = "✅ Clean Claim: Cross-Validated Legitimate Across Visual, Tabular, Network, and Linguistic Modalities."

    # ── 6. Explainable AI (XAI) Multi-Modal Synthesis ──
    shap_data = compute_xgboost_shap(model_xgb, X, feature_cols, row)
    gradcam_primary = image_results[0].get("gradcam") if image_results else None

    # Construct forensic narrative synthesis
    top_driver_str = (
        f"Tabular fraud probability (+{shap_data['top_risk_drivers'][0]['impact_pct']}%) is primarily accelerated by {shap_data['top_risk_drivers'][0]['label']} ({shap_data['top_risk_drivers'][0]['raw_value']}). "
        if shap_data.get("top_risk_drivers") else "Tabular financial attributes reflect low underwriting anomaly. "
    )
    cam_str = (
        f"Visual neural attention concentrated on {gradcam_primary.get('focus_region')} ({gradcam_primary.get('peak_activation_pct')}% peak activation). "
        if gradcam_primary and gradcam_primary.get("available") else "Visual examination was not performed. "
    )
    net_str = (
        f"Graph ring topology linked to facility {gnn_result.get('ring_hub')} ({gnn_result.get('connected_claims')} historical claims in network). "
        if gnn_result.get("ring_hub") else "Graph ring topology exhibits isolated claim behavior. "
    )
    fnol_str = (
        f"Linguistic FNOL analysis detected {len(fnol_result['contradictions'])} cross-modal contradictions with deception risk of {fnol_result['fnol_score']}%. "
        if fnol_result["analyzed"] else "No written statement submitted. "
    )

    explainability = {
        "shap": shap_data,
        "gradcam": gradcam_primary,
        "network": gnn_result.get("network_attribution"),
        "fnol": fnol_result if fnol_result["analyzed"] else None,
        "narrative": {
            "top_risk_driver": shap_data["top_risk_drivers"][0]["label"] if shap_data.get("top_risk_drivers") else None,
            "top_risk_raw": shap_data["top_risk_drivers"][0]["raw_value"] if shap_data.get("top_risk_drivers") else None,
            "visual_focus_region": gradcam_primary.get("focus_region") if gradcam_primary and gradcam_primary.get("available") else None,
            "visual_peak_pct": gradcam_primary.get("peak_activation_pct") if gradcam_primary and gradcam_primary.get("available") else None,
            "network_hub": gnn_result.get("ring_hub"),
            "contradictions_count": len(fnol_result["contradictions"]) if fnol_result["analyzed"] else 0,
            "summary_statement": top_driver_str + cam_str + net_str + fnol_str
        }
    }

    # ── 7. Layer 7: Immutable Evidence Hash & SIU Brief ──
    claim_meta_for_hash = {
        "claimant_id": claimant_id,
        "garage_id": garage_id,
        "incident_city": incident_city,
        "incident_date": incident_date,
        "policy_state": policy_state,
        "total_claim_amount": total_claim_amount,
        "vehicle_claim": vehicle_claim,
        "incident_severity": incident_severity,
        "incident_type": incident_type,
        "incident_description": incident_description,
    }
    evidence_hashes = compute_evidence_hashes(claim_meta_for_hash, photo_buffers)

    siu_brief_data = generate_siu_brief(
        claim_data={
            "id": None,
            "composite_score": composite_score,
            "risk_level": comp_risk,
            "total_claim_amount": total_claim_amount,
            "vehicle_claim": vehicle_claim,
            "incident_severity": incident_severity,
            "incident_type": incident_type,
            "claimant_id": claimant_id,
            "garage_id": garage_id,
            "incident_city": incident_city,
            "policy_state": policy_state,
            "policy_annual_premium": policy_annual_premium,
            "incident_description": incident_description,
        },
        xgb_data={"fraud_score": xgb_fraud_score},
        gnn_data=gnn_result,
        cnn_data=cnn_data,
        fnol_data=fnol_result,
        explainability=explainability,
        evidence_hashes=evidence_hashes,
        tampering_data=tampering_summary,
        bill_padding_data=bill_padding_result,
    )

    # ── 8. Persist to Database ──
    entry = ClaimEntry(
        incident_severity          = incident_severity,
        incident_type              = incident_type,
        insured_hobbies            = insured_hobbies,
        total_claim_amount         = total_claim_amount,
        vehicle_claim              = vehicle_claim,
        umbrella_limit             = umbrella_limit,
        policy_annual_premium      = policy_annual_premium,
        incident_city              = incident_city,
        incident_date              = incident_date,
        policy_state               = policy_state,
        garage_id                  = garage_id,
        claimant_id                = claimant_id,
        predicted_class            = xgb_predicted,
        fraud_score                = xgb_fraud_score,
        fraud_probability          = round(fraud_prob, 4),
        non_fraud_probability      = round(non_fraud_prob, 4),
        risk_level                 = xgb_risk,
        recommendation             = xgb_rec,
        recommendation_label       = comp_rec,
        gnn_fraud_ring_score       = gnn_result["fraud_ring_score"],
        gnn_ring_risk              = gnn_result["ring_risk_level"],
        gnn_ring_hub               = gnn_result["ring_hub"],
        cnn_fraud_score            = cnn_fraud_score,
        composite_score            = composite_score,
        shap_summary               = json.dumps(shap_data),
        gradcam_focus              = gradcam_primary.get("focus_region") if gradcam_primary else None,
        xai_insights               = json.dumps(explainability["narrative"]),
        incident_description       = incident_description,
        fnol_score                 = fnol_result["fnol_score"] if fnol_result["analyzed"] else None,
        fnol_linguistic_flags      = json.dumps(fnol_result["linguistic_markers"]) if fnol_result["analyzed"] else None,
        contradiction_flags        = json.dumps(fnol_result["contradictions"]) if fnol_result["analyzed"] else None,
        evidence_sha256            = evidence_hashes["evidence_sha256"],
        photo_hashes_sha256        = json.dumps(evidence_hashes["photo_hashes_sha256"]),
        chain_of_custody_timestamp = evidence_hashes["chain_of_custody_timestamp"],
        siu_brief                  = json.dumps(siu_brief_data),
        tampering_flags            = json.dumps(tampering_summary),
        bill_padding_summary       = json.dumps(bill_padding_result),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    siu_brief_data["case_id"] = entry.id

    response_payload = sanitize_numpy({
        "id":                         entry.id,
        "timestamp":                  entry.created_at.isoformat() + "Z",
        "predicted_class":            xgb_predicted,
        "fraud_score":                xgb_fraud_score,
        "risk_level":                 xgb_risk,
        "garage_id":                  garage_id,
        "claimant_id":                claimant_id,
        "incident_city":              incident_city,
        "policy_state":               policy_state,
        "incident_description":       incident_description,
        "cnn":                        cnn_data,
        "xgboost": {
            "fraud_score":            xgb_fraud_score,
            "fraud_probability":      round(float(fraud_prob), 4),
            "non_fraud_probability":  round(float(non_fraud_prob), 4),
            "risk_level":             xgb_risk,
            "predicted_class":        xgb_predicted,
            "recommendation_label":   xgb_rec_label,
        },
        "gnn":                        gnn_result,
        "fnol":                       fnol_result,
        "tampering":                  tampering_summary,
        "bill_padding":               bill_padding_result,
        "composite": {
            "score":                  composite_score,
            "risk_level":             comp_risk,
            "verdict":                comp_verdict,
            "recommendation_label":   comp_rec,
        },
        "explainability":             explainability,
        "recommendation":             xgb_rec,
        "recommendation_label":       comp_rec,
        "model":                      "Unified Multi-Modal (CNN + XGBoost + GNN + FNOL + Tampering Forensics)",
        "overall_fraud_score":        cnn_fraud_score if cnn_fraud_score is not None else composite_score,
        "overall_risk_level":         comp_risk,
        "total_images_analyzed":      len(image_results),
        "duplicate_warnings":         duplicate_warnings,
        "image_results":              image_results,
        "summary":                    cnn_data.get("summary"),
        "evidence_sha256":            evidence_hashes["evidence_sha256"],
        "photo_hashes_sha256":        evidence_hashes["photo_hashes_sha256"],
        "chain_of_custody_timestamp": evidence_hashes["chain_of_custody_timestamp"],
        "siu_brief":                  siu_brief_data,
    })
    return response_payload


@app.post("/api/analyze-estimate")
async def analyze_estimate_endpoint(file: UploadFile = File(...)):
    """Standalone OCR parsing & OEM benchmarking endpoint for repair estimates / invoices."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No estimate file uploaded.")
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    result = analyze_estimate_document(contents, file.filename)
    return result


# ─── Layer 7 SIU PDF & Brief Endpoints ────────────────────────────────────────

@app.get("/api/claims/{claim_id}/export-pdf")
def export_claim_pdf(claim_id: int, db: Session = Depends(get_db)):
    """Generates and downloads a court-grade legal PDF evidence package for a saved claim."""
    entry = db.query(ClaimEntry).filter(ClaimEntry.id == claim_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found.")

    case_dict = entry.to_dict()
    
    photo_hashes = {}
    if entry.photo_hashes_sha256:
        try:
            photo_hashes = json.loads(entry.photo_hashes_sha256)
        except Exception:
            pass

    evidence_hashes = {
        "evidence_sha256": entry.evidence_sha256 or hashlib.sha256(str(entry.id).encode()).hexdigest(),
        "chain_of_custody_timestamp": entry.chain_of_custody_timestamp or (entry.created_at.isoformat() + "Z" if entry.created_at else datetime.now().isoformat() + "Z"),
        "photo_hashes_sha256": photo_hashes,
    }

    siu_brief_dict = {}
    if entry.siu_brief:
        try:
            siu_brief_dict = json.loads(entry.siu_brief)
        except Exception:
            pass

    if not siu_brief_dict:
        shap_dict = json.loads(entry.shap_summary) if entry.shap_summary else {}
        contradictions = json.loads(entry.contradiction_flags) if entry.contradiction_flags else []
        t_flags = json.loads(entry.tampering_flags) if entry.tampering_flags else None
        b_summary = json.loads(entry.bill_padding_summary) if entry.bill_padding_summary else None
        siu_brief_dict = generate_siu_brief(
            case_dict,
            xgb_data={"fraud_score": entry.fraud_score or 0.0},
            gnn_data={"fraud_ring_score": entry.gnn_fraud_ring_score or 0.0, "ring_hub": entry.gnn_ring_hub},
            cnn_data={"analyzed": entry.cnn_fraud_score is not None, "fraud_score": entry.cnn_fraud_score},
            fnol_data={"analyzed": entry.fnol_score is not None, "fnol_score": entry.fnol_score, "contradictions": contradictions},
            explainability={"shap": shap_dict, "gradcam": {"available": bool(entry.gradcam_focus), "focus_region": entry.gradcam_focus, "peak_activation_pct": 99.5}},
            evidence_hashes=evidence_hashes,
            tampering_data=t_flags,
            bill_padding_data=b_summary,
        )

    pdf_bytes = build_legal_pdf_report(case_dict, siu_brief_dict, evidence_hashes)
    filename = f"AutoShield_SIU_Dossier_Case_{claim_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


class CustomPdfRequest(BaseModel):
    case_data: Dict[str, Any]
    siu_brief: Optional[Dict[str, Any]] = None
    evidence_hashes: Optional[Dict[str, Any]] = None

@app.post("/api/claims/export-pdf-custom")
def export_custom_pdf(payload: CustomPdfRequest):
    """Generates and downloads a legal-grade PDF report directly from live analysis results."""
    case = payload.case_data
    hashes = payload.evidence_hashes or {
        "evidence_sha256": case.get("evidence_sha256") or hashlib.sha256(b"custom_live_case").hexdigest(),
        "chain_of_custody_timestamp": case.get("chain_of_custody_timestamp") or datetime.now().isoformat() + "Z",
        "photo_hashes_sha256": case.get("photo_hashes_sha256") or {},
    }
    brief = payload.siu_brief or case.get("siu_brief") or {}
    if not brief:
        t_flags = case.get("tampering") or (json.loads(case.get("tampering_flags")) if isinstance(case.get("tampering_flags"), str) else None)
        b_summary = case.get("bill_padding") or (json.loads(case.get("bill_padding_summary")) if isinstance(case.get("bill_padding_summary"), str) else None)
        brief = generate_siu_brief(
            case,
            xgb_data=case.get("xgboost", {}),
            gnn_data=case.get("gnn", {}),
            cnn_data=case.get("cnn", {}),
            fnol_data=case.get("fnol", {}),
            explainability=case.get("explainability", {}),
            evidence_hashes=hashes,
            tampering_data=t_flags,
            bill_padding_data=b_summary,
        )

    pdf_bytes = build_legal_pdf_report(case, brief, hashes)
    cid = case.get("id") or "LIVE"
    filename = f"AutoShield_SIU_Dossier_Case_{cid}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@app.post("/api/claims/{claim_id}/generate-siu-brief")
def refresh_siu_brief(claim_id: int, db: Session = Depends(get_db)):
    """Regenerates or updates the SIU briefing and deposition checklist for a claim."""
    entry = db.query(ClaimEntry).filter(ClaimEntry.id == claim_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found.")

    case_dict = entry.to_dict()
    photo_hashes = {}
    if entry.photo_hashes_sha256:
        try:
            photo_hashes = json.loads(entry.photo_hashes_sha256)
        except Exception:
            pass

    evidence_hashes = {
        "evidence_sha256": entry.evidence_sha256 or hashlib.sha256(str(entry.id).encode()).hexdigest(),
        "chain_of_custody_timestamp": entry.chain_of_custody_timestamp or (entry.created_at.isoformat() + "Z" if entry.created_at else datetime.now().isoformat() + "Z"),
        "photo_hashes_sha256": photo_hashes,
    }

    shap_dict = json.loads(entry.shap_summary) if entry.shap_summary else {}
    contradictions = json.loads(entry.contradiction_flags) if entry.contradiction_flags else []
    brief = generate_siu_brief(
        case_dict,
        xgb_data={"fraud_score": entry.fraud_score or 0.0},
        gnn_data={"fraud_ring_score": entry.gnn_fraud_ring_score or 0.0, "ring_hub": entry.gnn_ring_hub},
        cnn_data={"analyzed": entry.cnn_fraud_score is not None, "fraud_score": entry.cnn_fraud_score},
        fnol_data={"analyzed": entry.fnol_score is not None, "fnol_score": entry.fnol_score, "contradictions": contradictions},
        explainability={"shap": shap_dict, "gradcam": {"available": bool(entry.gradcam_focus), "focus_region": entry.gradcam_focus, "peak_activation_pct": 99.5}},
        evidence_hashes=evidence_hashes,
    )
    brief["case_id"] = entry.id
    entry.siu_brief = json.dumps(brief)
    db.commit()
    return brief

# Serve frontend static build ONLY (do NOT mount raw src/ — it swallows API routes in dev mode)
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")

