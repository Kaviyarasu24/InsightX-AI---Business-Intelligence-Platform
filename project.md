# GitHub Copilot Master Prompt

## InsightX AI - Enterprise Business Intelligence Platform

> **Role:** Senior Full Stack Engineer, UI/UX Designer, Data Engineer, AI Engineer, and Software Architect.

Your task is to build a **production-ready Enterprise AI Business Intelligence Platform** from scratch.

The application must follow **enterprise software architecture**, **clean code principles**, **reusable components**, **modular development**, and **modern UI/UX**.

---

# Project Name

**InsightX AI**

**Tagline**

> Upload Excel. Analyze Automatically. Discover Insights.

---

# Project Goal

Build an AI-powered Business Intelligence Platform where users can upload Excel or CSV files.

The system should automatically:

* Read uploaded datasets
* Clean the data
* Detect data types
* Generate dataset profiling
* Create professional dashboards
* Generate AI-powered business insights
* Allow users to ask questions about the uploaded dataset
* Predict future trends
* Generate downloadable reports

---

# Authentication

**No Authentication**

The application opens directly to the Upload page.

No login, signup, or user management.

---

# Target Users

* Business Analysts
* Data Analysts
* Students
* Small Businesses
* Managers
* Researchers

---

# Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Framer Motion
* Apache ECharts
* TanStack Table
* React Router
* React Query
* Axios

---

## Backend

* FastAPI
* Python
* Pandas
* NumPy
* Scikit-Learn
* SQLAlchemy
* Uvicorn

---

## Database

PostgreSQL

---

## File Storage

Store uploaded files locally during development.

```
backend/uploads/
```

---

# Design Style

Create a modern enterprise SaaS dashboard inspired by:

* Microsoft Fabric
* Power BI
* Tableau
* Notion
* Stripe Dashboard
* Linear

UI Requirements:

* Clean layout
* Rounded cards
* Soft shadows
* Premium typography
* Glassmorphism where appropriate
* Dark mode support
* Responsive design
* Minimal and professional

Avoid cartoon-style interfaces.

---

# Color Palette

| Purpose    | Color   |
| ---------- | ------- |
| Primary    | #2563EB |
| Secondary  | #4F46E5 |
| Success    | #10B981 |
| Warning    | #F59E0B |
| Danger     | #EF4444 |
| Background | #0F172A |
| Card       | #1E293B |
| Text       | #F8FAFC |

---

# Animations

Use Framer Motion throughout the application.

Include:

* Page transitions
* Fade animations
* Slide animations
* Upload success animation
* Card hover effects
* Button hover effects
* Dashboard entrance animation
* Animated KPI counters
* Loading skeletons
* Smooth scrolling
* Smooth chart rendering

The application should feel premium.

---

# Folder Structure

```
InsightX-AI/

frontend/
│
├── assets/
├── components/
├── hooks/
├── layouts/
├── pages/
├── services/
├── styles/
├── types/
├── utils/
│
backend/
│
├── api/
├── database/
├── models/
├── services/
├── uploads/
├── utils/
│
ml/
│
├── preprocessing/
├── profiling/
├── forecasting/
├── anomaly_detection/
├── insights/
├── recommendation/
│
reports/
docs/
```

---

# Main Pages

## 1. Upload Page

Features:

* Drag & Drop Upload
* Browse File
* Excel Support
* CSV Support
* Upload Progress
* File Preview
* Validation

---

## 2. Dataset Overview

Display:

* Dataset Name
* Total Rows
* Total Columns
* Missing Values
* Duplicate Rows
* Numeric Columns
* Text Columns
* Date Columns
* Memory Usage

---

## 3. Data Cleaning

Automatically detect:

* Missing values
* Duplicate records
* Invalid dates
* Incorrect data types
* Empty columns

Display:

* Before Cleaning
* After Cleaning

Allow users to download the cleaned dataset.

---

## 4. Data Preview

Create an interactive table with:

* Sorting
* Filtering
* Search
* Pagination
* Column Selection

---

## 5. Dashboard

Automatically generate visualizations.

### KPI Cards

* Revenue
* Profit
* Orders
* Average Sales
* Growth %
* Customer Count

### Charts

* Bar Chart
* Line Chart
* Pie Chart
* Donut Chart
* Area Chart
* Scatter Plot
* Heatmap
* Treemap
* Histogram

### Filters

* Date
* Category
* Region
* Product

---

## 6. AI Insights

Generate professional business insights.

Example:

* Revenue increased by 18% this quarter.
* South region contributed the highest sales.
* Electronics generated 42% of total revenue.
* Product A sales have declined over the past three months.

Do not generate generic summaries.

Provide meaningful business observations.

---

## 7. AI Chat

Users should be able to ask questions such as:

* Show highest sales month
* Compare 2024 and 2025
* Which region performs best?
* Which products are underperforming?
* Create a chart for monthly sales
* Predict next month's revenue

---

## 8. Forecasting

Predict:

* Sales
* Revenue
* Orders

Display forecast charts alongside historical data.

---

## 9. Recommendations

Generate business recommendations.

Examples:

* Increase inventory for Product A.
* Focus marketing on Region B.
* Reduce advertising spend on Product C.
* Improve customer retention in Region D.

---

## 10. Report Generation

Generate downloadable reports in PDF format.

Include:

* Executive Summary
* KPI Cards
* Charts
* AI Insights
* Recommendations

---

# Coding Standards

* Use TypeScript throughout the frontend.
* Keep components reusable.
* Use custom hooks where appropriate.
* Follow SOLID principles.
* Avoid duplicated code.
* Separate UI from business logic.
* Implement robust error handling.
* Show loading states for all asynchronous operations.
* Write clean, maintainable code with meaningful names.

---

# Performance

Optimize for:

* Fast loading
* Lazy loading
* Code splitting
* Efficient API calls
* Memoization where appropriate

---

# Responsiveness

The application must work seamlessly on:

* Desktop
* Tablet
* Mobile

---

# Expected Development Process

Build the application incrementally.

Do **not** generate the entire project in a single response.

For each development step:

1. Explain the goal.
2. Create the required folders.
3. Create the required files.
4. Explain the purpose of each file.
5. Generate production-ready code.
6. Wait for confirmation before continuing.

---

# Development Order

1. Initialize React + TypeScript + Vite project.
2. Configure Tailwind CSS, Framer Motion, Apache ECharts, and React Router.
3. Build the Upload page.
4. Create the FastAPI backend.
5. Implement Excel/CSV upload APIs.
6. Parse datasets using Pandas.
7. Build automatic dataset profiling.
8. Create the interactive data table.
9. Generate dynamic dashboards.
10. Implement AI-powered insights.
11. Add natural language querying.
12. Implement forecasting.
13. Add anomaly detection.
14. Generate PDF reports.
15. Improve animations, responsiveness, and overall user experience.
16. Optimize and prepare the project for deployment.

---

# Final Goal

Deliver a production-quality Enterprise AI Business Intelligence Platform with:

* Modern enterprise UI
* Clean architecture
* Scalable codebase
* Interactive dashboards
* AI-generated insights
* Intelligent forecasting
* Professional reporting

The final application should be suitable for showcasing as a portfolio project and demonstrate full-stack development, data analytics, machine learning, and AI integration skills.
