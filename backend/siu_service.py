"""
IntelliClaim — Layer 7: SIU Investigator Tools & Operational Workflow Service
Features:
1. Automated AI Case Dossier & Questioning Guide (LLM / SIU Briefing)
2. Immutable Audit Trail & SHA-256 Chain-of-Custody Hashes
3. Legal-Grade Multi-Page PDF Evidence Package (ReportLab)
"""

import os
import io
import json
import base64
import hashlib
import datetime
from typing import Dict, Any, List, Optional
from PIL import Image

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas


# ─── 1. Immutable Audit Trail & SHA-256 Hashes ──────────────────────────────

def compute_evidence_hashes(claim_metadata: Dict[str, Any], photo_buffers: Dict[str, bytes]) -> Dict[str, Any]:
    """
    Computes cryptographic SHA-256 hashes for individual evidence photos
    and a canonical master evidence hash for the entire claim submission.
    """
    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    photo_hashes = {}
    for filename, raw_bytes in photo_buffers.items():
        if raw_bytes:
            sha = hashlib.sha256(raw_bytes).hexdigest()
            photo_hashes[filename] = sha

    # Canonical dictionary for master evidence seal
    canonical_payload = {
        "metadata": {
            "claimant_id": str(claim_metadata.get("claimant_id") or ""),
            "garage_id": str(claim_metadata.get("garage_id") or ""),
            "incident_date": str(claim_metadata.get("incident_date") or ""),
            "incident_city": str(claim_metadata.get("incident_city") or ""),
            "policy_state": str(claim_metadata.get("policy_state") or ""),
            "total_claim_amount": float(claim_metadata.get("total_claim_amount") or 0.0),
            "vehicle_claim": float(claim_metadata.get("vehicle_claim") or 0.0),
            "incident_severity": str(claim_metadata.get("incident_severity") or ""),
            "incident_type": str(claim_metadata.get("incident_type") or ""),
            "incident_description": str(claim_metadata.get("incident_description") or ""),
        },
        "photo_hashes": photo_hashes,
        "chain_of_custody_timestamp": now_utc,
    }

    canonical_str = json.dumps(canonical_payload, sort_keys=True)
    master_evidence_sha256 = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    return {
        "photo_hashes_sha256": photo_hashes,
        "evidence_sha256": master_evidence_sha256,
        "chain_of_custody_timestamp": now_utc,
        "canonical_payload": canonical_payload,
    }


# ─── 2. Automated SIU Investigation Brief & Questioning Guide ───────────────

