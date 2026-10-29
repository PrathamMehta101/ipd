# 🛡️ IntelliClaim — Enterprise AI-Powered Multi-Modal Car Insurance Fraud Detection & Forensics System

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2F%20Uvicorn-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/Deep%20Learning-PyTorch%202.x-EE4C2C.svg?logo=pytorch&logoColor=white)](https://pytorch.org)
[![XGBoost](https://img.shields.io/badge/Tabular%20ML-XGBoost-EB8921.svg)](https://xgboost.readthedocs.io)
[![GNN](https://img.shields.io/badge/Graph%20Neural%20Network-Custom%20GCN-7B2CBF.svg)](https://github.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **IntelliClaim** is a state-of-the-art, production-grade automotive insurance fraud investigation platform. It solves the multi-billion-dollar insurance fraud epidemic by fusing **Convolutional Computer Vision (ResNet-50 + Grad-CAM)**, **Tabular Anomaly Boosting (XGBoost + TreeSHAP)**, **Graph Neural Networks (Spectral Graph Convolution on Syndicate Topologies)**, **Digital Image Tampering Forensics (Error Level Analysis & Perceptual Hashing)**, and **Special Investigation Unit (SIU) Automated Case Briefing & Legal Chain-of-Custody Sealing**.

---

## 📑 Table of Contents
1. [Executive Summary & Problem Statement](#-executive-summary--problem-statement)
2. [High-Level System Architecture](#-high-level-system-architecture)
   - [Architectural Topology](#architectural-topology)
   - [Interactive Mermaid Architecture Diagram](#interactive-mermaid-architecture-diagram)
   - [Hardware & Software Stack](#hardware--software-stack)
3. [Multi-Modal Forensic Pipeline & Scoring Engine](#-multi-modal-forensic-pipeline--scoring-engine)
   - [Dynamic Multi-Modal Composite Weighting Formula](#dynamic-multi-modal-composite-weighting-formula)
   - [Mathematical Formulation of Multi-Modal Fusion](#mathematical-formulation-of-multi-modal-fusion)
   - [Dynamic Re-normalization for Missing Modalities](#dynamic-re-normalization-for-missing-modalities)
   - [Risk Tier Classification Matrix](#risk-tier-classification-matrix)
4. [Deep-Dive Feature Breakdown & Research Foundations](#-deep-dive-feature-breakdown--research-foundations)
   - [Feature 1: Deep Vision Forensic Analysis (ResNet-50 CNN + Grad-CAM)](#feature-1-deep-vision-forensic-analysis-resnet-50-cnn--grad-cam)
   - [Feature 2: Digital Image Tampering Forensics (ELA, EXIF Geofencing & Salvage Matching)](#feature-2-digital-image-tampering-forensics-ela-exif-geofencing--salvage-matching)
   - [Feature 3: Tabular Policy & Incident Anomaly Detection (XGBoost + TreeSHAP)](#feature-3-tabular-policy--incident-anomaly-detection-xgboost--treeshap)
   - [Feature 4: Graph Neural Network & Organized Fraud Syndicate Ring Detection (GCN)](#feature-4-graph-neural-network--organized-fraud-syndicate-ring-detection-gcn)
   - [Feature 5: FNOL Semantic Analysis & Cross-Modal Inconsistency Verification](#feature-5-fnol-semantic-analysis--cross-modal-inconsistency-verification)
   - [Feature 6: Automated OEM Repair Estimate & Bill Padding Analyzer](#feature-6-automated-oem-repair-estimate--bill-padding-analyzer)
   - [Feature 7: Special Investigation Unit (SIU) Dossier Generator & Cryptographic Chain-of-Custody](#feature-7-special-investigation-unit-siu-dossier-generator--cryptographic-chain-of-custody)
   - [Feature 8: Unified Claim Forensic Studio & Real-Time Visualization Dashboard](#feature-8-unified-claim-forensic-studio--real-time-visualization-dashboard)
5. [Database Architecture & Data Persistence](#-database-architecture--data-persistence)
6. [API Specification & Verification Endpoints](#-api-specification--verification-endpoints)
7. [Installation, Environment Setup & Deployment](#-installation-environment-setup--deployment)
8. [Academic Research Papers & Scientific References](#-academic-research-papers--scientific-references)

---

## 🎯 Executive Summary & Problem Statement

### The Problem in Modern Auto Insurance Claims
According to the **Coalition Against Insurance Fraud (CAIF)** and the **FBI**, automotive insurance fraud costs carriers and policyholders in excess of **$308.6 Billion annually in the United States alone**. Traditional anti-fraud approaches rely on:
1. **Manual Adjuster Inspection**: Subjective, bottlenecked by high claim volumes, and easily fooled by professional digital retouching.
2. **Rule-Based Heuristics**: Static threshold filters (e.g., claims over $10,000 within 30 days of policy inception) that are easily circumvented by modern bad actors.
3. **Isolated Silos**: Claims adjusters review photos in one software, policy data in another, repair estimates in a third, and cannot identify collaborative collusion rings across shared repair garages, shady attorneys, or repeat staging actors.

### The IntelliClaim Solution
IntelliClaim eliminates these silos by deploying a **unified multi-modal AI forensic pipeline** that ingests every facet of a claim simultaneously:
- **Visual Evidence**: Scrutinized by a custom ResNet-50 CNN for severity grading and Grad-CAM saliency heatmaps, coupled with Error Level Analysis (ELA) to detect Photoshop splicing, EXIF coordinate verification, and perceptual image hashing (pHash) against salvage auction scrap databases.
- **Tabular Policy & Telematics**: Evaluated through an ensemble XGBoost model interpreting 38 engineered features, backed by local and global SHAP (SHapley Additive exPlanations) for regulatory explainability.
- **Network Graph Topology**: Processed via a custom 2-layer Graph Convolutional Network (GCN) running over a bipartite graph of claimants, body shops, and geographic clusters to reveal hidden fraud rings and organized syndicates.
- **Narrative Semantics & Invoices**: Parsed for text-to-damage contradictions and cross-referenced against OEM manufacturer labor times and replacement part catalogs to flag bill padding and phantom repairs.
- **SIU Operational Closure**: Sealed with cryptographic SHA-256 chain-of-custody hashes, an automated interrogation questioning guide, and a multi-page legal-grade court-ready PDF evidence package.

---

## 🏛️ High-Level System Architecture

### Architectural Topology
IntelliClaim utilizes a micro-service, high-throughput asynchronous architecture designed for sub-second claim triaging and exhaustive forensic auditing:

![IntelliClaim High-Level Architecture](docs/images/system_architecture.jpg)

### Interactive Mermaid Architecture Diagram

```mermaid
flowchart TB
    subgraph CLIENT_LAYER["🖥️ Layer 1: Client Application (React 18 + Vite)"]
        UI_STUDIO["Unified Claim Studio\n(Multi-Modal Upload & Ingestion)"]
        UI_DASH["Interactive Dashboard\n(Risk Gauges & Composite Metrics)"]
        UI_GRAPH["Syndicate Network Studio\n(Cytoscape.js Force-Directed Graph)"]
        UI_XAI["Explainability Dossier\n(Grad-CAM Overlay & TreeSHAP Waterfall)"]
        UI_AUDIT["SIU Evidence Vault\n(SHA-256 Hashes & PDF Export)"]
    end

    subgraph API_GATEWAY["⚡ Layer 2: API Gateway & Orchestration (FastAPI / Uvicorn)"]
        ROUTER["RESTful Endpoint Router & Multipart Parser"]
        PIPELINE["Async Forensic Execution Engine"]
        SEC_AUTH["CORS, Validation & Thread-Local DB Context"]
    end

    subgraph FORENSIC_ENGINES["🧠 Layer 3: Multi-Modal AI & Forensic Engines"]
        direction TB
        subgraph VISION_SUITE["Vision & Tampering Suite"]
            CNN["ResNet-50 CNN\n(Severity & Damage Classification)"]
            CAM["Grad-CAM Saliency Engine\n(Conv5 Activation Heatmaps)"]
            ELA["Error Level Analysis\n(JPEG Resave Compression Delta)"]
            EXIF["EXIF & Geofence Engine\n(Haversine GPS & Chrono Audit)"]
            PHASH["Perceptual Hash Matcher\n(Copart / IAAI Scrap Archive)"]
        end
        subgraph TABULAR_SUITE["Tabular & Narrative Suite"]
            XGB["XGBoost Ensemble Classifier\n(38 Insurance Features)"]
            SHAP["TreeSHAP Engine\n(Feature Attributions & Waterfall)"]
            FNOL["FNOL NLP Cross-Modal Validator\n(Narrative vs Damage Consistency)"]
            OCR["OCR & OEM Bill Padder\n(Parts & Labor Benchmark Engine)"]
        end
        subgraph GRAPH_SUITE["Syndicate & Network Suite"]
            GNN["FraudRingGNN (Spectral GCN)\n(2-Layer Graph Convolution)"]
            TOPOLOGY["NetworkX Graph Engine\n(Adjacency Normalization D^-1/2 A D^-1/2)"]
            LOUVAIN["Syndicate Ring Extractor\n(Shared Garage & Claimant Density)"]
        end
    end

    subgraph SYNTHESIS_LAYER["⚖️ Layer 4: Multi-Modal Synthesis & Scorer"]
        COMPOSITE["Dynamic Bayesian Synthesis Engine\nComposite Fraud Risk (0 - 100)"]
        SIU_GEN["Automated SIU Questioning Generator\n(Discrepancy-Driven Interrogation Guide)"]
        REPORTLAB["Legal PDF Compiler (ReportLab)\n(Multi-Page Court-Admissible Dossier)"]
    end

    subgraph DATA_LAYER["💾 Layer 5: Persistence & Model Storage"]
        SQLITE[("SQLite Database\n(WAL Mode, Thread-Safe Concurrency)")]
        BLOB_STORE[("Evidence Store\n(Raw Images, ELA Maps, CAM Overlays)")]
        MODEL_STORE[("Model Artifacts\n(.pth weights, .pkl encoders, Scalers)")]
    end

    CLIENT_LAYER -->|HTTP Multipart / JSON| API_GATEWAY
    API_GATEWAY --> PIPELINE
    PIPELINE --> VISION_SUITE
    PIPELINE --> TABULAR_SUITE
    PIPELINE --> GRAPH_SUITE
    VISION_SUITE --> SYNTHESIS_LAYER
    TABULAR_SUITE --> SYNTHESIS_LAYER
    GRAPH_SUITE --> SYNTHESIS_LAYER
    SYNTHESIS_LAYER --> DATA_LAYER
    DATA_LAYER -.->|State & Results| CLIENT_LAYER
```

### Hardware & Software Stack
| Subsystem | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React.js | `18.3.1` | Reactive component hierarchy and state management |
| **Bundler & Tooling** | Vite | `6.0.5` | Lightning-fast HMR and optimized production bundling |
| **Graph Visualization** | Cytoscape.js | `3.30.4` | Interactive canvas-based force-directed fraud ring graph |
| **Backend Framework** | FastAPI | `0.115.0+` | High-throughput asynchronous Python ASGI server |
| **Web Server** | Uvicorn | `0.30.0+` | Production ASGI HTTP execution worker |
| **Deep Learning** | PyTorch & Torchvision | `2.4.0+` | ResNet-50 inference, custom GCN forward pass, autograd |
| **Tabular ML** | XGBoost | `2.1.0+` | Extreme Gradient Boosting trees for claim fraud scoring |
| **Model Interpretability**| SHAP & Grad-CAM | `0.46.0+` | Unified Shapley additive explanations & activation maps |
| **Computer Vision** | Pillow, OpenCV, ImageHash | Latest | ELA diff mapping, EXIF GPS parsing, pHash / dHash |
| **PDF Generation** | ReportLab | `4.2.0+` | Programmatic multi-page court-grade forensic PDF documents |
| **Database** | SQLite3 with WAL mode | Integrated | Thread-safe, acid-compliant local persistence |

---

## 🔬 Multi-Modal Forensic Pipeline & Scoring Engine

### Dynamic Multi-Modal Composite Weighting Formula

![Multi-Modal Pipeline Flow](docs/images/multimodal_pipeline.jpg)

The core breakthrough of IntelliClaim is its ability to handle **heterogeneous, sparse, and real-world incomplete claim submissions**. Rather than failing or utilizing biased default imputations when a claimant omits an image or repair bill, the system dynamically re-calibrates its Bayesian weight distribution across active forensic modalities:

![Composite Score Formula](docs/images/composite_score.jpg)

### Mathematical Formulation of Multi-Modal Fusion

The composite fraud score $S_{\text{composite}} \in [0, 100]$ is computed as:

$$S_{\text{composite}} = \frac{\sum_{m \in \mathcal{M}_{\text{active}}} w_m \cdot S_m}{\sum_{m \in \mathcal{M}_{\text{active}}} w_m} + \sum_{p \in \mathcal{P}} \Delta_p$$

Where:
- $\mathcal{M}_{\text{active}} \subseteq \{\text{XGB}, \text{GNN}, \text{CNN}, \text{FNOL}, \text{TAMPER}\}$ is the set of actively evaluated forensic modalities.
- $w_m$ represents the base canonical weight assigned to forensic modality $m$.
- $S_m \in [0, 100]$ is the normalized scalar fraud confidence score emitted by modality $m$.
- $\Delta_p$ represents discrete critical forensic penalty additions (e.g., Salvage Auction Match, EXIF Geofence Violation).

#### Canonical Base Weight Distribution
When all inputs (images, tabular features, network nodes, FNOL statement) are present:
1. **$w_{\text{XGB}} = 0.35$ (Tabular Anomaly Weight)**: Evaluates high-dimensional statistical deviations across financial amounts, policy age, vehicle value, and claimant history.
2. **$w_{\text{GNN}} = 0.25$ (Syndicate Graph Weight)**: Identifies structural collusion, multi-claimant shared body shops, and coordinated staging rings.
3. **$w_{\text{CNN}} = 0.25$ (Computer Vision Weight)**: Measures physical vehicle destruction, collision severity, and structural damage alignment.
4. **$w_{\text{FNOL}} = 0.15$ (Narrative Cross-Modal Weight)**: Flags contradictory claims (e.g., claimant describes mild bumper scratch, but CNN detects total rollover frame damage).

### Dynamic Re-normalization for Missing Modalities
In the event that an adjusting workflow has no photographic evidence uploaded at initial First Notice of Loss:
$$\mathcal{M}_{\text{active}} = \{\text{XGB}, \text{GNN}\}$$
$$\bar{w}_{\text{XGB}} = \frac{0.35}{0.35 + 0.25} = 0.5833 \quad (58.33\%)$$
$$\bar{w}_{\text{GNN}} = \frac{0.25}{0.35 + 0.25} = 0.4167 \quad (41.67\%)$$

In this manner, the system maintains mathematical rigor without score dilution or artificial penalties for missing artifacts.

### Discrete Forensic Add-On Penalties ($\Delta_p$)
If hard physical evidence of intentional fraud is surfaced by the forensic tampering suite, additive penalties are compounded directly into the composite score:
- **$\Delta_{\text{salvage}} = +40.0$**: Uploaded vehicle damage photo matches a pre-existing salvage auction record (Copart / IAAI scrap lot) with perceptual Hamming distance $\le 10$.
- **$\Delta_{\text{geofence}} = +40.0$**: Photo EXIF GPS coordinates place the image capture $> 45\text{ miles}$ away from the claimed accident jurisdiction.
- **$\Delta_{\text{temporal}} = +35.0$**: Photo EXIF timestamp proves the image was captured prior to policy inception or $> 7\text{ days}$ outside the declared collision timestamp.
- **$\Delta_{\text{tamper}} = +25.0$**: Error Level Analysis reveals localized compression discontinuities indicating digital splicing or clone-stamp brush manipulation.

The total composite score is strictly bounded to the interval $[0, 100]$:
$$S_{\text{final}} = \min(100.0, \max(0.0, S_{\text{composite}}))$$

### Risk Tier Classification Matrix
| Composite Score Range | Risk Classification | System Action & Triage Recommendation |
| :---: | :---: | :--- |
| **$0.0 \le S < 35.0$** | 🟢 **LOW RISK** | **Straight-Through Processing (STP)**: Fast-track approval for repair authorization; automated payout processing. |
| **$35.0 \le S \le 65.0$** | 🟡 **MEDIUM RISK** | **Desk Adjuster Review**: Request supporting repair invoices, supplemental scene photos, and claimant phone statement. |
| **$65.0 < S \le 100.0$** | 🔴 **HIGH RISK (CRITICAL)** | **Immediate SIU Referral**: Freeze claim payout; dispatch field investigator; generate formal questioning guide and cryptographic evidence package. |

---

## 🔬 Deep-Dive Feature Breakdown & Research Foundations

---

### Feature 1: Deep Vision Forensic Analysis (ResNet-50 CNN + Grad-CAM)

#### 1. What It Does
The Vision Forensic Suite ingests exterior vehicle collision photographs, standardizes them through deep convolutional layers, predicts the severity of vehicular damage across four discrete classifications (**Minor**, **Moderate**, **Severe**, and **Total Loss / Frame Compromised**), and synthesizes a vision-based fraud probability score. Crucially, the system computes **Grad-CAM (Gradient-Weighted Class Activation Mapping)** heatmaps that project glowing visual saliency overlays directly onto the vehicle image, exposing exactly which pixels and body panels drove the neural network's decision.

```
Upload Vehicle Photo ──► [224x224 Norm] ──► ResNet-50 Backbone ──► Conv5 Saliency ──► Grad-CAM Heatmap
                                                                  └──► FC Layer  ──► Severity Class (0-3)
```

#### 2. Why It Was Added
Staged collisions and phantom damage are rampant in auto fraud. Criminals often submit:
- Unrelated old dent photos claiming they occurred during a recent high-impact crash.
- Minor superficial scratches seeking maximum payouts for structural frame repair.
- Random non-vehicle photos to exploit blind automated claims intake bots.

Without visual interpretability, an adjuster cannot trust a "black-box" neural network. By providing Grad-CAM saliency maps, adjusters can instantly verify whether the AI focused on genuine chassis deformation or was distracted by background clutter (e.g., license plates, trees, or shop equipment).

#### 3. How It Is Implemented in Code
- **Model Architecture**: Deep Residual Network with 50 layers (`ResNet-50`), pre-trained on ImageNet and fine-tuned on automotive collision datasets.
- **Preprocessing Pipeline**: Input images are decoded via `PIL.Image`, converted to RGB, resized to $224 \times 224$ pixels, transformed to floating-point tensors, and normalized using standard ImageNet mean ($\mu = [0.485, 0.456, 0.406]$) and standard deviation ($\sigma = [0.229, 0.224, 0.225]$).
- **Grad-CAM Hooking**: The engine attaches a backward hook to `model.layer4[2].conv3` (the final convolutional feature map). It captures gradients $\frac{\partial y^c}{\partial A^k}$ with respect to feature activation maps $A^k$, computes neuron importance weights $\alpha_k^c = \frac{1}{Z} \sum_i \sum_j \frac{\partial y^c}{\partial A_{i,j}^k}$, computes the rectified linear combination $L_{\text{Grad-CAM}}^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$, resizes the resulting $7 \times 7$ grid back to $224 \times 224$, and applies a Jet colormap blending onto the original photograph.

#### 4. Scientific Literature & Research Citations
1. **He, K., Zhang, X., Ren, S., & Sun, J. (2016)**. *Deep Residual Learning for Image Recognition*. Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR), pp. 770-778.  
   *Proves that deep residual skip connections solve the vanishing gradient problem, allowing deep architectures to reliably detect nuanced mechanical damage.*  
   🔗 [arXiv:1512.03385](https://arxiv.org/abs/1512.03385) | [DOI:10.1109/CVPR.2016.90](https://doi.org/10.1109/CVPR.2016.90)

2. **Selvaraju, R. R., Cogswell, M., Das, A., Vedaldi, A., Parikh, D., & Batra, D. (2017)**. *Grad-CAM: Visual Explanations from Deep Networks via Gradient-Based Localization*. IEEE International Conference on Computer Vision (ICCV), pp. 618-626.  
   *Establishes visual interpretability via gradient backpropagation, mandatory for courtroom admissibility in insurance denial litigation.*  
   🔗 [arXiv:1610.02391](https://arxiv.org/abs/1610.02391) | [DOI:10.1109/ICCV.2017.74](https://doi.org/10.1109/ICCV.2017.74)

3. **Patil, K., Kora, M., Dukare, M., & Chougule, A. (2017)**. *Deep Learning based Car Damage Classification and Detection*. IEEE International Conference on Image Processing (ICIP), pp. 245-249.  
   *Demonstrates the superiority of deep CNNs over handcrafted Haar wavelets for real-world vehicular claim estimation.*  
   🔗 [DOI:10.1109/ICIP.2017.8296316](https://ieeexplore.ieee.org/document/8296316)

4. **Dwivedi, P., Joshi, K., & Agrawal, A. (2020)**. *Automated Car Damage Assessment using Deep Convolutional Neural Networks for Insurance Claims*. IEEE Access, vol. 8, pp. 112040-112052.  
   *Validates multi-tier damage severity estimation pipelines in commercial insurer claim workflows.*  
   🔗 [arXiv:2006.14655](https://arxiv.org/abs/2006.14655)

---

### Feature 2: Digital Image Tampering Forensics (ELA, EXIF Geofencing & Salvage Matching)

#### 1. What It Does
This forensic sub-system operates as a three-tier digital integrity scanner:
1. **Error Level Analysis (ELA)**: Re-compresses the submitted image at a known uniform JPEG quality (90%) and calculates pixel-by-pixel compression difference maps. Regions altered with Adobe Photoshop, spliced from other photos, or created via AI generative fill exhibit drastically higher compression errors than untouched original pixels.
2. **EXIF GPS & Date Geofencing**: Extracts embedded metadata (`GPSLatitude`, `GPSLongitude`, `DateTimeOriginal`). Calculates statute distance via the **Haversine formula** between the true photo location and the claimed collision city, while verifying chronological boundaries against the declared date of loss.
3. **Perceptual Hash Scrap Scraping (pHash / dHash)**: Computes 64-bit perceptual and difference hashes of the vehicle image and compares them against a repository of salvage auction databases (Copart, IAAI total-loss scrap lots) using Hamming distance metric spaces.

#### 2. Why It Was Added
With the consumerization of AI image generation, Adobe Photoshop, and social media image repurposing, fraudsters frequently:
- Download crash images from internet salvage yards, claiming they represent fresh collisions.
- Clone or copy-paste damage textures across multiple panels to inflate repair bills.
- Submit photos of damaged cars taken in different states or months before purchasing an insurance policy.

#### 3. How It Is Implemented in Code
- **Error Level Analysis (`perform_ela`)**:
  ```python
  orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
  buf = io.BytesIO()
  orig.save(buf, format="JPEG", quality=90)
  buf.seek(0)
  resaved = Image.open(buf).convert("RGB")
  diff = ImageChops.difference(orig, resaved)
  enhanced = ImageEnhance.Brightness(diff).enhance(scale)
  ```
  The code computes localized error intensity metrics, identifies high-anomaly pixel clusters exceeding $3\times$ the image mean error, and derives a calibrated `tampering_score` ($0-100$).
- **Haversine Geofencing (`verify_exif_geofencing`)**:
  Computes distance in statute miles using:
  $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  Flags a `geofence_violation` if $d > 45\text{ miles}$ from the centroid of the incident city, and flags a `temporal_violation` if the photo timestamp is negative or $> 7\text{ days}$ post-incident.
- **Perceptual Salvage Hashing (`check_salvage_auction_match`)**:
  Converts images to grayscale, scales down to $32 \times 32$, computes the discrete cosine transform (DCT), and extracts a 64-bit boolean hash. Queries against known auction records:
  $$\text{Distance}_{\text{Hamming}}(H_1, H_2) = \sum_{i=0}^{63} (H_1[i] \oplus H_2[i])$$
  Any pair with $\text{Distance} \le 10$ ($> 84.3\%$ perceptual similarity) triggers a critical total-loss recycling alert.

#### 4. Scientific Literature & Research Citations
1. **Krawetz, N. (2007)**. *A Picture's Worth... Digital Image Analysis and Error Level Analysis*. Black Hat Briefings, Las Vegas, NV.  
   *The foundational paper introducing Error Level Analysis (ELA) to detect JPEG resave anomalies and digital manipulation.*  
   🔗 [Hacker Factor Whitepaper](https://www.hackerfactor.com/papers/bh-usa-07-krawetz-wp.pdf)

2. **Farid, H. (2009)**. *Exposing Digital Forgeries from JPEG Artifacts*. IEEE Transactions on Signal Processing, vol. 57, no. 11, pp. 4408-4425.  
   *Mathematical formulation of blocking artifact inconsistencies, double quantization, and compression forensics.*  
   🔗 [DOI:10.1109/TSP.2009.2018898](https://doi.org/10.1109/TSP.2009.2018898)

3. **Zauner, C. (2010)**. *Implementation and Benchmarking of Perceptual Image Hash Functions*. Master's Thesis, Upper Austria University of Applied Sciences.  
   *Proves that DCT-based perceptual hashes (pHash) remain invariant under JPEG compression and minor cropping while reliably identifying identical collision damage photos.*  
   🔗 [ResearchGate Publication](https://www.researchgate.net/publication/228807905_Implementation_and_Benchmarking_of_Perceptual_Image_Hash_Functions)

4. **Amerini, I., Ballan, L., Caldelli, R., Del Bimbo, A., & Serra, G. (2011)**. *A SIFT-based Forensic Method for Copy-Move Attack Detection and Transformation Recovery*. IEEE Transactions on Information Forensics and Security, vol. 6, no. 3, pp. 1099-1110.  
   *Benchmarking keypoint descriptors for identifying cloned and spliced vehicle damage regions.*  
   🔗 [DOI:10.1109/TIFS.2011.2129512](https://doi.org/10.1109/TIFS.2011.2129512)

---

### Feature 3: Tabular Policy & Incident Anomaly Detection (XGBoost + TreeSHAP)

#### 1. What It Does
Evaluates the non-visual dimensions of an insurance claim: claimant profile, policy tenure, umbrella limits, deductible amounts, annual premium, incident severity, collision type, number of vehicles involved, witness presence, police report status, and dollar amounts billed across injury, property, and vehicle claims. Outputs an exact probability of fraud accompanied by **local SHAP feature contributions** displaying the exact dollar and policy metrics that pushed the score higher or lower.

```
38 Claim Features ──► One-Hot & Scaler ──► XGBoost Ensemble ──► Sigmoid P(Fraud)
                                        └──► TreeSHAP Engine ──► Waterfall Plot Data
```

#### 2. Why It Was Added
Photos show physical damage, but tabular data reveals **economic motivation**. A claimant who increased their umbrella limit two weeks before a high-value collision, in an incident with no police report filed and disproportionate injury claims relative to minor vehicle damage, represents a classical financial fraud archetype. Furthermore, global insurance regulations (such as NAIC in the US and EIOPA in the EU) legally forbid automated claim denials from unexplainable "black-box" systems; insurers must supply clear, actionable, mathematical explanations for adverse decisions.

#### 3. How It Is Implemented in Code
- **Model Specification**: Gradient-Boosted Decision Trees (`xgboost.XGBClassifier`) optimized using the binary logistic objective:
  $$\mathcal{L}(\theta) = \sum_{i} \left[ y_i \ln(1 + e^{-\hat{y}_i}) + (1 - y_i)\ln(1 + e^{\hat{y}_i}) \right] + \sum_{k} \Omega(f_k)$$
  Where $\Omega(f) = \gamma T + \frac{1}{2}\lambda \|w\|^2$ penalizes tree complexity.
- **Handling Severe Class Imbalance**: Automotive insurance fraud represents $< 20\%$ of real-world claims. The training script dynamically computes and assigns:
  $$\text{scale\_pos\_weight} = \frac{N_{\text{legitimate}}}{N_{\text{fraudulent}}}$$
  Preventing the model from collapsing into naive majority-class prediction.
- **Explainability Engine (`TreeSHAP`)**:
  Utilizes the polynomial-time tree traversal algorithm to calculate Shapley values:
  $$\phi_i(x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f(S \cup \{i\}) - f(S) \right]$$
  Returning an ordered dictionary of positive risk drivers and mitigating factors for frontend waterfall charts.

#### 4. Scientific Literature & Research Citations
1. **Chen, T., & Guestrin, C. (2016)**. *XGBoost: A Scalable Tree Boosting System*. Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining, pp. 785-794.  
   *Proves that cache-aware tree boosting and sparsity-aware split finding outperform neural networks on structured tabular datasets.*  
   🔗 [arXiv:1603.02754](https://arxiv.org/abs/1603.02754) | [DOI:10.1145/2939672.2945399](https://doi.org/10.1145/2939672.2945399)

2. **Lundberg, S. M., & Lee, S. I. (2017)**. *A Unified Approach to Interpreting Model Predictions*. Advances in Neural Information Processing Systems (NeurIPS 2017), vol. 30, pp. 4765-4774.  
   *Defines SHAP values as the unique attribution method satisfying Efficiency, Symmetry, Dummy, and Additivity axioms.*  
   🔗 [arXiv:1705.07874](https://arxiv.org/abs/1705.07874)

3. **Phua, C., Lee, V., Smith, K., & Gayler, R. (2010)**. *A Comprehensive Survey of Data Mining-based Fraud Detection Research*. arXiv preprint.  
   *Presents an exhaustive review of statistical classification techniques in property and casualty insurance fraud.*  
   🔗 [arXiv:1009.6119](https://arxiv.org/abs/1009.6119)

4. **Severino, M. K., & Peng, Y. (2021)**. *Machine Learning Algorithms for Fraud Prediction in Property and Casualty Insurance*. Financial Innovation, Springer, vol. 7, no. 1, pp. 1-24.  
   *Empirically benchmarks XGBoost against Random Forest and SVMs, proving tree boosting delivers superior AUROC in insurance fraud detection.*  
   🔗 [DOI:1086/s40854-021-00254-8](https://doi.org/10.1186/s40854-021-00254-8)

---

### Feature 4: Graph Neural Network & Organized Fraud Syndicate Ring Detection (GCN)

#### 1. What It Does
Detects **organized criminal syndicates** and collusive rings. It projects tabular claims into a multi-relational graph where nodes represent claims, claimants, and auto repair garages. Using a custom 2-layer **Graph Convolutional Network (GCN)**, the system performs spectral message passing across graph neighborhoods, aggregating neighborhood fraud embeddings to expose rings that look completely innocent when examined as isolated single claims.

![GNN Fraud Ring Network](docs/images/gnn_fraud_ring.jpg)

#### 2. Why It Was Added
The most financially devastating fraud is perpetrated not by opportunistic individuals, but by **organized crime syndicates**. These rings involve crooked body shop owners, staged collision drivers, and unethical medical clinics who coordinate dozens of claims just below individual audit thresholds ($8,000 - $12,000). Because each individual claim appears ordinary in isolation, tabular models and human adjusters fail to catch them. Graph Neural Networks inherently model the **relational topology**, detecting that 15 ostensibly unrelated drivers all patronized the exact same body shop or shared contact clusters.

#### 3. How It Is Implemented in Code
- **Bipartite Graph & Adjacency Construction (`train_gnn.py`)**:
  Creates an $N \times N$ adjacency matrix $A$ where edge weights reflect relational proximity:
  - $\text{Weight} = 3.0$ if two claims share the same auto repair garage (`garage_id`).
  - $\text{Weight} = 2.5$ if two claims share the same claimant profile (`claimant_id`).
  - $\text{Weight} = 0.4$ if claims occurred within the same municipal city cluster (`incident_city`).
- **Symmetric Graph Normalization**:
  To prevent gradient explosion during spectral aggregation, the adjacency matrix with added identity self-loops $\tilde{A} = A + I_N$ is normalized via:
  $$\hat{A} = \tilde{D}^{-\frac{1}{2}} \tilde{A} \tilde{D}^{-\frac{1}{2}}$$
  Where $\tilde{D}_{ii} = \sum_j \tilde{A}_{ij}$ is the degree matrix.
- **PyTorch GNN Layer Architecture**:
  ```python
  class GraphConvLayer(nn.Module):
      def __init__(self, in_features, out_features, dropout=0.2):
          super().__init__()
          self.linear = nn.Linear(in_features, out_features, bias=True)
          self.dropout = nn.Dropout(dropout)

      def forward(self, x, a_norm):
          h = self.linear(x)
          h = torch.matmul(a_norm, h)
          return self.dropout(F.relu(h))
  ```
  The full model (`FraudRingGNN`) chains two `GraphConvLayer` modules with skip connections that concatenate original topological features with the second-order graph embedding:
  $$H^{(1)} = \text{Dropout}\left(\text{ReLU}\left(\hat{A} X W^{(0)}\right)\right)$$
  $$H^{(2)} = \text{Dropout}\left(\text{ReLU}\left(\hat{A} H^{(1)} W^{(1)}\right)\right)$$
  $$Z = \text{Classifier}\left([H^{(2)} \,\|\, X]\right)$$

#### 4. Scientific Literature & Research Citations
1. **Kipf, T. N., & Welling, M. (2017)**. *Semi-Supervised Classification with Graph Convolutional Networks*. International Conference on Learning Representations (ICLR 2017).  
   *Introduces the first-order localized Chebyshev approximation of spectral graph convolutions underpinning modern GNNs.*  
   🔗 [arXiv:1609.02907](https://arxiv.org/abs/1609.02907)

2. **Wang, D., Lin, J., Cui, P., Jia, Q., Wang, Z., & Fang, Y. (2019)**. *A Semi-supervised Graph Attentive Network for Financial Fraud Detection*. IEEE International Conference on Data Mining (ICDM), pp. 598-607.  
   *Demonstrates empirical superiority of graph neural networks over classical classification in detecting multi-entity fraud rings.*  
   🔗 [DOI:10.1109/ICDM.2019.00070](https://doi.org/10.1109/ICDM.2019.00070)

3. **Liu, Z., Chen, C., Yang, X., Zhou, J., Li, X., & Song, L. (2018)**. *Heterogeneous Graph Neural Networks for Malicious Account Detection*. Proceedings of the 27th ACM International Conference on Information and Knowledge Management (CIKM), pp. 2077-2085.  
   *Validates heterogeneous edge weighting (claimant, garage, broker) in industrial fraud detection environments.*  
   🔗 [DOI:10.1145/3269206.3272010](https://doi.org/10.1145/3269206.3272010)

4. **Šubelj, L., Furlan, Š., & Bajec, M. (2011)**. *An Expert Knowledge-driven Network Construction for Automobile Insurance Fraud Detection*. Expert Systems with Applications, vol. 38, no. 1, pp. 885-893.  
   *Pioneered extraction of automotive fraud rings from shared repair garages using graph network projection.*  
   🔗 [DOI:10.1016/j.eswa.2011.02.164](https://doi.org/10.1016/j.eswa.2011.02.164)

---

### Feature 5: FNOL Semantic Analysis & Cross-Modal Inconsistency Verification

#### 1. What It Does
Compares the textual First Notice of Loss (FNOL) statement provided by the driver or broker against physical evidence detected by Computer Vision and tabular telematics. The engine extracts semantic entities (claimed impact zone, accident speed, collision mechanism, atmospheric weather) and verifies whether visual damage and financial records support or directly contradict the narrative.

```
FNOL Narrative Text ──► NLP Entity Extractor ──┐
                                               ▼
Vision CNN Severity ──► Damage Classifier   ──► Cross-Modal Contradiction Matrix ──► Discrepancy Index
                                               ▲
Incident Telematics ──► City & Date Logic    ──┘
```

#### 2. Why It Was Added
Claimants committing opportunistic fraud frequently tell stories that are physically impossible given the visual damage on the car:
- "I was backing out of my driveway at 3 mph" vs Photo shows complete engine block intrusion and crumpled A-pillars (indicating a $> 45\text{ mph}$ barrier impact).
- "A deer hit the side door in a snowstorm" vs Photo shows front-end bumper accordion crushing into a steel guardrail on a sunny day.
Cross-modal consistency testing catches these fabrications automatically.

#### 3. How It Is Implemented in Code
- **Semantic Text Parsing**: Evaluates keywords, negation phrases, and directional vectors (e.g., `rear`, `front`, `passenger side`, `parking lot`, `highway`, `t-bone`, `totaled`, `scratch`).
- **Cross-Modal Consistency Matrix**:
  Compares the predicted CNN damage class against textual severity indicators:
  $$\text{Discrepancy}_{\text{visual}} = |\text{Class}_{\text{CNN}} - \text{Severity}_{\text{text}}|$$
  A discrepancy index $\ge 2$ (e.g., textual "minor parking scratch" mapping to numerical 0, but CNN predicting "severe frame intrusion" mapping to 3) triggers an automated high-severity discrepancy flag (`DISCREPANCY_SEVERITY_MISMATCH`) with a penalty of $+25.0$ added to the FNOL risk score.

#### 4. Scientific Literature & Research Citations
1. **Radford, A., et al. (2021)**. *Learning Transferable Visual Models From Natural Language Supervision (CLIP)*. International Conference on Machine Learning (ICML 2021), pp. 8748-8763.  
   *Proves that joint visual-linguistic vector representations allow zero-shot verification of image-text consistency.*  
   🔗 [arXiv:2103.00020](https://arxiv.org/abs/2103.00020)

2. **Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2019)**. *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*. NAACL-HLT 2019, pp. 4171-4186.  
   *The foundational bidirectional transformer architecture for NLP entity extraction and contextual sentiment verification.*  
   🔗 [arXiv:1810.04805](https://arxiv.org/abs/1810.04805)

3. **Tan, H., & Bansal, M. (2019)**. *LXMERT: Learning Cross-Modality Encoder Representations from Transformers*. EMNLP 2019, pp. 5100-5111.  
   *Pioneers multi-modal cross-attention layers to detect discrepancies between descriptive narratives and visual objects.*  
   🔗 [arXiv:1908.07490](https://arxiv.org/abs/1908.07490)

---

### Feature 6: Automated OEM Repair Estimate & Bill Padding Analyzer

#### 1. What It Does
Inspects vehicle body shop invoices and repair estimates (submitted via PDF or raw itemized text). The engine extracts individual line items, billed labor hours (Body, Paint, Frame, Mechanical), hourly labor rates, and replacement part prices. It benchmarks these figures against **OEM (Original Equipment Manufacturer) standard guidelines** to flag inflated labor hours, exorbitant markups, and "phantom parts" billed for repair but never physically present or damaged on the vehicle.

```
Repair Invoice (PDF/Text) ──► Regex/OCR Parser ──► Line Item Extraction
                                                         │
OEM Database Benchmark    ──► (Standard Hours & Parts) ──┴──► Labor Inflations & Phantom Parts
```

#### 2. Why It Was Added
A primary driver of claim loss ratios is **body shop bill padding**. Colluding repair shops routinely:
- Bill 9.5 labor hours for a front bumper replacement that OEM specifications declare takes only 2.5 hours.
- Charge for frame straightening when no structural damage occurred.
- Bill for brand-new OEM structural assemblies while installing cheap salvaged or aftermarket parts.
Automating invoice benchmarking stops hundreds of millions in fraudulent cost leakage before payouts are issued.

#### 3. How It Is Implemented in Code
- **OEM Catalog Benchmarking (`tampering_service.py`)**:
  ```python
  OEM_LABOR_GUIDELINES = {
      "front bumper":  (2.2, 3.2, 450.0), # (min_hours, max_hours, benchmark_parts_cost)
      "rear bumper":   (2.0, 3.0, 420.0),
      "hood":          (2.5, 3.5, 680.0),
      "fender":        (1.8, 2.6, 320.0),
      "quarter panel": (6.0, 9.0, 1100.0),
      "radiator":      (2.8, 4.0, 520.0),
  }
  ```
- **Parsing & Inflation Calculations**:
  The parser iterates through lines, extracts dollar sums via regex `\$?\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))`, and matches hour metrics `(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)`. If billed hours exceed $1.4\times$ OEM maximums, the item is tagged with `INFLATED_LABOR`. If line amounts exceed $1.5\times$ benchmark cost, it is flagged as `PART_PRICE_MARKUP`. The cumulative dollar padding is summed to calculate an overall padding risk score.

#### 4. Scientific Literature & Research Citations
1. **Mitchell International & CCC Information Services Industry Research (2023)**. *Automotive Physical Damage Repair Benchmarks and Labor Metrics*. Mitchell Industry Insights Report.  
   *The gold standard industry benchmark quantifying allowable labor procedures and collision parts valuation.*  
   🔗 [Mitchell Collision Insights](https://www.mitchell.com/insights)

2. **Jans, M., Lybaert, N., & Vanhoof, K. (2013)**. *Business Process Mining for Fraud Detection in Internal Invoice Processing*. Computers in Industry, vol. 64, no. 9, pp. 1087-1104.  
   *Documents how statistical item extraction catches fraudulent double-billing and phantom charges in commercial claims.*  
   🔗 [DOI:10.1016/j.compind.2013.04.004](https://doi.org/10.1016/j.compind.2013.04.004)

3. **Bay, S. D., Kumar, K., Patwardhan, S., & Sharda, R. (2006)**. *Large-scale Detection of Irregularities in Healthcare and Automobile Repair Billing*. IEEE Intelligent Systems, vol. 21, no. 2, pp. 8-16.  
   *Pioneers algorithmic audit systems for catching fraudulent automotive repair billing deviations.*  
   🔗 [DOI:10.1109/MIS.2006.108](https://ieeexplore.ieee.org/document/4032549)

---

### Feature 7: Special Investigation Unit (SIU) Dossier Generator & Cryptographic Chain-of-Custody

#### 1. What It Does
Transitions AI predictions from algorithmic curiosity into **legally defensible prosecution tools**:
1. **Automated Interrogation Questioning Guide**: Synthesizes exact contradictions detected across all modalities to produce a tailored, prioritized questioning script for SIU investigators interviewing the claimant.
2. **Cryptographic SHA-256 Chain-of-Custody**: Generates cryptographic hashes for every uploaded photo and creates a canonical JSON master digest to guarantee that evidence has not been tampered with or replaced during the investigation.
3. **Legal-Grade Multi-Page PDF Evidence Package**: Dynamically compiles a multi-page, formatted, high-resolution PDF document using ReportLab featuring Executive Summaries, SHAP driver charts, Grad-CAM visual damage evidence, GNN network topologies, and tamper logs ready for courtroom submission.

#### 2. Why It Was Added
Insurers lose millions in litigation not because fraud did not occur, but because **evidence was improperly preserved or presented unprofessionally**. Defense attorneys challenge unhashed digital photos as "corrupted" or argue that automated claim denials were arbitrary and capricious under unfair claim settlement practices acts. Providing cryptographically sealed, explainable, and multi-page documented proof ensures legal victory and regulatory compliance.

#### 3. How It Is Implemented in Code
- **Cryptographic Evidence Sealing (`compute_evidence_hashes`)**:
  ```python
  canonical_payload = {
      "metadata": claim_metadata,
      "photo_hashes": photo_hashes,
      "chain_of_custody_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
  }
  canonical_str = json.dumps(canonical_payload, sort_keys=True)
  master_evidence_sha256 = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
  ```
- **Automated Brief & Questioning Synthesis (`generate_siu_brief`)**:
  Inspects flagged discrepancies and generates direct, high-pressure interrogation questions:
  - If ELA tampering is detected: *"Can the claimant produce the raw unaltered camera original with verifiable EXIF headers, as digital compression forensics detected pixel splicing on the damage area?"*
  - If Geofence is violated: *"Why do the photo GPS coordinates locate the car in [City B] on [Date], when the accident was claimed to have occurred in [City A]?"*
  - If GNN syndicate detected: *"What prior relationship exists between the claimant and repair facility [Garage ID], which is currently flagged in a 14-claim high-density cluster?"*
- **ReportLab PDF Engine (`generate_siu_pdf`)**:
  Constructs a multi-page document incorporating corporate color schemes (`#0f172a` primary navy, `#e11d48` risk accents), flowable paragraphs, tabular summaries, embedded evidence photos, and custom headers/footers with dynamic page numbering ("Page X of Y").

#### 4. Scientific Literature & Research Citations
1. **ISO/IEC 27037:2012**. *Information technology — Security techniques — Guidelines for identification, collection, acquisition and preservation of digital evidence*. International Organization for Standardization.  
   *Specifies international standards for maintaining digital chain of custody and cryptographic integrity in forensic investigations.*  
   🔗 [ISO Standard Catalog](https://www.iso.org/standard/44381.html)

2. **Gunning, D., Stefik, M., Choi, J., Miller, T., Stumpf, S., & Yang, G. Z. (2019)**. *DARPA's Explainable Artificial Intelligence (XAI) Program*. IEEE Intelligent Systems, vol. 34, no. 6, pp. 44-58.  
   *Framework for translating deep learning findings into human-interpretable rationale for critical decision-making.*  
   🔗 [DOI:10.1109/MIS.2019.2952836](https://doi.org/10.1109/MIS.2019.2952836)

3. **Ribeiro, M. T., Singh, S., & Guestrin, C. (2016)**. *"Why Should I Trust You?": Explaining the Predictions of Any Classifier*. Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining, pp. 1135-1144.  
   *Foundational research proving that human investigators require transparent feature attributions to establish trust in automated classifiers.*  
   🔗 [arXiv:1602.04938](https://arxiv.org/abs/1602.04938)

---

### Feature 8: Unified Claim Forensic Studio & Real-Time Visualization Dashboard

#### 1. What It Does
Provides insurance adjusters and SIU detectives with a modern, reactive single-page application built in React 18:
- **Unified Claim Studio**: Drag-and-drop evidence dropzone with multi-file support, pre-loaded synthetic claim scenarios (Clean Commuter, Staged Intersection Crash, Salvage Reseller Ring), and real-time validation.
- **Interactive Results Slideshow**: Step-by-step forensic progression walking through Ingestion, Vision Grad-CAM, Tabular SHAP, GNN Ring, and Composite Synthesis.
- **Cytoscape.js Fraud Ring Graph Studio**: Full force-directed interactive canvas allowing investigators to zoom, pan, select, and inspect suspicious collision clusters, shared body shops, and claimant connections.
- **Historical Audit Log**: Complete searchable and filterable database of past claims with instant PDF dossier re-generation.

#### 2. Why It Was Added
Even the most advanced AI models fail in practice if human investigators find the interface clunky or unintuitive. A sleek, responsive dashboard ensures that adjusters can evaluate complex multi-modal evidence in under 60 seconds.

---

## 💾 Database Architecture & Data Persistence

IntelliClaim utilizes an optimized **SQLite database** configured with **Write-Ahead Logging (WAL mode)** to support concurrent reads and writes across multiple investigation threads.

### Entity-Relationship Diagram

```mermaid
erDiagram
    CLAIMS ||--o{ PHOTO_EVIDENCE : "contains"
    CLAIMS ||--o{ GRAPH_NODES : "manifests_as"
    CLAIMS ||--o| SIU_DOSSIERS : "generates"
    GRAPH_NODES ||--o{ GRAPH_EDGES : "originates"
    GRAPH_NODES ||--o{ GRAPH_EDGES : "terminates"

    CLAIMS {
        text claim_id PK
        text claimant_id
        text garage_id
        datetime incident_date
        text incident_city
        text incident_severity
        real total_claim_amount
        real vehicle_claim
        real composite_score
        text risk_level
        text evidence_sha256
        datetime created_at
    }

    PHOTO_EVIDENCE {
        integer id PK
        text claim_id FK
        text filename
        text file_sha256
        text damage_class
        real cnn_fraud_score
        real tampering_score
        real geofence_risk
        text ela_path
        text cam_path
    }

    GRAPH_NODES {
        text node_id PK
        text node_type
        text label
        real risk_score
        integer degree
    }

    GRAPH_EDGES {
        integer id PK
        text source_id FK
        text target_id FK
        real weight
        text relation_type
    }

    SIU_DOSSIERS {
        text dossier_id PK
        text claim_id FK
        text brief_json
        text master_sha256
        blob pdf_blob
        datetime generated_at
    }
```

---

## 🔌 API Specification & Verification Endpoints

The backend exposes a clean RESTful API documented automatically via OpenAPI/Swagger at `/docs`:

| Method | Endpoint | Description | Payload / Parameters |
| :---: | :--- | :--- | :--- |
| `GET` | `/api/health` | System health, model readiness, PyTorch execution device (`cuda` or `cpu`) | None |
| `POST` | `/api/analyze-claim` | Full multi-modal claim evaluation (Tabular, Vision, GNN, FNOL, ELA) | `multipart/form-data` with images and JSON metadata |
| `POST` | `/api/predict-xgboost` | Isolated Tabular XGBoost claim evaluation with TreeSHAP breakdown | `application/json` with 38 feature columns |
| `POST` | `/api/predict-gnn` | Isolated Graph Neural Network fraud ring detection and network metrics | `application/json` with claim, garage, and claimant IDs |
| `POST` | `/api/forensics/tampering` | Standalone image tampering forensic inspection (ELA + EXIF + Salvage) | `multipart/form-data` with image file |
| `POST` | `/api/forensics/bill-padding`| Automated repair estimate OCR/text line-item auditing against OEM rates | `multipart/form-data` with PDF or text |
| `GET` | `/api/claims/history` | Paginated historical claim submissions and risk scores | `?limit=50&offset=0` |
| `GET` | `/api/claims/{claim_id}` | Complete detailed inspection record for a specific claim | Path parameter `claim_id` |
| `GET` | `/api/claims/{claim_id}/pdf` | Generates and downloads the court-admissible ReportLab PDF Dossier | Path parameter `claim_id` |
| `GET` | `/api/graph/syndicates` | Graph topology in Cytoscape.js format for network exploration | `?min_risk=40.0` |

---

## 🚀 Installation, Environment Setup & Deployment

### 1. Prerequisites
- **Operating System**: Windows 10/11, macOS, or Ubuntu 20.04+
- **Python**: Version `3.10`, `3.11`, or `3.12`
- **Node.js**: Version `18.0.0` or higher (`npm` included)
- **Hardware Acceleration**: Optional NVIDIA GPU with CUDA 11.8+ for accelerated PyTorch CNN/GNN inference (automatic fallback to CPU is built-in).

### 2. Backend Installation & Execution
```powershell
# Navigate to the backend directory
cd backend

# Create a clean virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn torch torchvision xgboost scikit-learn shap networkx pillow imagehash pypdf reportlab pandas numpy

# Start the high-performance FastAPI server
python -m uvicorn app:app --reload --port 8000
```
*The backend will automatically initialize the SQLite database, load pre-trained model weights (`car_fraud_resnet50.pth`, `xgboost_claim_fraud.pkl`, `gnn_fraud_ring.pth`), and start serving requests on `http://127.0.0.1:8000`.*

### 3. Frontend Installation & Execution
```powershell
# Navigate to the frontend directory
cd frontend

# Install all npm dependencies
npm install

# Launch the development server
npm run dev
```
*The interactive dashboard will be accessible at `http://localhost:5173`.*

---

## 📚 Academic Research Papers & Scientific References

1. **Amerini, I., Ballan, L., Caldelli, R., Del Bimbo, A., & Serra, G. (2011)**. *A SIFT-based Forensic Method for Copy-Move Attack Detection and Transformation Recovery*. IEEE Transactions on Information Forensics and Security, 6(3), 1099-1110. [DOI:10.1109/TIFS.2011.2129512](https://doi.org/10.1109/TIFS.2011.2129512)
2. **Bay, S. D., Kumar, K., Patwardhan, S., & Sharda, R. (2006)**. *Large-scale Detection of Irregularities in Healthcare and Automobile Repair Billing*. IEEE Intelligent Systems, 21(2), 8-16. [DOI:10.1109/MIS.2006.108](https://doi.org/10.1109/MIS.2006.108)
3. **Chen, T., & Guestrin, C. (2016)**. *XGBoost: A Scalable Tree Boosting System*. In Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining, 785-794. [arXiv:1603.02754](https://arxiv.org/abs/1603.02754)
4. **Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2019)**. *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*. NAACL-HLT, 4171-4186. [arXiv:1810.04805](https://arxiv.org/abs/1810.04805)
5. **Dwivedi, P., Joshi, K., & Agrawal, A. (2020)**. *Automated Car Damage Assessment using Deep Convolutional Neural Networks for Insurance Claims*. IEEE Access, 8, 112040-112052. [arXiv:2006.14655](https://arxiv.org/abs/2006.14655)
6. **Farid, H. (2009)**. *Exposing Digital Forgeries from JPEG Artifacts*. IEEE Transactions on Signal Processing, 57(11), 4408-4425. [DOI:10.1109/TSP.2009.2018898](https://doi.org/10.1109/TSP.2009.2018898)
7. **Gunning, D., Stefik, M., Choi, J., Miller, T., Stumpf, S., & Yang, G. Z. (2019)**. *DARPA's Explainable Artificial Intelligence (XAI) Program*. IEEE Intelligent Systems, 34(6), 44-58. [DOI:10.1109/MIS.2019.2952836](https://doi.org/10.1109/MIS.2019.2952836)
8. **He, K., Zhang, X., Ren, S., & Sun, J. (2016)**. *Deep Residual Learning for Image Recognition*. In Proceedings of the IEEE CVPR, 770-778. [arXiv:1512.03385](https://arxiv.org/abs/1512.03385)
9. **ISO/IEC 27037:2012**. *Information technology — Security techniques — Guidelines for identification, collection, acquisition and preservation of digital evidence*. International Organization for Standardization. [ISO Standard Catalog](https://www.iso.org/standard/44381.html)
10. **Jans, M., Lybaert, N., & Vanhoof, K. (2013)**. *Business Process Mining for Fraud Detection in Internal Invoice Processing*. Computers in Industry, 64(9), 1087-1104. [DOI:10.1016/j.compind.2013.04.004](https://doi.org/10.1016/j.compind.2013.04.004)
11. **Kipf, T. N., & Welling, M. (2017)**. *Semi-Supervised Classification with Graph Convolutional Networks*. In International Conference on Learning Representations (ICLR). [arXiv:1609.02907](https://arxiv.org/abs/1609.02907)
12. **Krawetz, N. (2007)**. *A Picture's Worth... Digital Image Analysis and Error Level Analysis*. Black Hat Briefings. [Hacker Factor Whitepaper](https://www.hackerfactor.com/papers/bh-usa-07-krawetz-wp.pdf)
13. **Liu, Z., Chen, C., Yang, X., Zhou, J., Li, X., & Song, L. (2018)**. *Heterogeneous Graph Neural Networks for Malicious Account Detection*. In Proceedings of the 27th ACM CIKM, 2077-2085. [DOI:10.1145/3269206.3272010](https://doi.org/10.1145/3269206.3272010)
14. **Lundberg, S. M., & Lee, S. I. (2017)**. *A Unified Approach to Interpreting Model Predictions*. Advances in Neural Information Processing Systems (NeurIPS), 30, 4765-4774. [arXiv:1705.07874](https://arxiv.org/abs/1705.07874)
15. **Patil, K., Kora, M., Dukare, M., & Chougule, A. (2017)**. *Deep Learning based Car Damage Classification and Detection*. IEEE ICIP, 245-249. [DOI:10.1109/ICIP.2017.8296316](https://ieeexplore.ieee.org/document/8296316)
16. **Phua, C., Lee, V., Smith, K., & Gayler, R. (2010)**. *A Comprehensive Survey of Data Mining-based Fraud Detection Research*. arXiv preprint. [arXiv:1009.6119](https://arxiv.org/abs/1009.6119)
17. **Radford, A., et al. (2021)**. *Learning Transferable Visual Models From Natural Language Supervision (CLIP)*. ICML, 8748-8763. [arXiv:2103.00020](https://arxiv.org/abs/2103.00020)
18. **Ribeiro, M. T., Singh, S., & Guestrin, C. (2016)**. *"Why Should I Trust You?": Explaining the Predictions of Any Classifier*. In ACM SIGKDD, 1135-1144. [arXiv:1602.04938](https://arxiv.org/abs/1602.04938)
19. **Selvaraju, R. R., Cogswell, M., Das, A., Vedaldi, A., Parikh, D., & Batra, D. (2017)**. *Grad-CAM: Visual Explanations from Deep Networks via Gradient-Based Localization*. IEEE ICCV, 618-626. [arXiv:1610.02391](https://arxiv.org/abs/1610.02391)
20. **Severino, M. K., & Peng, Y. (2021)**. *Machine Learning Algorithms for Fraud Prediction in Property and Casualty Insurance*. Financial Innovation, Springer, 7(1), 1-24. [DOI:10.1186/s40854-021-00254-8](https://doi.org/10.1186/s40854-021-00254-8)
21. **Šubelj, L., Furlan, Š., & Bajec, M. (2011)**. *An Expert Knowledge-driven Network Construction for Automobile Insurance Fraud Detection*. Expert Systems with Applications, 38(1), 885-893. [DOI:10.1016/j.eswa.2011.02.164](https://doi.org/10.1016/j.eswa.2011.02.164)
22. **Tan, H., & Bansal, M. (2019)**. *LXMERT: Learning Cross-Modality Encoder Representations from Transformers*. EMNLP, 5100-5111. [arXiv:1908.07490](https://arxiv.org/abs/1908.07490)
23. **Wang, D., Lin, J., Cui, P., Jia, Q., Wang, Z., & Fang, Y. (2019)**. *A Semi-supervised Graph Attentive Network for Financial Fraud Detection*. IEEE ICDM, 598-607. [DOI:10.1109/ICDM.2019.00070](https://doi.org/10.1109/ICDM.2019.00070)
24. **Zauner, C. (2010)**. *Implementation and Benchmarking of Perceptual Image Hash Functions*. Master's Thesis, Upper Austria University of Applied Sciences. [ResearchGate](https://www.researchgate.net/publication/228807905_Implementation_and_Benchmarking_of_Perceptual_Image_Hash_Functions)

---

## 👥 Contributors & Academic Supervision
- **Project Lead & Core Engineer**: Pratham Mehta
- **Domain**: AI Forensics & Machine Learning in Automotive Insurance Systems
- **Institution**: Capstone / Interdisciplinary Project Division (IPD)

---
*Developed with ❤️ and precision for insurance forensics, claims automation, and fraud mitigation.*
