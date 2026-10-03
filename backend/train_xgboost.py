import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score, confusion_matrix
import xgboost as xgb

# 1. Load Dataset
DATA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "insurance_claims.csv"))
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))
os.makedirs(MODEL_DIR, exist_ok=True)

print(f"Loading dataset from: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)

# Clean target
df['fraud_reported'] = df['fraud_reported'].map({'Y': 1, 'N': 0})

# Replace '?' with NaN or unknown category
df = df.replace('?', 'Unknown')

# Top Selected 6 Best Features for Tabular Fraud Prediction
FEATURE_COLS = [
    'incident_severity',
    'total_claim_amount',
    'insured_hobbies',
    'vehicle_claim',
    'incident_type',
    'umbrella_limit',
    'policy_annual_premium'
]

TARGET_COL = 'fraud_reported'

print(f"\nSelected Features: {FEATURE_COLS}")

# Prepare Feature Matrix X and Target Y
X = df[FEATURE_COLS].copy()
y = df[TARGET_COL].values

# Label Encoders for Categorical Features
categorical_cols = ['incident_severity', 'insured_hobbies', 'incident_type']
encoders = {}

for col in categorical_cols:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col].astype(str))
    encoders[col] = le
    print(f"Encoded '{col}': {list(le.classes_)}")

# Numeric scaling
scaler = StandardScaler()
X_scaled = X.copy()
numeric_cols = ['total_claim_amount', 'vehicle_claim', 'umbrella_limit', 'policy_annual_premium']
X_scaled[numeric_cols] = scaler.fit_transform(X[numeric_cols])

# Handle Class Imbalance using SMOTE or Synthetic Oversampling
try:
    from imblearn.over_sampling import SMOTE
    print("\nApplying SMOTE for class imbalance mitigation...")
    smote = SMOTE(random_state=42)
    X_resampled, y_resampled = smote.fit_resample(X_scaled, y)
    print(f"Original class counts: {np.bincount(y)}")
    print(f"Resampled class counts: {np.bincount(y_resampled)}")
except ImportError:
    print("\nimbalanced-learn (SMOTE) not found. Applying Manual Synthetic Random Oversampling...")
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]
    num_to_sample = len(neg_idx) - len(pos_idx)
    oversampled_pos = np.random.choice(pos_idx, size=num_to_sample, replace=True)
    resampled_idx = np.concatenate([np.arange(len(y)), oversampled_pos])
    X_resampled = X_scaled.iloc[resampled_idx].reset_index(drop=True)
    y_resampled = y[resampled_idx]
    print(f"Resampled class counts: Fraud (1)={np.sum(y_resampled==1)}, Non-Fraud (0)={np.sum(y_resampled==0)}")

# Train / Test Split
X_train, X_test, y_train, y_test = train_test_split(
    X_resampled, y_resampled, test_size=0.2, random_state=42, stratify=y_resampled
)

# Train XGBoost Classifier
print("\nTraining XGBoost Classifier model...")
model = xgb.XGBClassifier(
    n_estimators=150,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=1.0,
    random_state=42,
    eval_metric='logloss'
)

model.fit(X_train, y_train)

# Evaluate Model
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print("\n--- Model Evaluation Results ---")
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
print(f"ROC-AUC Score: {roc_auc_score(y_test, y_proba):.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Non-Fraud', 'Fraud']))

# Save Model & Artifacts
artifact_pack = {
    'model': model,
    'encoders': encoders,
    'scaler': scaler,
    'feature_cols': FEATURE_COLS,
    'categorical_cols': categorical_cols,
    'numeric_cols': numeric_cols,
    'classes': ['Non-Fraud', 'Fraud']
}

save_path = os.path.join(MODEL_DIR, "xgboost_claim_fraud.pkl")
joblib.dump(artifact_pack, save_path)
print(f"\nModel and preprocessors successfully saved to: {save_path}")