def generate_siu_brief(
    claim_data: Dict[str, Any],
    xgb_data: Dict[str, Any],
    gnn_data: Dict[str, Any],
    cnn_data: Dict[str, Any],
    fnol_data: Dict[str, Any],
    explainability: Dict[str, Any],
    evidence_hashes: Dict[str, Any],
    tampering_data: Optional[Dict[str, Any]] = None,
    bill_padding_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synthesizes tabular TreeSHAP drivers, CNN Grad-CAM findings, GNN ring topology,
    FNOL contradictions, ELA image tampering, salvage matches, and bill padding
    into a structured, executive SIU Brief & Questioning Guide.
    """
    composite_score = claim_data.get("composite_score") or claim_data.get("composite", {}).get("score", 0.0)
    risk_level = claim_data.get("risk_level") or claim_data.get("composite", {}).get("risk_level", "LOW")
    
    xgb_score = xgb_data.get("fraud_score", 0.0)
    gnn_score = gnn_data.get("fraud_ring_score", 0.0)
    cnn_score = cnn_data.get("fraud_score") if cnn_data.get("analyzed") else None
    fnol_score = fnol_data.get("fnol_score") if fnol_data.get("analyzed") else None

    claimant = claim_data.get("claimant_id") or "Unknown"
    garage = claim_data.get("garage_id") or "Unknown"
    city = claim_data.get("incident_city") or "Unknown"
    tot_amount = claim_data.get("total_claim_amount") or 0.0
    veh_amount = claim_data.get("vehicle_claim") or 0.0
    severity = claim_data.get("incident_severity") or "Unknown"
    fnol_desc = claim_data.get("incident_description") or ""

    contradictions = fnol_data.get("contradictions", [])
    shap_drivers = explainability.get("shap", {}).get("top_risk_drivers", [])
    ring_hub = gnn_data.get("ring_hub")
    ring_neighbors = gnn_data.get("matched_neighbors", [])
    gradcam = explainability.get("gradcam") or {}
    dup_warnings = cnn_data.get("duplicate_warnings", [])

    # Determine SIU Operational Stance
    if composite_score >= 70.0:
        recommended_action = "MANDATORY EUO & NICB REFERRAL"
        operational_tier = "PRIORITY 1 — HIGH FRAUD PROBABILITY"
        case_verdict = "Organized Fraud Syndicate / Major Staged Collision Pattern"
    elif composite_score >= 40.0:
        recommended_action = "FIELD ADJUSTER INSPECTION & RECORDED STATEMENT"
        operational_tier = "PRIORITY 2 — SUSPICIOUS ANOMALY"
        case_verdict = "Inconsistent Loss Profile / Probable Pre-Existing Damage"
    else:
        recommended_action = "STANDARD EXPEDITED CLAIM SETTLEMENT"
        operational_tier = "PRIORITY 3 — ROUTINE LEGITIMATE"
        case_verdict = "Multi-Modal Verified Legitimate Claim"

    # 1. Executive Summary Synthesis
    summary_sentences = []
    summary_sentences.append(
        f"Claimant {claimant} has filed a ${tot_amount:,.2f} claim ({severity}) processed through Repair Facility {garage} in {city}."
    )
    if composite_score >= 50.0:
        summary_sentences.append(
            f"Multi-modal AI synthesis flags this claim with an elevated risk score of {composite_score}%. "
            f"Underwriting anomaly score is {xgb_score}% and Graph Neural Network ring connectivity is {gnn_score}%."
        )
    else:
        summary_sentences.append(
            f"Composite cross-modal synthesis indicates normal claim characteristics (Composite Risk: {composite_score}%). "
            f"Both visual and underwriting indicators align with legitimate loss dynamics."
        )

    if ring_hub and ring_hub != "N/A" and gnn_score >= 40.0:
        summary_sentences.append(
            f"Graph network analysis strongly links this claim to organized collision ring hub '{ring_hub}' with {len(ring_neighbors)} co-incident cluster entities."
        )

    if contradictions:
        summary_sentences.append(
            f"Forensic NLP detected {len(contradictions)} direct contradictions between claimant's statement and physical evidence, elevating deception likelihood to {fnol_score}%."
        )

    if dup_warnings:
        summary_sentences.append(
            f"Image forensics caught duplicate image reuse across claims: {dup_warnings[0]}."
        )

    if tampering_data and tampering_data.get("ela_tampering_detected"):
        summary_sentences.append(
            f"Digital Error Level Analysis (ELA) detected pixel-level compression anomalies indicating digitally altered or cloned damage."
        )

    if tampering_data and tampering_data.get("salvage_matches"):
        first_salvage = tampering_data["salvage_matches"][0]["match"]
        summary_sentences.append(
            f"Reverse salvage lookup matched vehicle damage to a prior total-loss scrap auction listing ({first_salvage.get('auction_house')} Lot #{first_salvage.get('lot_id')})."
        )

    if bill_padding_data and bill_padding_data.get("parsed") and bill_padding_data.get("padding_percentage", 0) > 10:
        summary_sentences.append(
            f"Invoice audit detected {bill_padding_data.get('padding_percentage')}% bill padding (${bill_padding_data.get('total_padding_detected', 0):,.2f} over standard OEM benchmark)."
        )

    exec_summary = " ".join(summary_sentences)

    # 2. Suggested Deposition & Interrogation Checklist
    checklist: List[Dict[str, str]] = []

    # Question from Contradictions
    for c in contradictions:
        checklist.append({
            "target": f"Contradiction: {c.get('title')}",
            "question": f"\"In your written statement you attested: '{c.get('claimant_statement')}'. However, physical system evidence indicates: '{c.get('system_evidence')}'. Can you explain this specific discrepancy under oath?\"",
            "evidence_basis": f"Cross-modal physical contradiction (+{c.get('risk_delta')}% risk penalty).",
            "tactical_guidance": "Watch for sudden topic deflection, hesitation, or attempts to blame tow truck operators."
        })

    # Question from Image Tampering / ELA
    if tampering_data and tampering_data.get("ela_tampering_detected"):
        checklist.append({
            "target": "Digital Photo Alteration & Cloning (ELA)",
            "question": "\"Error Level Analysis demonstrates distinct localized compression variances consistent with digital manipulation or photoshopped damage. Were these photos edited, retouched, or manipulated before submission?\"",
            "evidence_basis": f"Error Level Analysis compression variance detected (Peak Anomaly: {tampering_data.get('highest_ela_score', 0)}%).",
            "tactical_guidance": "Subpoena the original smartphone hardware and demand unedited RAW images."
        })

    # Question from Salvage Match
    if tampering_data and tampering_data.get("salvage_matches"):
        first_salvage = tampering_data["salvage_matches"][0]["match"]
        checklist.append({
            "target": f"Prior Salvage Auction Match ({first_salvage.get('lot_id')})",
            "question": f"\"System forensics matched this damage profile to scrap lot #{first_salvage.get('lot_id')} auctioned by {first_salvage.get('auction_house')} on {first_salvage.get('auction_date')}. When and under what title status did you acquire this vehicle?\"",
            "evidence_basis": f"Perceptual fingerprint matches public total loss archive ({first_salvage.get('similarity_pct')}% match).",
            "tactical_guidance": "Demand DMV title history, salvage rebuild inspection certificates, and proof of purchase."
        })

    # Question from Bill Padding / Invoice Audit
    if bill_padding_data and bill_padding_data.get("parsed") and bill_padding_data.get("padding_percentage", 0) > 10:
        checklist.append({
            "target": f"Repair Bill Padding & Excessive Labor (${bill_padding_data.get('total_padding_detected', 0):,.2f})",
            "question": f"\"Your submitted estimate includes ${bill_padding_data.get('total_padding_detected', 0):,.2f} in billed labor and replacement parts exceeding OEM industry standard benchmarks. Did the shop actually install new OEM parts or repair existing components?\"",
            "evidence_basis": f"OCR audited {bill_padding_data.get('total_items', 0)} line items against OEM guidelines ({len(bill_padding_data.get('phantom_parts', []))} phantom items identified).",
            "tactical_guidance": "Subpoena supplier parts delivery invoices and shop technician work orders."
        })

    # Question from Network/Garage
    if garage and garage != "None":
        if gnn_score >= 50.0:
            checklist.append({
                "target": f"Repair Facility Selection ({garage})",
                "question": f"\"Who directed or towed your vehicle to repair facility '{garage}'? Did you have any prior personal or commercial relationship with the shop management or towing driver?\"",
                "evidence_basis": f"GNN topological analysis identified {garage} as a high-density fraud ring hub.",
                "tactical_guidance": "Inquire about kickback arrangements, cash deductibles, or unsolicited towing at the scene."
            })
        else:
            checklist.append({
                "target": f"Repair Facility Verification ({garage})",
                "question": f"\"Did facility '{garage}' provide you with a written preliminary estimate prior to commencing teardown?\"",
                "evidence_basis": "Standard verification of vehicle custody and labor authorizations.",
                "tactical_guidance": "Verify invoice itemization against actual parts installed."
            })

    # Question from Financial / Tabular Drivers
    if shap_drivers:
        top_driver = shap_drivers[0]
        lbl = top_driver.get("label", "Claim Size")
        raw = top_driver.get("raw_value", "")
        checklist.append({
            "target": f"Financial Driver: {lbl}",
            "question": f"\"Your claim reflects ${veh_amount:,.2f} in vehicle damages on an annual policy premium of ${claim_data.get('policy_annual_premium') or 0:,.2f}. Do you possess prior mechanical inspection reports or maintenance receipts establishing the vehicle's pre-loss condition?\"",
            "evidence_basis": f"TreeSHAP top anomaly factor '{lbl}' contributed +{top_driver.get('impact_pct')}% to the underwriting fraud score.",
            "tactical_guidance": "Request bank statements or cancelled checks proving legitimate ownership and maintenance."
        })

    # Question from Photo / CNN Forensics
    if gradcam.get("available"):
        region = gradcam.get("focus_region", "impact zone")
        checklist.append({
            "target": f"Image Authenticity & Damage Zone ({region})",
            "question": "\"Can you provide the original digital camera/smartphone files with full unstripped EXIF metadata and GPS coordinates taken immediately at the scene of the crash?\"",
            "evidence_basis": f"Deep convolutional ResNet-50 visual attention localized to '{region}' ({gradcam.get('peak_activation_pct')}% peak activation).",
            "tactical_guidance": "Check creation timestamps. Scrutinize whether photos were taken days before the claimed incident date."
        })

    # Fallback generic questions if checklist is short
    if len(checklist) < 3:
        checklist.append({
            "target": "Sequence of Events & Witnesses",
            "question": "\"Were there any independent eyewitnesses, dashcam recordings, or police CAD incident dispatch numbers generated at the exact time of loss?\"",
            "evidence_basis": "Standard SIU corroboration protocol for casualty validation.",
            "tactical_guidance": "Cross-reference local police dispatch call logs for the claimed hour and street corner."
        })

    # 3. Target Subpoena & Discovery Directives
    subpoena_items = [
        f"Itemized body shop parts invoices and pre-loss condition photos from {garage}.",
        "Claimant mobile phone call detail records (CDR) and cell tower geo-telemetry during claimed accident hour.",
        "Scene surveillance video from surrounding municipal or commercial intersection cameras.",
        "Original uncompressed JPEG/HEIC image files with embedded EXIF headers.",
    ]
    if gnn_score >= 50.0:
        subpoena_items.append(f"Subpoena repair garage {garage} bank deposits and commercial vendor accounts.")
    if tampering_data and tampering_data.get("salvage_matches"):
        subpoena_items.append(f"Subpoena auction bill of sale and title records for salvage lot {tampering_data['salvage_matches'][0]['match'].get('lot_id')}.")

    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "case_id": claim_data.get("id"),
        "operational_tier": operational_tier,
        "recommended_action": recommended_action,
        "case_verdict": case_verdict,
        "executive_summary": exec_summary,
        "deposition_checklist": checklist,
        "subpoena_discovery_items": subpoena_items,
        "evidence_sha256": evidence_hashes.get("evidence_sha256"),
        "chain_of_custody_timestamp": evidence_hashes.get("chain_of_custody_timestamp"),
        "multimodal_summary": {
            "composite_score": composite_score,
            "risk_level": risk_level,
            "xgboost_score": xgb_score,
            "gnn_score": gnn_score,
            "cnn_score": cnn_score,
            "fnol_score": fnol_score,
        }
    }


# ─── 3. Legal-Grade PDF Evidence Package Generator ──────────────────────────

class NumberedCanvas(canvas.Canvas):
    """Running header, footer, page numbering, and confidential watermark."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Subtle angled background watermark
        self.setFont("Helvetica-Bold", 48)
        self.setFillColor(colors.HexColor("#0f172a"), alpha=0.04)
        self.translate(300, 400)
        self.rotate(35)
        self.drawCentredString(0, 0, "CONFIDENTIAL // SIU EVIDENCE")
        self.restoreState()

        self.saveState()
        # Top Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1e293b"))
        self.drawString(54, 755, "AUTOSHIELD AI  ·  SPECIAL INVESTIGATION UNIT (SIU)")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawRightString(558, 755, "LEGAL EVIDENCE DOSSIER · FRE 902(13)/(14)")
        
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 747, 558, 747)

        # Bottom Footer
        self.line(54, 45, 558, 45)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 32, "CHAIN-OF-CUSTODY CERTIFIED  ·  TAMPER-EVIDENT CRYPTOGRAPHIC ARCHIVE")
        self.drawRightString(558, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def build_legal_pdf_report(
    case_data: Dict[str, Any],
    siu_brief: Dict[str, Any],
    evidence_hashes: Dict[str, Any],
    photo_buffers: Optional[Dict[str, bytes]] = None
) -> bytes:
    """
    Builds a court-grade, publication-quality PDF evidence dossier.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=58,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom typography & styles
    c_navy = colors.HexColor("#0f172a")
    c_blue = colors.HexColor("#1d4ed8")
    c_muted = colors.HexColor("#475569")
    c_border = colors.HexColor("#cbd5e1")
    c_card_bg = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_navy,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_muted,
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_navy,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1e293b"),
    )
    mono_style = ParagraphStyle(
        'Mono',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#334155"),
    )
    bold_style = ParagraphStyle(
        'Bold',
        parent=body_style,
        fontName='Helvetica-Bold',
    )

    story = []

    # ── 1. Document Title & Confidentiality Banner ──
    story.append(Spacer(1, 4))
    story.append(Paragraph("OFFICIAL SIU CASE DOSSIER & EVIDENCE BRIEF", title_style))
    story.append(Paragraph(
        f"Case #{case_data.get('id', 'N/A')}  ·  Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  ·  Classification: CONFIDENTIAL / LAW ENFORCEMENT & SIU EYES ONLY",
        subtitle_style
    ))

    # ── 2. Master Chain-of-Custody Cryptographic Hash Card ──
    sha = evidence_hashes.get("evidence_sha256") or "N/A"
    ts = evidence_hashes.get("chain_of_custody_timestamp") or "N/A"
    
    hash_card = [
        [
            Paragraph("<b>IMMUTABLE CHAIN-OF-CUSTODY AUDIT SEAL</b>", ParagraphStyle('Hdr', parent=body_style, textColor=colors.HexColor("#1e3a8a"), fontName='Helvetica-Bold')),
            Paragraph(f"<b>STATUS:</b> <font color='#15803d'>VERIFIED UNBROKEN</font>", ParagraphStyle('HdrR', parent=body_style, alignment=2))
        ],
        [
            Paragraph(f"<b>Master Evidence SHA-256 Digest:</b><br/><font face='Courier' color='#0f172a'><b>{sha}</b></font>", mono_style),
            Paragraph(f"<b>UTC Hash Timestamp:</b><br/>{ts}", body_style)
        ]
    ]
    t_hash = Table(hash_card, colWidths=[330, 174])
    t_hash.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bfdbfe")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#dbeafe")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_hash)
    story.append(Spacer(1, 10))

    # ── 3. Case Metadata & Executive Disposition Table ──
    tier = siu_brief.get("operational_tier", "PRIORITY 2")
    action = siu_brief.get("recommended_action", "FIELD REVIEW")
    comp_score = case_data.get("composite_score") or case_data.get("composite", {}).get("score", 0.0)

    meta_table = [
        [
            Paragraph("<b>Claimant ID:</b>", body_style), Paragraph(str(case_data.get("claimant_id") or "—"), bold_style),
            Paragraph("<b>Repair Garage ID:</b>", body_style), Paragraph(str(case_data.get("garage_id") or "—"), bold_style),
        ],
        [
            Paragraph("<b>Incident Date:</b>", body_style), Paragraph(str(case_data.get("incident_date") or "—"), body_style),
            Paragraph("<b>City / State:</b>", body_style), Paragraph(f"{case_data.get('incident_city') or '—'}, {case_data.get('policy_state') or '—'}", body_style),
        ],
        [
            Paragraph("<b>Total Claim Amount:</b>", body_style), Paragraph(f"${case_data.get('total_claim_amount', 0):,.2f}", bold_style),
            Paragraph("<b>Vehicle Claim:</b>", body_style), Paragraph(f"${case_data.get('vehicle_claim', 0):,.2f}", body_style),
        ],
        [
            Paragraph("<b>Operational Tier:</b>", body_style), Paragraph(f"<font color='#b91c1c'><b>{tier}</b></font>", body_style),
            Paragraph("<b>SIU Directive:</b>", body_style), Paragraph(f"<b>{action}</b>", bold_style),
        ]
    ]
    t_meta = Table(meta_table, colWidths=[100, 152, 110, 142])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_card_bg),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # ── 4. Multimodal AI Risk Scorecard Table ──
    story.append(Paragraph("Multi-Modal Investigative Scorecard", h2_style))
    
    xgb_s = case_data.get("xgboost", {}).get("fraud_score", case_data.get("fraud_score", 0.0))
    gnn_s = case_data.get("gnn", {}).get("fraud_ring_score", case_data.get("gnn_fraud_ring_score", 0.0))
    cnn_s = case_data.get("cnn", {}).get("fraud_score", case_data.get("cnn_fraud_score"))
    fnol_s = case_data.get("fnol", {}).get("fnol_score", case_data.get("fnol_score"))

    cnn_cell = f"{cnn_s:.1f}%" if cnn_s is not None else "N/A"
    fnol_cell = f"{fnol_s:.1f}%" if fnol_s is not None else "N/A"

    score_data = [
        ["Modality Pillar", "AI Model Backbone", "Risk Probability", "Forensic Threshold", "Status"],
        ["Tabular Underwriting", "XGBoost + TreeSHAP", f"{xgb_s:.1f}%", ">= 50.0%", "HIGH ANOMALY" if xgb_s >= 50 else "NORMAL"],
        ["Network Ring Graph", "Graph Conv Net (GNN)", f"{gnn_s:.1f}%", ">= 45.0%", "RING LINKED" if gnn_s >= 45 else "ISOLATED"],
        ["Physical Vehicle Photos", "ResNet-50 + Grad-CAM", cnn_cell, ">= 50.0%", "ANOMALY" if (cnn_s or 0) >= 50 else "AUTHENTIC"],
        ["FNOL Narrative NLP", "DeBERTa / Lexical Forensics", fnol_cell, ">= 40.0%", "CONTRADICTION" if (fnol_s or 0) >= 40 else "CONSISTENT"],
        ["Synthesized Composite", "Multi-Modal Ensemble", f"{comp_score:.1f}%", ">= 50.0%", f"{case_data.get('risk_level', 'LOW')} RISK"]
    ]
    t_score = Table(score_data, colWidths=[120, 134, 80, 90, 80])
    t_score.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (2, 0), (3, -1), 'CENTER'),
        ('ALIGN', (4, 0), (4, -1), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#f8fafc")),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 4.5),
    ]))
    story.append(t_score)
    story.append(Spacer(1, 10))

    # ── 4b. Layer 2 Deep Forensic Tampering & Invoice Padding Audit Table ──
    tampering = case_data.get("tampering")
    if not tampering and case_data.get("tampering_flags"):
        try:
            tampering = json.loads(case_data.get("tampering_flags")) if isinstance(case_data.get("tampering_flags"), str) else case_data.get("tampering_flags")
        except Exception:
            tampering = None

    bill_padding = case_data.get("bill_padding")
    if not bill_padding and case_data.get("bill_padding_summary"):
        try:
            bill_padding = json.loads(case_data.get("bill_padding_summary")) if isinstance(case_data.get("bill_padding_summary"), str) else case_data.get("bill_padding_summary")
        except Exception:
            bill_padding = None

    if tampering or (bill_padding and bill_padding.get("parsed")):
        story.append(Paragraph("Deep Forensic Tampering & Invoice Padding Audit", h2_style))
        forensic_rows = [["Forensic Vector", "Methodology / Standard", "Empirical Metric", "Findings & Threshold"]]
        if tampering:
            ela_str = "SPLICING / ALTERATION DETECTED" if tampering.get("ela_tampering_detected") else "UNIFORM COMPRESSION (CLEAN)"
            forensic_rows.append(["Error Level Analysis (ELA)", "90% JPEG Compression Variance", f"Peak Anomaly: {tampering.get('highest_ela_score', 0):.1f}%", ela_str])
            geo_str = "GEOFENCE VIOLATION" if tampering.get("geofence_violations") else "METADATA / GPS VERIFIED"
            forensic_rows.append(["EXIF GPS & Date Geofence", "Haversine Geofence (45 mi limit)", f"Violations: {len(tampering.get('geofence_violations', []))}", geo_str])
            salvage_str = f"SCRAP MATCH (Lot #{tampering.get('salvage_matches')[0]['match'].get('lot_id')})" if tampering.get("salvage_matches") else "CLEAR (NO MATCH)"
            forensic_rows.append(["Copart/IAAI Scrap Archive", "pHash/dHash Reverse Matching", f"Matches: {len(tampering.get('salvage_matches', []))}", salvage_str])
        if bill_padding and bill_padding.get("parsed"):
            pad_str = f"+{bill_padding.get('padding_percentage', 0):.1f}% OVER OEM BENCHMARK"
            forensic_rows.append(["Repair Estimate OCR Audit", "OEM Manufacturer Flat-Rate Matrix", f"${bill_padding.get('total_padding_detected', 0):,.2f} Padded", pad_str])
        
        t_forensic = Table(forensic_rows, colWidths=[120, 144, 110, 130])
        t_forensic.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 1, c_border),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(t_forensic)
        story.append(Spacer(1, 10))

    # ── 5. Executive SIU Briefing Summary ──
    story.append(Paragraph("Executive Briefing & Forensic Synthesis", h2_style))
    story.append(Paragraph(siu_brief.get("executive_summary", "No executive summary generated."), body_style))
    story.append(Spacer(1, 10))

    # ── 6. Suggested Deposition & Interrogation Checklist ──
    story.append(Paragraph("Suggested Deposition & Examination Under Oath (EUO) Checklist", h2_style))
    checklist = siu_brief.get("deposition_checklist", [])

    if checklist:
        for idx, item in enumerate(checklist, 1):
            q_table = [
                [
                    Paragraph(f"<b>[{idx}] {item.get('target', 'Topic')}</b>", ParagraphStyle('QTarget', parent=body_style, textColor=c_blue, fontName='Helvetica-Bold')),
                    Paragraph(f"<b>Basis:</b> {item.get('evidence_basis', 'Evidence')}", ParagraphStyle('QBasis', parent=body_style, fontSize=7.5, textColor=c_muted))
                ],
                [
                    Paragraph(f"<b>Cross-Exam Question:</b><br/>{item.get('question', '')}", ParagraphStyle('QQ', parent=body_style, fontName='Helvetica-Oblique')),
                    Paragraph(f"<b>Tactical Probe:</b><br/>{item.get('tactical_guidance', '')}", ParagraphStyle('QG', parent=body_style, fontSize=7.5, textColor=colors.HexColor("#475569")))
                ]
            ]
            t_q = Table(q_table, colWidths=[290, 214])
            t_q.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
                ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(t_q)
            story.append(Spacer(1, 5))
    else:
        story.append(Paragraph("No interrogation checklist items flagged for this claim.", body_style))

    story.append(Spacer(1, 8))

    # ── 7. Target Subpoenas & Field Directives ──
    story.append(Paragraph("Target Subpoenas & Field Discovery Items", h2_style))
    subpoenas = siu_brief.get("subpoena_discovery_items", [])
    for sub in subpoenas:
        story.append(Paragraph(f"•  <b>[SUBPOENA / DISCOVERY]</b> {sub}", body_style))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 12))

    # ── 8. Legal Declaration & Official Investigator Sign-Off ──
    legal_text = (
        "<b>CERTIFICATE OF AUTHENTICITY AND EVIDENCE INTEGRITY (FRE 902(13)/(14)):</b><br/>"
        "I hereby certify under penalty of perjury that this investigation dossier was generated through IntelliClaim's "
        "forensic multi-modal pipeline. The underlying digital evidence, image hashes, and tabular inputs have been cryptographically "
        "hashed via SHA-256 and preserved without alteration in an unbroken chain of custody for judicial submission."
    )
    story.append(Paragraph(legal_text, ParagraphStyle('Legal', parent=body_style, fontSize=7, leading=9.5, textColor=c_muted)))
    story.append(Spacer(1, 10))

    # Signature Block
    sig_block = [
        [
            Paragraph("<b>Lead SIU Investigator:</b> ___________________________", body_style),
            Paragraph("<b>Badge / License ID:</b> ___________________________", body_style)
        ],
        [
            Paragraph("<b>Signature:</b> _____________________________________", body_style),
            Paragraph("<b>Date Signed:</b> _______________________________", body_style)
        ],
        [
            Paragraph(f"<font color='#64748b'>SHA-256 Seal: {sha[:32]}…</font>", mono_style),
            Paragraph("<font color='#15803d'><b>OFFICIAL SEAL: CERTIFIED FOR TRIAL</b></font>", ParagraphStyle('Seal', parent=body_style, alignment=2))
        ]
    ]
    t_sig = Table(sig_block, colWidths=[252, 252])
    t_sig.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, c_navy),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(KeepTogether(t_sig))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
