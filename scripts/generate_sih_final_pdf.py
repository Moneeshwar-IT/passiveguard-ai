import os
import sys
import time
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
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
        if self._pageNumber == 1:
            # Suppress header and footer on cover page
            return
        
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        
        # Running Header
        self.drawString(54, 11 * inch - 36, "PASSIVEGUARD AI — SIH FINAL ARCHITECTURE & BLUEPRINT REPORT")
        self.setFont("Helvetica", 8)
        self.drawRightString(8.5 * inch - 54, 11 * inch - 36, "SIH FINAL ROUND DOCUMENTATION")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
        
        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawString(54, 36, "CONFIDENTIAL — SIH FINAL EVALUATION BLUEPRINT")
        self.drawRightString(8.5 * inch - 54, 36, page_str)
        self.line(54, 46, 8.5 * inch - 54, 46)
        self.restoreState()

def make_paragraph_table(data, col_widths, header_style, cell_style, bg_color="#0f172a", alt_bg_color="#f8fafc"):
    formatted_data = []
    for r_idx, row in enumerate(data):
        formatted_row = []
        for c_idx, cell in enumerate(row):
            style = header_style if r_idx == 0 else cell_style
            formatted_row.append(Paragraph(str(cell), style))
        formatted_data.append(formatted_row)
    
    t = Table(formatted_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(bg_color)),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor(alt_bg_color)])
    ]))
    return t

