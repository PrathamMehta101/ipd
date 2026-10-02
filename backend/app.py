import os
import io
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image, ImageOps, ExifTags
import imagehash
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Car Insurance Fraud Detection API",
    description="AI-powered car accident image preprocessing & fraud detection CNN model API",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "cnn-context", "car_fraud_resnet50.pth")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = None
class_names = ["Fraud", "Non-Fraud"]

# Image transform pipeline matching training validation transform exactly
inference_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def load_cnn_model():
    global model, class_names
    abs_path = os.path.abspath(MODEL_PATH)
    if not os.path.exists(abs_path):
        print(f"Warning: Model file not found at {abs_path}")
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
        model = net
        print(f"Model loaded successfully! Classes: {class_names}")
        return True
    except Exception as e:
        print(f"Error loading model: {e}")
        return False

# Attempt to load model on startup
@app.on_event("startup")
async def startup_event():
    load_cnn_model()

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
    if model is None:
        load_cnn_model()
        
    if model is None:
        raise HTTPException(status_code=500, detail="CNN model is not initialized.")
        
    with torch.no_grad():
        logits = model(input_batch)
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
        "model_loaded": model is not None,
        "device": str(device),
        "model_path": MODEL_PATH,
        "classes": class_names
    }

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

# Serve frontend static build or source directory
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
elif os.path.exists(src_dir):
    app.mount("/", StaticFiles(directory=src_dir, html=True), name="frontend")
