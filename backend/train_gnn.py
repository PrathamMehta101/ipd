import os
import joblib
import numpy as np
import pandas as pd
from collections import defaultdict
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score, f1_score

# ── 1. Setup paths
DATA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "insurance_claims.csv"))
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))
os.makedirs(MODEL_DIR, exist_ok=True)

print(f"Loading dataset from: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
df['fraud_reported'] = df['fraud_reported'].map({'Y': 1, 'N': 0})
df = df.replace('?', 'Unknown')

# ── 2. Feature Extraction
FEATURE_COLS = [
    'incident_severity',
    'total_claim_amount',
    'insured_hobbies',
    'vehicle_claim',
    'incident_type',
    'umbrella_limit',
    'policy_annual_premium',
    'incident_city',
    'policy_state'
]

categorical_cols = ['incident_severity', 'insured_hobbies', 'incident_type', 'incident_city', 'policy_state']
numeric_cols = ['total_claim_amount', 'vehicle_claim', 'umbrella_limit', 'policy_annual_premium']

encoders = {}
X_cat = []
for col in categorical_cols:
    le = LabelEncoder()
    encoded = le.fit_transform(df[col].astype(str))
    encoders[col] = le
    X_cat.append(encoded)

X_cat = np.column_stack(X_cat)

scaler = StandardScaler()
X_num = scaler.fit_transform(df[numeric_cols])

# Add graph topological features
# (Garage density & claimant frequency)
garage_counts = df['garage_id'].value_counts().to_dict()
claimant_counts = df['claimant_id'].value_counts().to_dict()

df_garage_density = df['garage_id'].map(garage_counts).fillna(1).values.reshape(-1, 1)
df_claimant_freq = df['claimant_id'].map(claimant_counts).fillna(1).values.reshape(-1, 1)

topo_scaler = StandardScaler()
X_topo = topo_scaler.fit_transform(np.hstack([df_garage_density, df_claimant_freq]))

X_all = np.hstack([X_num, X_cat, X_topo])
y_all = df['fraud_reported'].values

print(f"Feature matrix shape: {X_all.shape}")

# ── 3. Construct Graph Adjacency Matrix
N = len(df)
adj = np.zeros((N, N), dtype=np.float32)

garage_map = defaultdict(list)
claimant_map = defaultdict(list)
city_map = defaultdict(list)

for i, row in df.iterrows():
    if pd.notna(row['garage_id']) and row['garage_id']:
        garage_map[row['garage_id']].append(i)
    if pd.notna(row['claimant_id']) and row['claimant_id']:
        claimant_map[row['claimant_id']].append(i)
    if pd.notna(row['incident_city']) and row['incident_city']:
        city_map[row['incident_city']].append(i)

# Connect shared garage (weight 3.0)
for gid, indices in garage_map.items():
    for a in indices:
        for b in indices:
            if a != b:
                adj[a, b] += 3.0

# Connect shared claimant (weight 2.5)
for cid, indices in claimant_map.items():
    for a in indices:
        for b in indices:
            if a != b:
                adj[a, b] += 2.5

# Connect shared city (weight 0.4)
for city, indices in city_map.items():
    for a in indices:
        for b in indices:
            if a != b and adj[a, b] > 0: # reinforce existing link
                adj[a, b] += 0.4

# Add self-loops
for i in range(N):
    adj[i, i] += 1.0

# Symmetric normalization: D^{-1/2} A D^{-1/2}
deg = np.sum(adj, axis=1)
deg_inv_sqrt = np.power(deg, -0.5, where=deg > 0)
deg_inv_sqrt[deg == 0] = 0.0
D_inv = np.diag(deg_inv_sqrt)
adj_norm = D_inv @ adj @ D_inv

print(f"Graph Adjacency constructed: {N} nodes, {int(np.sum(adj > 0) - N)} edges")

# ── 4. Define GNN Architecture in PyTorch
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

# ── 5. Train / Test Split
train_idx, test_idx = train_test_split(np.arange(N), test_size=0.2, random_state=42, stratify=y_all)

X_tensor = torch.tensor(X_all, dtype=torch.float32)
A_tensor = torch.tensor(adj_norm, dtype=torch.float32)
y_tensor = torch.tensor(y_all, dtype=torch.float32)

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Training on device: {device}")

model = FraudRingGNN(in_dim=X_all.shape[1], hidden_dim=64, out_dim=32, dropout=0.2).to(device)
X_tensor = X_tensor.to(device)
A_tensor = A_tensor.to(device)
y_tensor = y_tensor.to(device)

# Handle class weight for fraud imbalance
pos_weight = torch.tensor([(len(y_all) - np.sum(y_all)) / np.sum(y_all)]).to(device)
criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-4)