def build_pdf_report(pdf_filename, text_filename):
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2563eb"),
        spaceAfter=14
    )
    
    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=13,
        textColor=colors.HexColor("#475569")
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13.5,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'BulletDark',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=4,
        spaceBefore=4,
        spaceAfter=6
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#1e293b")
    )

    story = []

    # ==================== TITLE BLOCK ====================
    story.append(Paragraph("PASSIVEGUARD AI — SIH FINAL BLUEPRINT", title_style))
    story.append(Paragraph("Frontend Technologies, Backend Architecture, Built Features & SIH Final Roadmap", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=10))
    
    meta_text = """
    <b>Project Name:</b> PassiveGuard AI (Unidirectional Cyber Threat Detection Platform)<br/>
    <b>SIH Domain:</b> Cybersecurity / Air-Gapped Enclave Monitoring & Data Diode Protection<br/>
    <b>Live Production Frontend:</b> https://passiveguard-frontend.onrender.com<br/>
    <b>Live Production Backend:</b> https://passiveguard-backend-s7vk.onrender.com<br/>
    <b>Pytest Verification:</b> 263 Unit & Integration Tests Passed (1 Skipped) | 100% Build Clean
    """
    story.append(Paragraph(meta_text, meta_style))
    story.append(Spacer(1, 8))

    # ==================== SECTION 1: WHAT WE USED IN FRONTEND ====================
    story.append(Paragraph("1. Frontend Technologies & Component Architecture (What We Used in Frontend)", h1_style))
    story.append(Paragraph(
        "The frontend is a modern, high-performance **Single Page Application (SPA)** built with React 18 and Vite 6, specifically styled for high-density Security Operations Center (SOC) environments.",
        body_style
    ))
    
    frontend_tech = [
        ["Category", "Technology / Library", "Version / Tool", "Purpose & Implementation Details"],
        ["Framework & Core", "React JS (SPA)", "18.3.1", "Component-based declarative UI with custom React hooks and state management."],
        ["Build Tooling", "Vite JS", "6.4.3", "Ultra-fast production ESM bundler, dev server, and build compiler."],
        ["React Compiler Plugin", "@vitejs/plugin-react", "5.1.0", "Babel-based fast refresh and JSX transformation plugin for Vite."],
        ["Styling Engine", "Tailwind CSS", "3.4.1", "Utility-first CSS framework with PostCSS and custom SOC dark theme palette."],
        ["Icon System", "Lucide React", "0.400.0", "Scalable vector icons (Shield, Server, Radio, Activity, AlertTriangle, Cpu)."],
        ["Data Visualization", "Recharts", "2.12.7", "Interactive SVG charting (AreaChart timeline, BarChart threat distribution)."],
        ["Routing Engine", "React Router DOM", "6.24.1", "Declarative client-side SPA routing (`BrowserRouter`, `Routes`, `Route`)."],
        ["HTTP Client", "Axios", "1.7.2", "Centralized REST client with timeout configuration and HTTP error formatting."],
        ["Real-Time Stream", "Native WebSocket API", "Browser Native", "Protocol-aware `ws://`/`wss://` client with auto-reconnect logic."]
    ]
    story.append(make_paragraph_table(frontend_tech, [90, 114, 70, 230], table_header_style, table_cell_style, "#0f172a", "#f8fafc"))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Frontend Pages Implemented:</b>", body_style))
    story.append(Paragraph("• <b>SOC Dashboard (<code>/</code>):</b> Real-time active flow counts, total alerts, bandwidth, Recharts traffic rate timeline, and threat distribution charts.", bullet_style))
    story.append(Paragraph("• <b>Controlled Demo Simulator (<code>/demo</code>):</b> Interactive scenario catalog (DDoS, Recon, C2, DGA, Tunnel, TLS, Exfil, Mixed, Full Demo), execution controls, and WebSocket event log.", bullet_style))
    story.append(Paragraph("• <b>Threat Alerts Center (<code>/alerts</code>):</b> Searchable, filterable table of all recorded security findings with severity badges.", bullet_style))
    story.append(Paragraph("• <b>Threat Evidence Inspector (<code>/alert-details</code>):</b> Deep 5-tuple inspection, model confidence breakdown, explainable evidence reasons, and raw JSON payload inspector.", bullet_style))
    story.append(Paragraph("• <b>Traffic Telemetry & Analytics (<code>/traffic</code>):</b> Transport layer protocol distribution bars and historical byte throughput statistics.", bullet_style))
    story.append(Paragraph("• <b>AI Model Registry (<code>/models</code>):</b> Status registry displaying trained `.joblib` model versions, dataset provenance (UNSW-NB15), and benchmark accuracy metrics.", bullet_style))
    story.append(Spacer(1, 8))

    # ==================== SECTION 2: WHAT WE USED IN BACKEND ====================
    story.append(Paragraph("2. Backend Technologies & System Engine (What We Used in Backend)", h1_style))
    story.append(Paragraph(
        "The backend is a high-speed Python 3.12+ asynchronous microservice built on FastAPI, Uvicorn, and scikit-learn, operating under strict zero-trust passive security constraints.",
        body_style
    ))

    backend_tech = [
        ["Category", "Technology / Library", "Version / Tool", "Purpose & Implementation Details"],
        ["Language & Runtime", "Python", "3.12 / 3.14", "Core backend execution environment and numerical feature processing."],
        ["Web Framework", "FastAPI", "0.115.0", "Asynchronous ASGI framework powering REST API endpoints and WebSocket server."],
        ["ASGI Server", "Uvicorn", "0.30.0", "Lightning-fast ASGI web server with asyncio event loop management."],
        ["Data Validation", "Pydantic & Pydantic-Settings", "2.10.0", "Type hint validation, Settings management, and strict schema serialization."],
        ["Machine Learning", "scikit-learn", "1.5.0", "RandomForestClassifier model loading and real-time probability inference."],
        ["Model Serialization", "Joblib", "1.4.2", "Efficient loading of binary `.joblib` ML model weights."],
        ["Numerical Data", "NumPy & Pandas", "1.26.4 / 2.2.0", "Numerical matrix manipulation and UNSW-NB15 feature matrix transformation."],
        ["Database Store", "SQLite 3", "Python Native", "Local WAL-mode SQLite persistence for alerts and traffic snapshots (`passiveguard.db`)."],
        ["Testing Framework", "Pytest & HTTPX", "8.2.0", "Automated test runner executing 263 unit, integration, and AST static safety tests."]
    ]
    story.append(make_paragraph_table(backend_tech, [90, 114, 70, 230], table_header_style, table_cell_style, "#1e40af", "#f8fafc"))
    story.append(Spacer(1, 8))

    # ==================== SECTION 3: WHAT IS BUILT & WORKING NOW ====================
    story.append(Paragraph("3. Built & Deployed Capabilities (What Things Are Built Now)", h1_style))
    
    built_table = [
        ["Component / Feature", "Built Architecture", "Current Operational Status", "Verification / File"],
        ["Passive Flow Ingestor", "5-tuple FlowRecord builder tracking packets, bytes, timestamps, & transport metadata.", "BUILT & WORKING", "app/pipeline/engine.py"],
        ["7 Threat Detectors", "DDoS (ML+Stat), Recon (ML+Stat), C2 (Stat), DGA (Entropy), Tunnel (Entropy), TLS (Metadata), Exfil (Ratio).", "BUILT & WORKING", "app/detection/"],
        ["Real ML Pipeline (UNSW-NB15)", "RandomForest models trained on UNSW-NB15 DoS/Recon held-out test set (DDoS: 93.53%, Recon: 97.43%).", "BUILT & WORKING", "data/models/*.joblib"],
        ["Multi-Signal Risk Fusion", "Weighted multi-detector aggregation assigning fused risk score [0.0, 1.0] and severity tags.", "BUILT & WORKING", "app/risk/fusion.py"],
        ["SQLite Alert & Traffic Store", "WAL-mode SQLite store (`alerts` & `traffic_stats` tables) with 60s deduplication cooldown.", "BUILT & WORKING", "app/alerts/store.py"],
        ["WebSocket Stream Server", "FastAPI `/ws` streaming `alert_created`, `traffic_update`, and `state_reset` events.", "BUILT & WORKING", "app/api/websocket.py"],
        ["Controlled Threat Simulator", "Thread-safe service executing 9 scenarios (DDoS, Recon, C2, DGA, Tunnel, TLS, Exfil, Mixed, All).", "BUILT & WORKING", "app/demo/runner.py"],
        ["SOC Dashboard SPA", "React 18 frontend with Recharts timeline, alert details inspector, and model performance page.", "BUILT & WORKING", "frontend/src/"],
        ["AST Passive Safety Checks", "Static AST analyzer verifying zero socket.send(), zero active probes, zero packet emission.", "BUILT & WORKING", "tests/test_demo_api.py"],
        ["Production Render Deployment", "Deployed live on Render with CORS middleware, HTTPS/WSS support, and health checks.", "BUILT & DEPLOYED", "https://passiveguard-backend-s7vk.onrender.com"]
    ]
    story.append(make_paragraph_table(built_table, [120, 194, 90, 100], table_header_style, table_cell_style, "#065f46", "#f0fdf4"))
    story.append(Spacer(1, 8))

    # ==================== SECTION 4: WHAT IS GOING TO BE BUILT IN SIH FINAL ====================
    story.append(Paragraph("4. SIH Final Round Development Roadmap (What Things Are Going to Be Built)", h1_style))
    story.append(Paragraph(
        "To elevate **PassiveGuard AI** from a functional demonstration prototype to an enterprise-grade defense solution during the SIH Final, the following enhancement roadmap will be implemented:",
        body_style
    ))

    sih_final_table = [
        ["Priority", "Target Feature / Component", "SIH Final Planned Architecture", "Impact & Value Add"],
        ["P0 (Critical)", "Physical Hardware TAP & Diode Link", "Integration with physical optical TAP devices and raw socket `libpcap`/`AF_PACKET` ring buffers.", "Enables direct real-time capture from live 1G/10G physical data diode lines."],
        ["P0 (Critical)", "NetFlow / IPFIX / sFlow Collector", "Native binary UDP listener ingesting NetFlow v5/v9, IPFIX, and sFlow datagrams directly from core switches.", "Allows enterprise-wide flow ingestion without requiring local packet capture agents."],
        ["P1 (High)", "PostgreSQL + TimescaleDB Storage", "Migrating from local SQLite to PostgreSQL with TimescaleDB time-series hyper-tables.", "Supports multi-gigabyte traffic metric retention and high-throughput concurrent writes."],
        ["P1 (High)", "Apache Kafka / NATS Message Bus", "Asynchronous event-driven flow ingestion pipeline using NATS JetStream or Kafka topics.", "Scales ingestion capacity to 100,000+ flows per second without backend bottleneck."],
        ["P1 (High)", "Continuous Retraining & Drift Monitor", "Automated feature distribution drift monitoring calculating Population Stability Index (PSI) to trigger retraining.", "Prevents model accuracy degradation due to production network concept drift."],
        ["P1 (High)", "Role-Based Access Control (RBAC)", "JWT authentication with Analyst, SOC Lead, and Auditor roles regulating configuration changes.", "Provides enterprise access control and compliant SOC operator audit trails."],
        ["P2 (Medium)", "UI PDF Executive SOC Report Export", "One-click PDF report generation button on SOC Dashboard exporting executive threat summaries.", "Allows SOC managers to export instant PDF threat reports for SIH judges and auditors."],
        ["P2 (Medium)", "Outbound Webhooks (Slack/Splunk)", "Passive HTTP webhook dispatches pushing high-severity alert JSON payloads to external SIEMs.", "Integrates seamlessly with existing SOC alert management tools (Splunk, Elastic, Slack)."]
    ]
    story.append(make_paragraph_table(sih_final_table, [60, 134, 170, 140], table_header_style, table_cell_style, "#991b1b", "#fef2f2"))
    story.append(Spacer(1, 10))

    # ==================== SUMMARY & CONCLUSION ====================
    story.append(Paragraph("5. Summary of System Readiness for SIH Final Evaluation", h1_style))
    story.append(Paragraph("• <b>Backend Integrity:</b> 263 Pytest unit/integration tests passing cleanly (`263 passed, 1 skipped`).", bullet_style))
    story.append(Paragraph("• <b>Frontend Integrity:</b> Vite 6 SPA production bundle compiled with 0 errors (`dist/index.html`).", bullet_style))
    story.append(Paragraph("• <b>Passive Safety Guaranteed:</b> 100% static AST verified; 0 socket creation calls, 0 packet emissions.", bullet_style))
    story.append(Paragraph("• <b>Production Access:</b> Backend: <code>https://passiveguard-backend-s7vk.onrender.com</code> | Frontend: <code>https://passiveguard-frontend.onrender.com</code>", bullet_style))

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))
    story.append(Paragraph("End of SIH Final Architecture & Roadmap Report — PassiveGuard AI", ParagraphStyle('EndReport', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=1, textColor=colors.HexColor("#475569"))))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated SIH Final PDF report: {pdf_filename}")

