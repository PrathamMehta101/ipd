"""
database.py — SQLite database setup with SQLAlchemy 2.0
Stores all XGBoost tabular claim prediction entries.
"""

import os
from datetime import datetime

from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    DateTime, Boolean, Text, Index, text
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# ─── DB path ──────────────────────────────────────────────────────────────────
DB_DIR  = os.path.abspath(os.path.join(os.path.dirname(__file__), "db"))
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "fraud_claims.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class ClaimEntry(Base):
    __tablename__ = "claim_entries"

    id                    = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at            = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Input features (ML)
    incident_severity     = Column(String(64),  nullable=False)
    incident_type         = Column(String(64),  nullable=False)
    insured_hobbies       = Column(String(64),  nullable=False)
    total_claim_amount    = Column(Float,        nullable=False)
    vehicle_claim         = Column(Float,        nullable=False)
    umbrella_limit        = Column(Float,        nullable=False, default=0.0)
    policy_annual_premium = Column(Float,        nullable=False)

    # Metadata fields (informational, shown in graph/table)
    incident_city         = Column(String(128), nullable=True)
    incident_date         = Column(String(32),  nullable=True)
    policy_state          = Column(String(8),   nullable=True)
    garage_id             = Column(String(64),  nullable=True)   # repair garage identifier
    claimant_id           = Column(String(64),  nullable=True)   # person filing claim

    # Model outputs
    predicted_class       = Column(String(16),  nullable=False)
    fraud_score           = Column(Float,        nullable=False)
    fraud_probability     = Column(Float,        nullable=False)
    non_fraud_probability = Column(Float,        nullable=False)
    risk_level            = Column(String(16),  nullable=False)
    recommendation        = Column(String(32),  nullable=False)
    recommendation_label  = Column(Text,         nullable=False)
    model_name            = Column(String(64),  nullable=False, default="XGBoost (Tabular)")

    # GNN & Multimodal Tri-Modal fields
    gnn_fraud_ring_score  = Column(Float,        nullable=True, default=0.0)
    gnn_ring_risk         = Column(String(32),   nullable=True)
    gnn_ring_hub          = Column(String(64),   nullable=True)
    cnn_fraud_score       = Column(Float,        nullable=True)
    composite_score       = Column(Float,        nullable=True)

    # Review fields
    analyst_reviewed      = Column(Boolean, default=False)
    analyst_verdict       = Column(String(16), nullable=True)
    notes                 = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_created_at",     "created_at"),
        Index("ix_risk_level",     "risk_level"),
        Index("ix_predicted_class","predicted_class"),
    )

    def to_dict(self):
        return {
            "id":                    self.id,
            "created_at":            self.created_at.isoformat() + "Z" if self.created_at else None,
            "incident_severity":     self.incident_severity,
            "incident_type":         self.incident_type,
            "insured_hobbies":       self.insured_hobbies,
            "total_claim_amount":    self.total_claim_amount,
            "vehicle_claim":         self.vehicle_claim,
            "umbrella_limit":        self.umbrella_limit,
            "policy_annual_premium": self.policy_annual_premium,
            "incident_city":         self.incident_city,
            "incident_date":         self.incident_date,
            "policy_state":          self.policy_state,
            "garage_id":             self.garage_id,
            "claimant_id":           self.claimant_id,
            "predicted_class":       self.predicted_class,
            "fraud_score":           self.fraud_score,
            "fraud_probability":     self.fraud_probability,
            "non_fraud_probability": self.non_fraud_probability,
            "risk_level":            self.risk_level,
            "recommendation":        self.recommendation,
            "recommendation_label":  self.recommendation_label,
            "model_name":            self.model_name,
            "gnn_fraud_ring_score":  self.gnn_fraud_ring_score or 0.0,
            "gnn_ring_risk":         self.gnn_ring_risk,
            "gnn_ring_hub":          self.gnn_ring_hub,
            "cnn_fraud_score":       self.cnn_fraud_score,
            "composite_score":       self.composite_score,
            "analyst_reviewed":      self.analyst_reviewed,
            "analyst_verdict":       self.analyst_verdict,
            "notes":                 self.notes,
        }


def init_db():
    """Create tables + run lightweight column migrations for existing DBs."""
    Base.metadata.create_all(bind=engine)

    # Inline migration: add new columns if they don't exist yet
    new_cols = [
        ("incident_city",         "VARCHAR(128)"),
        ("incident_date",         "VARCHAR(32)"),
        ("policy_state",          "VARCHAR(8)"),
        ("garage_id",             "VARCHAR(64)"),
        ("claimant_id",           "VARCHAR(64)"),
        ("gnn_fraud_ring_score",  "FLOAT"),
        ("gnn_ring_risk",         "VARCHAR(32)"),
        ("gnn_ring_hub",          "VARCHAR(64)"),
        ("cnn_fraud_score",       "FLOAT"),
        ("composite_score",       "FLOAT"),
    ]
    with engine.connect() as conn:
        for col_name, col_type in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE claim_entries ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"[DB] Added column: {col_name}")
            except Exception:
                pass  # Column already exists

    print(f"[DB] Database ready at: {DB_PATH}")


def get_db():
    """FastAPI dependency — yields a DB session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