# Training loop
model.train()
best_auc = 0.0
best_state = None

print("\nTraining GNN Model...")
for epoch in range(1, 201):
    optimizer.zero_grad()
    logits, _ = model(X_tensor, A_tensor)
    loss = criterion(logits[train_idx], y_tensor[train_idx])
    loss.backward()
    optimizer.step()

    if epoch % 20 == 0 or epoch == 200:
        model.eval()
        with torch.no_grad():
            test_logits, _ = model(X_tensor, A_tensor)
            test_probs = torch.sigmoid(test_logits[test_idx]).cpu().numpy()
            y_test = y_tensor[test_idx].cpu().numpy()
            auc = roc_auc_score(y_test, test_probs)
            preds = (test_probs >= 0.5).astype(int)
            acc = accuracy_score(y_test, preds)
            f1 = f1_score(y_test, preds)
            print(f"Epoch {epoch:03d} | Train Loss: {loss.item():.4f} | Test AUC: {auc:.4f} | Acc: {acc:.4f} | F1: {f1:.4f}")
            if auc > best_auc:
                best_auc = auc
                best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        model.train()

# Load best model weights
model.load_state_dict(best_state)
model.eval()

with torch.no_grad():
    final_logits, final_emb = model(X_tensor, A_tensor)
    final_probs = torch.sigmoid(final_logits[test_idx]).cpu().numpy()
    y_test = y_tensor[test_idx].cpu().numpy()
    final_preds = (final_probs >= 0.5).astype(int)

print("\n--- Final GNN Evaluation Results ---")
print(f"Best Test ROC-AUC: {best_auc:.4f}")
print(f"Test Accuracy: {accuracy_score(y_test, final_preds):.4f}")
print(f"Test F1 Score: {f1_score(y_test, final_preds):.4f}")
print("\nClassification Report:")
print(classification_report(y_test, final_preds, target_names=['Non-Fraud', 'Fraud']))

# ── 6. Save Model and Artifacts
torch.save(best_state, os.path.join(MODEL_DIR, "gnn_fraud_ring.pth"))

gnn_pack = {
    'in_dim': X_all.shape[1],
    'hidden_dim': 64,
    'out_dim': 32,
    'dropout': 0.2,
    'encoders': encoders,
    'scaler': scaler,
    'topo_scaler': topo_scaler,
    'categorical_cols': categorical_cols,
    'numeric_cols': numeric_cols,
    'garage_counts': garage_counts,
    'claimant_counts': claimant_counts,
    # Store reference graph for dynamic inference
    'ref_df': df[['garage_id', 'claimant_id', 'incident_city', 'fraud_reported']].copy(),
    'ref_X': X_all,
    'ref_adj': adj,
    'classes': ['Non-Fraud', 'Fraud'],
}

joblib.dump(gnn_pack, os.path.join(MODEL_DIR, "gnn_artifacts.pkl"))
print(f"\nGNN model saved to: {os.path.join(MODEL_DIR, 'gnn_fraud_ring.pth')}")
print(f"GNN artifacts saved to: {os.path.join(MODEL_DIR, 'gnn_artifacts.pkl')}")
