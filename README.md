# AMI Analyst Workstation

A fully interactive simulation of the systems an **Advanced Metering Infrastructure (AMI) Exception Analyst** works with daily. Built as an educational tool for learning utility AMI operations.

---

## Screenshots

![Dashboard](screenshots/dashboard.png)

![Exception Queue](screenshots/exceptions.png)

---

## What This Simulates

Real AMI analysts work across multiple interconnected systems: they monitor RF mesh networks, manage meter communication failures, run VEE pipelines, resolve billing exceptions, and coordinate field service responses — all under billing cycle deadlines.

This app replicates that entire workflow in a self-contained frontend simulation:

| Module | What It Does |
|---|---|
| **Daily Dashboard** | Live summary cards, exception trend charts, severity breakdown, activity log |
| **RF Mesh Network** | SVG map of 49 smart meters and 5 collector nodes across 3 neighborhoods; real-time signal animation |
| **AMI Head-End System** | Meter communication table with on-demand reads, event log, sortable/filterable columns |
| **MDMS** | 96-interval (15-min) area chart per meter, register read log, VEE pipeline status |
| **VEE Engine** | 7 validation rules (missing intervals, spike check, sum check, etc.) with pass/fail per meter; batch run; estimation methods |
| **Exception Queue** | Full resolution workflow: review data → select action → analyst note → audit trail |
| **CIS** | Customer account lookup, 12-month billing history, service timeline, field order creation |
| **Study Mode** | Exception type guide (all 8 types), AMI glossary (26 terms), scored quiz with 6 scenarios |

---

## Exception Types Simulated

All 8 exception types an AMI analyst encounters in production:

- **Missing Read** — intervals not received within collection window
- **Consumption Spike** — usage 3–10× above historical profile
- **Zero Read on Active Account** — all intervals zero, non-solar
- **Negative Consumption** — negative intervals on non-net-metering account
- **Stale Data** — register unchanged across 3+ read cycles
- **Communication Failure** — meter unreachable at HES
- **Tamper Alert** — enclosure open / magnetic bypass event
- **CT Ratio Mismatch** — programmed vs field-detected ratio mismatch (commercial meters)

---

## Simulation Engine

A background timer drives the simulation (15 seconds real-time = 1 sim-hour × speed multiplier):

- 1–3% of meters generate missing reads each cycle
- Consumption spikes, zero reads, stale data, tamper alerts fire stochastically
- Collectors can go offline and cascade failures to all downstream meters
- RF signal strength drifts continuously with random walk
- New exceptions enter the queue automatically
- Speed controls: **Pause / 1× / 5× / 10×**
- Full localStorage persistence — sim state survives page refresh

---

## Data Model

- **49 meters** across 3 neighborhoods: Springfield-West, Springfield-Central, Northampton
- **5 collector nodes** (DCUs) with mesh health tracking
- Rate classes: Residential, Commercial (with CT ratios), Solar (net metering)
- Realistic daily load profiles: residential duck curve, commercial flat-peak, solar negative export 9am–4pm
- Seeded customer names, account numbers, addresses, firmware versions, install dates

---

## How To Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:5173

# Production build
npm run build

# Preview production build
npm run preview
```

**Requirements:** Node.js 18+ recommended.

No backend, no API keys, no environment variables required. Fully self-contained client-side app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Charts | Recharts |
| Styling | Custom CSS (no UI framework) 
| Persistence | localStorage (no database) |
| Data | 100% client-side generated fake data |

---

## Study Mode

An interactive reference for building AMI domain knowledge:

- **Exception Guide**: For each of the 8 exception types — what it is, why it matters, common causes, when to use each resolution action, and an analyst study tip
- **Glossary**: 26 AMI/utility terms defined in plain language
- **Quiz**: 6 scenario-based questions (Beginner → Advanced), scored with answer explanations and localStorage score tracking

---

## Project Structure

```
src/
├── components/
│   ├── dashboard/      # Daily Dashboard
│   ├── rfmesh/         # RF Mesh Network View
│   ├── headend/        # AMI Head-End System
│   ├── mdms/           # MDMS Interval Data Viewer
│   ├── vee/            # VEE Engine
│   ├── exceptions/     # Exception Queue + Resolution Workflow
│   ├── cis/            # Customer Information System
│   ├── study/          # Study Mode (Guide + Glossary + Quiz)
│   └── shared/         # StatusBadge, SimClock
├── data/
│   └── meters.js       # 49 meters, collectors, neighborhoods, daily profiles
├── engine/
│   └── simulation.js   # Background sim engine, exception generation, state management
├── hooks/
│   └── useSimulation.js # React hook — sim clock, derived stats, action handlers
└── styles/
    ├── phase3.css       # MDMS + VEE styles
    ├── phase4.css       # Exception Queue + modal styles
    ├── phase5.css       # CIS styles
    └── phase6.css       # Study Mode styles
```

---

## Purpose

This project demonstrates working knowledge of:

- How AMI infrastructure is architecturally organized (HES → RF Mesh → Meters → MDMS → Billing)
- What an exception analyst's daily workflow actually looks like
- The VEE pipeline: what each rule checks and why it matters for billing accuracy
- Triage decision-making for common exception types
- When to retry comm, estimate, edit, escalate, or dispatch a field tech
- CT ratio math and its billing impact on commercial accounts
- The difference between data quality issues and physical meter failures

> Built for anyone learning AMI utility operations and exception analysis workflows.