def build_txt_report(txt_filename):
    text_content = """================================================================================
PASSIVEGUARD AI — SIH FINAL ARCHITECTURE & ROADMAP REPORT
================================================================================

Project Name: PassiveGuard AI (Unidirectional Cyber Threat Detection Platform)
SIH Domain: Cybersecurity / Air-Gapped Enclave Monitoring & Data Diode Protection
Live Production Frontend: https://passiveguard-frontend.onrender.com
Live Production Backend: https://passiveguard-backend-s7vk.onrender.com
Pytest Verification: 263 Unit & Integration Tests Passed (1 Skipped) | 100% Build Clean

================================================================================
1. FRONTEND TECHNOLOGIES (WHAT WE USED IN FRONTEND)
================================================================================
- Framework: React 18.3.1 (Single Page Application - SPA)
- Build Tool: Vite JS 6.4.3 with @vitejs/plugin-react 5.1.0
- Styling Engine: Tailwind CSS 3.4.1 with custom SOC dark theme palette
- Icon System: Lucide React 0.400.0 (Shield, Server, Radio, Activity, AlertTriangle)
- Charting: Recharts 2.12.7 (AreaChart timeline, BarChart threat distribution)
- Routing: React Router DOM 6.24.1 (BrowserRouter, Routes, Route)
- HTTP Client: Axios 1.7.2 with timeouts and detailed HTTP status formatting
- Real-Time Stream: Native WebSocket API with getWebSocketUrl() (https->wss, http->ws)

Pages Implemented:
1. SOC Dashboard (/): Real-time metrics, Recharts timeline, threat breakdown.
2. Demo Simulator (/demo): Interactive threat scenario runner (9 scenarios) & log.
3. Threat Alerts Center (/alerts): Searchable & filterable alert finding table.
4. Evidence Inspector (/alert-details): 5-tuple connection details & model evidence.
5. Traffic Analytics (/traffic): Transport layer protocol distribution bars.
6. AI Model Registry (/models): UNSW-NB15 model version status & benchmark accuracy.

================================================================================
2. BACKEND TECHNOLOGIES (WHAT WE USED IN BACKEND)
================================================================================
- Language & Runtime: Python 3.12 / 3.14
- Web Framework: FastAPI 0.115.0 with Uvicorn 0.30.0 ASGI server
- Schema Validation: Pydantic v2 & Pydantic-Settings (BaseSettings, field_validator)
- Machine Learning: scikit-learn 1.5.0 (RandomForestClassifier model loading)
- Model Serialization: Joblib 1.4.2 (.joblib binary model artifacts)
- Numerical Matrix: NumPy 1.26.4 & Pandas 2.2.0
- Persistence Database: SQLite 3 (WAL mode passiveguard.db)
- Testing Framework: Pytest 8.2.0 (263 unit, integration & AST passive tests)

================================================================================
3. WHAT IS BUILT & WORKING NOW
================================================================================
- Passive Flow Ingestor (5-tuple FlowRecord builder) [BUILT & WORKING]
- 7 Threat Detectors (DDoS, Recon, C2, DGA, Tunnel, TLS, Exfil) [BUILT & WORKING]
- Real ML Pipeline (UNSW-NB15 DDoS: 93.53%, Recon: 97.43% accuracy) [BUILT & WORKING]
- Multi-Signal Risk Fusion Engine (Weighted aggregation [0.0, 1.0]) [BUILT & WORKING]
- SQLite Alert & Traffic Store (alerts & traffic_stats tables) [BUILT & WORKING]
- WebSocket Stream Server (/ws broadcasting live events) [BUILT & WORKING]
- Controlled Threat Simulator (9 scenarios with lock protection) [BUILT & WORKING]
- Full React SOC Dashboard & Inspector UI [BUILT & WORKING]
- AST Passive Safety Static Checker [BUILT & WORKING]
- Production Deployment on Render (Frontend + Backend) [BUILT & DEPLOYED]

================================================================================
4. WHAT WE ARE GOING TO BUILD IN SIH FINAL (PLANNED ROADMAP)
================================================================================
P0 (Critical):
- Physical Hardware TAP & Data Diode Ring Buffer: Integration with libpcap/AF_PACKET for live 1G/10G physical diode links.
- NetFlow / IPFIX / sFlow Collector: Native binary UDP listener ingesting enterprise switch datagrams directly.

P1 (High):
- PostgreSQL + TimescaleDB Storage: Migrating from SQLite to TimescaleDB time-series hyper-tables for multi-gigabyte retention.
- Apache Kafka / NATS Streaming Bus: Asynchronous event-driven pipeline scaling ingestion to 100,000+ flows/sec.
- Continuous Retraining & Drift Monitor: PSI monitoring measuring feature distribution shifts to trigger automated retraining.
- Role-Based Access Control (RBAC): JWT authentication with Analyst, SOC Lead, and Auditor permissions.

P2 (Medium):
- UI PDF Executive SOC Report Export: One-click PDF export button on Dashboard for SOC managers and SIH judges.
- Outbound Webhooks (Slack/Splunk): Passive HTTP webhook dispatches pushing alert JSON payloads to external SIEMs.

================================================================================
"""
    with open(txt_filename, "w", encoding="utf-8") as f:
        f.write(text_content)
    print(f"Successfully generated SIH Final TXT report: {txt_filename}")

if __name__ == "__main__":
    pdf_out = os.path.join(os.path.dirname(__file__), "PassiveGuard_AI_SIH_Final_Architecture_Blueprint.pdf")
    txt_out = os.path.join(os.path.dirname(__file__), "PassiveGuard_AI_SIH_Final_Architecture_Blueprint.txt")
    build_pdf_report(pdf_out, txt_out)
    build_txt_report(txt_out)
