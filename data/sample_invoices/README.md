# Sample Repair Estimate Invoices for Testing

These files are used to test the **AutoShield AI Bill Padding Detector** (Layer 2 OCR forensics).

## Files Overview

| File | Type | Expected Score | Verdict |
|------|------|---------------|---------|
| `invoice_padded_heavy.txt` | Heavily padded estimate | ~75-85 | SEVERE_BILL_PADDING |
| `invoice_padded_moderate.txt` | Moderately padded estimate | ~35-55 | MODERATE_BILL_PADDING |
| `invoice_clean_legitimate.txt` | OEM-compliant estimate | ~0-20 | OEM_COMPLIANT |
| `invoice_phantom_parts.txt` | Phantom unrelated parts | ~80-95 | SEVERE_BILL_PADDING |
| `invoice_ring_g001.txt` | Ring A garage G-001 estimate | ~65-80 | SEVERE_BILL_PADDING |
| `invoice_ring_g002.txt` | Ring B garage G-002 estimate | ~55-70 | MODERATE/SEVERE |
| `invoice_total_loss_fraud.txt` | Total loss fraud attempt | ~85-95 | SEVERE_BILL_PADDING |
| `invoice_minor_clean.txt` | Minor damage (legitimate) | ~0-15 | OEM_COMPLIANT |

## How to Use

1. Upload any `.txt` file from this folder as the **Repair Invoice / Estimate** in the claim intake form.
2. Or click **"+ Sample Padded Invoice"** button to auto-load the heavy padding example.
3. Results appear in the **Forensics** tab of the results panel.

## Claim Scenarios to Pair With

- **Ring A (G-001)** -> `invoice_ring_g001.txt` -> Preset: "Ring A -- G-001"
- **Ring B (G-002)** -> `invoice_ring_g002.txt` -> Preset: "Ring B -- G-002"
- **Legitimate** -> `invoice_minor_clean.txt` -> Preset: "Legitimate Claim"
- **Phantom Parts** -> `invoice_phantom_parts.txt` -> Any fraud preset
