# OPM Valuation Platform

A production-ready web platform for equity valuation using the **Option Pricing Model (OPM) / Backsolve Method**, aligned with AICPA and IPEV valuation principles.

## Features

- **OPM Calculation Engine** — Black-Scholes option pricing with breakpoint analysis across complex capital structures
- **Backsolve** — Iteratively solve for implied total equity value given a known per-share value
- **Capital Structure Modeling** — Multiple share classes (common, preferred, options) with liquidation preferences, participation rights, conversion ratios, and seniority
- **Role-Based Access** — Analyst, Reviewer, and Admin roles with appropriate permissions
- **Full Audit Trail** — Every action is logged for compliance and review
- **PDF & Excel Export** — Downloadable reports suitable for audit
- **Collaborative** — Multiple team members can create, edit, and review valuations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite via Prisma (swappable to PostgreSQL) |
| Valuation Engine | Deterministic Black-Scholes implementation |
| Auth | JWT + bcrypt, role-based access control |
| Export | PDFKit, ExcelJS |

## Quick Start

```bash
# Install all dependencies
npm run setup

# Start development servers (backend + frontend)
npm run dev
```

The app will be available at **http://localhost:5173** with the API at **http://localhost:3000**.

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@opm.local | admin123! |
| Analyst | analyst@opm.local | analyst123! |
| Reviewer | reviewer@opm.local | reviewer123! |

## Project Structure

```
├── server/                  # Backend API
│   ├── src/
│   │   ├── engine/          # OPM valuation engine
│   │   │   ├── blackScholes.ts    # Black-Scholes formula
│   │   │   ├── breakpoints.ts     # Capital structure breakpoints
│   │   │   ├── opm.ts             # OPM calculation orchestrator
│   │   │   └── backsolve.ts       # Backsolve (implied equity value)
│   │   ├── middleware/      # Auth, audit logging
│   │   ├── routes/          # API endpoints
│   │   └── utils/           # PDF/Excel generation
│   └── prisma/              # Database schema & migrations
├── client/                  # Frontend React app
│   └── src/
│       ├── pages/           # Dashboard, Editor, Results, etc.
│       ├── components/      # Layout, ProtectedRoute
│       ├── context/         # Auth context
│       └── api/             # API client
└── shared/                  # Shared TypeScript types
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user profile |
| GET/POST | `/api/valuations` | List/Create valuations |
| GET/PUT/DELETE | `/api/valuations/:id` | Get/Update/Delete valuation |
| GET/POST/PUT/DELETE | `/api/valuations/:id/share-classes` | Manage share classes |
| POST | `/api/valuations/:id/calculate` | Run OPM calculation |
| POST | `/api/valuations/:id/backsolve` | Run backsolve |
| GET | `/api/valuations/:id/export/pdf` | Export PDF report |
| GET | `/api/valuations/:id/export/excel` | Export Excel report |
| GET | `/api/audit-log` | View audit log |
| GET/PUT/DELETE | `/api/users` | User management (admin) |

## Valuation Methodology

The platform implements the **Option Pricing Model (OPM)** as described in the AICPA Accounting and Valuation Guide:

1. **Breakpoint Construction** — Equity value breakpoints are derived from liquidation preferences, conversion points, and participation caps
2. **Call Option Valuation** — Black-Scholes call options are computed at each breakpoint
3. **Tranche Allocation** — Value between breakpoints is allocated to participating share classes
4. **Per-Share Values** — Total class values are divided by fully-diluted shares

The **Backsolve Method** uses bisection to find the implied total equity value that produces a known per-share value for a target class.

## Running Tests

```bash
npm test
```

Tests cover the Black-Scholes implementation, OPM calculation logic, and backsolve convergence.
