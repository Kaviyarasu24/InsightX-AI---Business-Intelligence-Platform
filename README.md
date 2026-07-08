# 📊 InsightX AI

> **Enterprise Business Intelligence Platform**  
> *Upload Excel/CSV. Analyze Automatically. Discover Insights.*

---

> [!IMPORTANT]
> **Project Status: Under Active Development 🛠️**  
> This project is currently in the active development phase. Features are being built out incrementally according to our roadmap. Not all features are fully production-ready.

---

## 🚀 Overview

**InsightX AI** is an AI-powered Business Intelligence (BI) platform designed to democratize data analytics. Users can upload raw Excel or CSV datasets, and the platform automatically handles data cleaning, profiling, interactive dashboard generation, AI-powered trend analysis, natural language querying (AI chat), and forecasting.

### Key Features
* 📁 **Drag & Drop Upload:** Seamless support for large Excel and CSV files.
* 🧼 **Auto-Cleaning & Profiling:** Automated duplicate detection, missing value handling, and column data-type classification.
* 📊 **Dynamic Dashboards:** Interactive visual analytics (KPI cards, bar, line, pie, scatter, histogram, and heatmaps) powered by **Apache ECharts**.
* 🧠 **AI Insights & Recommendations:** Automated, contextual business observations and recommendations rather than generic summaries.
* 💬 **AI Chat Interface:** Ask natural language questions about your dataset (e.g., "Which products are underperforming?", "Predict next month's revenue").
* 📈 **Forecasting & Anomaly Detection:** Time-series forecasting and statistical anomaly detection on key business metrics.
* 📄 **Professional Reporting:** Export dashboard analyses and executive summaries into clean, downloadable PDF reports.

---

## 🛠️ Technology Stack

| Component | Technologies Used |
| :--- | :--- |
| **Frontend** | React (v19+), TypeScript, Vite, Tailwind CSS, Framer Motion, Apache ECharts, TanStack Table, React Router, React Query, Axios |
| **Backend** | FastAPI (Python), Pandas, NumPy, Scikit-Learn, SQLAlchemy, Uvicorn |
| **Database** | PostgreSQL |
| **Storage** | Local file storage (for uploads during development) |

---

## 📁 Folder Structure

```text
InsightX-AI/
├── backend/            # FastAPI Python server
│   ├── app/
│   │   ├── api/        # Routes/endpoints
│   │   ├── core/       # Configurations (FastAPI, db config)
│   │   └── main.py     # Application entry point
│   ├── uploads/        # Directory for temporary file uploads
│   └── requirements.txt
│
├── frontend/           # React + TypeScript + Vite app
│   ├── src/
│   │   ├── assets/     # Images & svg resources
│   │   ├── components/ # Reusable UI components
│   │   ├── layouts/    # App layout components (e.g. AppShell)
│   │   ├── pages/      # Route-level pages (Upload, Overview, etc.)
│   │   ├── services/   # API clients (axios, queryClient)
│   │   └── main.tsx    # App entry point
│   ├── package.json
│   └── vite.config.ts
│
├── package.json        # Root package file for dependencies
├── project.md          # Project prompt and requirements spec
└── status.md           # Development roadmap & status checklist
```

---

## 🗺️ Development Roadmap & Current Progress

- [x] **Phase 1: Project Scaffolding** React + TS + Vite setup with Tailwind CSS, Framer Motion, and Routing.
- [x] **Phase 2: File Upload UI** Interactive drag & drop interface for dataset upload.
- [x] **Phase 3: FastAPI Backend** Framework initialization, router definitions, and project structure.
- [ ] **Phase 4: Excel/CSV Upload API** File validation and saving mechanisms.
- [ ] **Phase 5: Data Profiling & Preview** Pandas-powered data cleaning and interactive table view.
- [ ] **Phase 6: Visual Dashboards** Dynamic KPI cards and Apache ECharts integration.
- [ ] **Phase 7: AI Insights & Recommendation engine** Natural language querying, metrics extraction.
- [ ] **Phase 8: Time-series Forecasting & Anomaly detection** ML models for predicting trends.
- [ ] **Phase 9: PDF Export** Report builder.

---

## 💻 Getting Started

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher)
* **PostgreSQL** (for storage)

### Installation & Run

#### 1. Clone the repository
```bash
git clone https://github.com/Kaviyarasu24/InsightX-AI---Business-Intelligence-Platform.git
cd InsightX-AI
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### 3. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

