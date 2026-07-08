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
| G4 | Flag idle/underutilized and overutilized resources using simple threshold rules |
| G5 | Generate basic optimization recommendations (rule-based, not ML), including scale-out suggestions for overloaded resources |
| G6 | Let user set a monthly budget and trigger an alert when exceeded |
| G7 | Trigger in-app alerts/notifications when a resource is using more capacity than its defined threshold |
| G8 | Export a basic cost report as CSV |
| G9 | Work fully on mock data; optionally connect to real AWS SDK |

## 3. Non-Goals (Out of Scope for this version)

- Multi-cloud support (Azure, GCP) — architecture should allow it later, not build it now
- Real-time streaming metrics (polling/periodic refresh is enough)
- ML-based forecasting or anomaly detection
- Role-based access control / multi-tenant org support
- Payment/billing integration
- Mobile app
- Automatic AWS remediation actions such as actually resizing or scaling resources

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
- For MVP, each resource can also expose a simple `capacityLimit` or threshold reference in mock data so the system can determine when usage is above a safe limit

### 5.5 Idle Resource Detection
Rule-based, computed on read (no cron needed for MVP, but a scheduled job is a stretch goal):

| Condition | Flag |
|---|---|
| Avg CPU < 5% over last 7 days | "Idle — consider stopping" |
| EBS volume with `status: unattached` | "Unused volume — consider deleting" |

### 5.6 Overutilization Detection & Resource Alerts
Rule-based, computed on read alongside idle checks:

| Condition | Flag / Alert |
|---|---|
| Avg CPU > 80% over last 3 days for an EC2 instance | "High utilization — scale out recommended" |
| Current usage exceeds configured `capacityLimit` for a resource | "Capacity exceeded — immediate attention required" |
| Resource remains above threshold for 2+ consecutive checks | Create persistent in-app notification until acknowledged or usage returns to normal |

- When a resource is used more than its safe threshold/capacity, the backend must create an in-app alert/notification entry
- Notifications should include: resource name/id, resource type, current usage, allowed threshold, severity, and recommended next action
- MVP notification channels: in-app dashboard banner plus notification list/panel
- Alert severity should be simple and rule-based:
  - `warning` when usage is above 80% but below the hard limit
  - `critical` when usage exceeds the configured `capacityLimit`
- A newly overused resource should create a new unread notification the first time the threshold is crossed
- If the same resource remains overused, the notification stays active instead of creating unlimited duplicates on every refresh
- Once usage returns below the threshold, the alert can be marked as cleared/resolved by the system
- Email/SMS/Slack notifications are out of scope for MVP

### 5.7 Recommendations
- Auto-generated from the rules in 5.5 and 5.6, stored in a `Recommendations` collection
- Displayed as a list: resource, issue, suggested action, estimated monthly savings or expected stability improvement
- For overloaded resources, recommendation must explicitly suggest scaling out that specific resource (for example: "Scale out EC2 instance group serving resource X")
- Cost-saving recommendations can continue using a hardcoded assumption (e.g. 30% savings), while overutilization recommendations may instead show a simple impact label such as `avoids throttling` or `improves availability`
- User can mark a recommendation as "Resolved" (no real action taken on AWS)

### 5.8 Budget Alerts
- User sets one monthly budget value in Settings
- On dashboard load, backend compares total spend vs budget
- If exceeded, show an in-app banner/notification
- Email alert is a **stretch goal**, not required for MVP

### 5.9 Reports
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
{ _id, userId, resourceId, type, region, status, launchDate, capacityLimit }
```

**CostRecords**
```
{ _id, resourceId, date, cost }
```

**UtilizationRecords**
```
{ _id, resourceId, date, cpuPercent, usagePercent }
```

**Recommendations**
```
{ _id, resourceId, issueType, message, estimatedSavings, status, createdAt }
```

**Notifications**
```
{ _id, userId, resourceId, type, severity, title, message, currentUsage, thresholdValue, status, isRead, createdAt, resolvedAt }
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

GET    /api/notifications
PATCH  /api/notifications/:id      → mark read / acknowledged
GET    /api/alerts/active          → active overused-resource alerts

GET    /api/budget
PUT    /api/budget

GET    /api/reports/export         → CSV download
```

---

## 8. Frontend Pages (Minimal Set)

1. **Login / Signup**
2. **Dashboard** — total spend, trend chart, cost-by-type chart, budget status banner, overutilization alert banner, recent notifications panel
3. **Resources** — table of all resources with utilization, threshold status, alert severity, and cost column
4. **Recommendations** — list of flagged resources with suggested action, including scale-out advice for overloaded resources
5. **Settings** — set monthly budget

A lightweight notifications drawer/panel can be included inside the Dashboard rather than as a separate page to keep MVP scope small.

That's 5 pages total. No extra screens needed for MVP.

---

## 9. Mock Data Simulator (Key Deliverable)

A standalone seed script (`backend/scripts/seedMockData.js`) that:
- Creates ~15–20 fake AWS resources (mix of EC2, EBS, S3)
- Generates 30 days of cost history per resource (randomized but realistic ranges, e.g. EC2 $0.50–$5/day)
- Generates 30 days of CPU utilization per EC2 resource (some intentionally low, e.g. 1–4%, to trigger idle detection)
- Generates a few intentionally overutilized resources (e.g. 85–95% CPU or usage above `capacityLimit`) to trigger alerts and scale-out recommendations
- Marks 2–3 EBS volumes as `unattached` to trigger recommendations

Run once via `npm run seed`, populates MongoDB, and the whole dashboard works immediately — no AWS account required.

---

## 10. Success Criteria (Definition of Done for MVP)

- [ ] User can register/login
- [ ] Dashboard shows total spend + trend chart from mock data
- [ ] Resource list shows utilization and cost per resource
- [ ] At least 2 resources are correctly flagged as idle/unattached
- [ ] At least 1 resource is correctly flagged as overutilized / capacity exceeded
- [ ] Recommendations page lists flagged resources with estimated savings or scale-out guidance
- [ ] Overutilized resources create visible in-app notifications
- [ ] Setting a budget below current spend triggers a visible alert
- [ ] CSV export downloads a working file
- [ ] Entire app runs with `DATA_SOURCE=mock` and zero AWS credentials

---

## 11. Stretch Goals (only after MVP is complete)

1. Real AWS Cost Explorer + CloudWatch integration behind `DATA_SOURCE=aws`
2. Email alerts via Nodemailer when budget exceeded
3. Email/Slack alerts for overutilized or capacity-exceeded resources
4. PDF report export
5. node-cron scheduled recommendation refresh instead of on-read computation
6. Multi-provider support (Azure/GCP) using the same provider-interface pattern

---

## 12. Suggested Build Order

1. Backend scaffold + MongoDB models + JWT auth
2. Mock data simulator + seed script
3. Cost & resource & utilization API endpoints (mock provider only)
4. Recommendation + notification rule engine (computed on API read)
5. React app: auth pages + protected routing
6. Dashboard page with charts (Recharts) + alert/notification UI
7. Resources page + Recommendations page
8. Budget setting + alert banner
9. CSV export
10. (Optional, time-permitting) Real AWS SDK provider swap-in

---

**Note:** This PRD intentionally excludes real-time streaming, multi-cloud, ML forecasting, and RBAC to keep scope achievable. All of these are natural "Phase 2" additions once the MVP is working end-to-end.