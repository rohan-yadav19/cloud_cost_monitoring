# Product Requirements Document (PRD)
## Cloud Cost Monitoring & Resource Optimization Dashboard — Minimal Viable Implementation

**Version:** 1.0
**Stack:** MERN (MongoDB, Express, React, Node.js)
**Cloud Provider Scope:** AWS only
**Data Strategy:** AWS SDK (real) with mock data fallback

---

## 1. Purpose

Build a minimal, demo-ready dashboard that monitors AWS resource usage and cost, flags underutilized resources, and gives basic cost-optimization recommendations. The system must work end-to-end with **mock/simulated AWS data** so the project is fully functional even without live AWS billing access, but the architecture should allow switching to real AWS SDK calls without rewriting the app.

---

## 2. Goals (In Scope)

| # | Goal |
|---|------|
| G1 | Display a list of AWS resources (EC2, EBS, S3) with basic metadata |
| G2 | Show cost per resource and total spend over time |
| G3 | Show CPU/utilization metrics per resource |
| G4 | Flag idle/underutilized resources using a simple threshold rule |
| G5 | Generate basic optimization recommendations (rule-based, not ML) |
| G6 | Let user set a monthly budget and trigger an alert when exceeded |
| G7 | Export a basic cost report as CSV |
| G8 | Work fully on mock data; optionally connect to real AWS SDK |

## 3. Non-Goals (Out of Scope for this version)

- Multi-cloud support (Azure, GCP) — architecture should allow it later, not build it now
- Real-time streaming metrics (polling/periodic refresh is enough)
- ML-based forecasting or anomaly detection
- Role-based access control / multi-tenant org support
- Payment/billing integration
- Mobile app

---

## 4. Data Source Strategy

A single backend service layer, `awsCostProvider`, exposes a fixed interface:

```
getResources()
getCostData(resourceId, dateRange)
getUtilization(resourceId, dateRange)
```

Two implementations satisfy this interface:

1. **MockProvider** (default) — reads/generates data from a seed script stored in MongoDB, simulating realistic EC2/EBS/S3 resources with cost and CPU utilization history.
2. **AWSProvider** (optional) — calls AWS Cost Explorer API + CloudWatch API using `aws-sdk`, used only if valid AWS credentials are present in `.env`.

A single environment variable, `DATA_SOURCE=mock|aws`, decides which implementation loads. **Default is `mock`.** This guarantees the project always runs and demos successfully.

---

## 5. Functional Requirements

### 5.1 Authentication
- Email/password signup and login
- JWT-based session
- One role only: `user` (no admin/viewer distinction needed for MVP)

### 5.2 Resource Inventory
- List AWS resources: `resourceId, type (EC2/EBS/S3), region, status, launchDate`
- Simple table view, filterable by type and region

### 5.3 Cost Tracking
- Daily cost record per resource (mock-generated or pulled from Cost Explorer)
- Dashboard shows:
  - Total monthly spend (number)
  - Cost trend line chart (last 30 days)
  - Cost breakdown by resource type (pie/bar chart)

### 5.4 Utilization Monitoring
- CPU utilization % per EC2 resource, daily granularity
- Simple table or sparkline chart per resource

### 5.5 Idle Resource Detection
Rule-based, computed on read (no cron needed for MVP, but a scheduled job is a stretch goal):

| Condition | Flag |
|---|---|
| Avg CPU < 5% over last 7 days | "Idle — consider stopping" |
| EBS volume with `status: unattached` | "Unused volume — consider deleting" |

### 5.6 Recommendations
- Auto-generated from the rules in 5.5, stored in a `Recommendations` collection
- Displayed as a list: resource, issue, suggested action, estimated monthly savings (simple % of current cost, hardcoded assumption e.g. 30%)
- User can mark a recommendation as "Resolved" (no real action taken on AWS)

### 5.7 Budget Alerts
- User sets one monthly budget value in Settings
- On dashboard load, backend compares total spend vs budget
- If exceeded, show an in-app banner/notification
- Email alert is a **stretch goal**, not required for MVP

### 5.8 Reports
- One button: "Export CSV" → downloads current cost + recommendation data
- PDF export is a stretch goal, not required for MVP

---

## 6. Data Model (MongoDB Collections)

**Users**
```
{ _id, name, email, passwordHash, monthlyBudget, createdAt }
```

**Resources**
```
{ _id, userId, resourceId, type, region, status, launchDate }
```

**CostRecords**
```
{ _id, resourceId, date, cost }
```

**UtilizationRecords**
```
{ _id, resourceId, date, cpuPercent }
```

**Recommendations**
```
{ _id, resourceId, issueType, message, estimatedSavings, status, createdAt }
```

---

## 7. API Endpoints (Minimal Set)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/resources
GET    /api/resources/:id

GET    /api/costs/summary          → total spend, trend data
GET    /api/costs/:resourceId

GET    /api/utilization/:resourceId

GET    /api/recommendations
PATCH  /api/recommendations/:id    → mark resolved

GET    /api/budget
PUT    /api/budget

GET    /api/reports/export         → CSV download
```

---

## 8. Frontend Pages (Minimal Set)

1. **Login / Signup**
2. **Dashboard** — total spend, trend chart, cost-by-type chart, budget status banner
3. **Resources** — table of all resources with utilization + cost column
4. **Recommendations** — list of flagged resources with suggested action
5. **Settings** — set monthly budget

That's 5 pages total. No extra screens needed for MVP.

---

## 9. Mock Data Simulator (Key Deliverable)

A standalone seed script (`backend/scripts/seedMockData.js`) that:
- Creates ~15–20 fake AWS resources (mix of EC2, EBS, S3)
- Generates 30 days of cost history per resource (randomized but realistic ranges, e.g. EC2 $0.50–$5/day)
- Generates 30 days of CPU utilization per EC2 resource (some intentionally low, e.g. 1–4%, to trigger idle detection)
- Marks 2–3 EBS volumes as `unattached` to trigger recommendations

Run once via `npm run seed`, populates MongoDB, and the whole dashboard works immediately — no AWS account required.

---

## 10. Success Criteria (Definition of Done for MVP)

- [ ] User can register/login
- [ ] Dashboard shows total spend + trend chart from mock data
- [ ] Resource list shows utilization and cost per resource
- [ ] At least 2 resources are correctly flagged as idle/unattached
- [ ] Recommendations page lists flagged resources with estimated savings
- [ ] Setting a budget below current spend triggers a visible alert
- [ ] CSV export downloads a working file
- [ ] Entire app runs with `DATA_SOURCE=mock` and zero AWS credentials

---

## 11. Stretch Goals (only after MVP is complete)

1. Real AWS Cost Explorer + CloudWatch integration behind `DATA_SOURCE=aws`
2. Email alerts via Nodemailer when budget exceeded
3. PDF report export
4. node-cron scheduled recommendation refresh instead of on-read computation
5. Multi-provider support (Azure/GCP) using the same provider-interface pattern

---

## 12. Suggested Build Order

1. Backend scaffold + MongoDB models + JWT auth
2. Mock data simulator + seed script
3. Cost & resource & utilization API endpoints (mock provider only)
4. Recommendation rule engine (computed on API read)
5. React app: auth pages + protected routing
6. Dashboard page with charts (Recharts)
7. Resources page + Recommendations page
8. Budget setting + alert banner
9. CSV export
10. (Optional, time-permitting) Real AWS SDK provider swap-in

---

**Note:** This PRD intentionally excludes real-time streaming, multi-cloud, ML forecasting, and RBAC to keep scope achievable. All of these are natural "Phase 2" additions once the MVP is working end-to-end.