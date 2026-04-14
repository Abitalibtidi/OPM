# From Code to Working Application: Your Step-by-Step Guide

This guide is written for non-technical stakeholders. It explains, in plain
language, every stage required to turn the completed OPM codebase into a
live web application your team can use.

---

## Overview: What Needs to Happen

Think of the code as a blueprint for a building. The blueprint is done, but
you still need to:

1. **Verify the blueprint works** (testing)
2. **Pour the foundation** (set up the server environment)
3. **Construct the building** (deploy the application)
4. **Hand out keys** (give your team access)
5. **Maintain the building** (ongoing upkeep)

---

## Process Flowchart

```
╔══════════════════════════════════════════════════════════════════╗
║                  FROM CODE TO LIVE APPLICATION                  ║
╚══════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 1: VERIFY THE CODE WORKS (You Are Here)             │
  │                                                             │
  │  1. Run automated tests     ──►  npm test                  │
  │     (already passing: 24/24)                                │
  │                                                             │
  │  2. Run the app locally     ──►  npm run dev                │
  │     Open browser to http://localhost:5173                   │
  │                                                             │
  │  3. Manual walkthrough:                                     │
  │     • Log in with demo account                              │
  │     • Create a valuation                                    │
  │     • Add share classes                                     │
  │     • Run OPM calculation                                   │
  │     • Export PDF/Excel report                               │
  │     • Check the audit log                                   │
  │                                                             │
  │  4. Validate numbers against a known Excel OPM model        │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 2: PREPARE THE ENVIRONMENT                           │
  │                                                             │
  │  Choose where the app will live. You have three options:    │
  │                                                             │
  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
  │  │  Option A    │  │  Option B     │  │  Option C         │  │
  │  │  CLOUD       │  │  ON-PREMISE   │  │  MANAGED PLATFORM │  │
  │  │  SERVER      │  │  SERVER       │  │  (Easiest)        │  │
  │  │             │  │              │  │                   │  │
  │  │  Rent a     │  │  Use your    │  │  Services like    │  │
  │  │  server     │  │  company's   │  │  Railway, Render, │  │
  │  │  from AWS,  │  │  own IT      │  │  or Vercel handle │  │
  │  │  Azure, or  │  │  infra-      │  │  servers for you. │  │
  │  │  Google     │  │  structure   │  │  You just upload  │  │
  │  │  Cloud.     │  │              │  │  the code.        │  │
  │  └─────────────┘  └──────────────┘  └───────────────────┘  │
  │                                                             │
  │  What you'll need regardless of option:                     │
  │  • A domain name (e.g., opm.yourcompany.com)                │
  │  • An SSL certificate (for https:// security)               │
  │  • A production database (PostgreSQL recommended)           │
  │  • A secret key for user sessions (random text string)      │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 3: CONFIGURE FOR PRODUCTION                          │
  │                                                             │
  │  Before going live, a few settings must change:             │
  │                                                             │
  │  ┌───────────────────┬────────────────────────────────────┐ │
  │  │ Setting           │ What to do                         │ │
  │  ├───────────────────┼────────────────────────────────────┤ │
  │  │ Database           │ Switch from SQLite (local file)   │ │
  │  │                   │ to PostgreSQL (real database)      │ │
  │  ├───────────────────┼────────────────────────────────────┤ │
  │  │ Secret Key        │ Replace the demo key with a long, │ │
  │  │                   │ random, unique password            │ │
  │  ├───────────────────┼────────────────────────────────────┤ │
  │  │ Demo Accounts     │ Remove or change all demo          │ │
  │  │                   │ passwords before going live        │ │
  │  ├───────────────────┼────────────────────────────────────┤ │
  │  │ Domain & SSL      │ Point your domain to the server   │ │
  │  │                   │ and enable HTTPS encryption        │ │
  │  └───────────────────┴────────────────────────────────────┘ │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 4: DEPLOY (PUT IT ON THE SERVER)                     │
  │                                                             │
  │  Step 1:  Upload the code to the server                     │
  │           (via Git push, file transfer, or platform UI)     │
  │                                                             │
  │  Step 2:  Install dependencies on the server                │
  │           (the server downloads all required libraries)     │
  │                                                             │
  │  Step 3:  Set up the database tables                        │
  │           (one command creates all the structure)            │
  │                                                             │
  │  Step 4:  Build the frontend                                │
  │           (compiles the web interface for speed)             │
  │                                                             │
  │  Step 5:  Start the application                             │
  │           (the server begins listening for users)            │
  │                                                             │
  │  Step 6:  Verify it works                                   │
  │           (open the URL in a browser and log in)             │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 5: TEST & VALIDATE                                   │
  │                                                             │
  │  Before inviting your team, validate thoroughly:            │
  │                                                             │
  │  ☐  Log in with each role (analyst, reviewer, admin)       │
  │  ☐  Create a new valuation from scratch                    │
  │  ☐  Enter a known capital structure from an Excel model    │
  │  ☐  Run OPM calculation and compare results to Excel       │
  │  ☐  Run backsolve and verify implied equity value          │
  │  ☐  Export PDF report — check formatting and numbers       │
  │  ☐  Export Excel report — verify formulas/values           │
  │  ☐  Confirm audit log captures all actions                 │
  │  ☐  Test that analysts cannot see other analysts' work     │
  │  ☐  Test that reviewers can see all valuations             │
  │  ☐  Attempt wrong password — confirm it's rejected         │
  │  ☐  Compare at least 3 valuations against Excel models     │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 6: GRANT TEAM ACCESS                                 │
  │                                                             │
  │  1. Create accounts for each team member:                   │
  │     • Analysts — can create and edit their own valuations   │
  │     • Reviewers — can view all valuations and audit logs    │
  │     • Admins — full access including user management        │
  │                                                             │
  │  2. Share the URL (e.g., https://opm.yourcompany.com)       │
  │                                                             │
  │  3. Provide a brief walkthrough or training session         │
  │                                                             │
  │  4. Establish a feedback channel                            │
  │     (email, Slack channel, or shared document)              │
  └──────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  STAGE 7: ONGOING MAINTENANCE                               │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  Regular Tasks (Weekly/Monthly)                     │    │
  │  │  • Back up the database                             │    │
  │  │  • Review the audit log for unusual activity        │    │
  │  │  • Monitor server health (disk space, memory)       │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  Periodic Tasks (Quarterly)                         │    │
  │  │  • Update software dependencies (security patches)  │    │
  │  │  • Review user accounts (remove departed staff)     │    │
  │  │  • Update risk-free rate presets if needed           │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                             │
  │  ┌─────────────────────────────────────────────────────┐    │
  │  │  As Needed                                          │    │
  │  │  • Add new features based on team feedback          │    │
  │  │  • Adjust valuation methodology for new standards   │    │
  │  │  • Scale the server if team grows                   │    │
  │  └─────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
```

---

## Who Do You Need?

| Role | What They Do | When You Need Them |
|------|-------------|-------------------|
| **You (Valuation Lead)** | Define requirements, validate OPM outputs, approve for use | All stages |
| **IT / DevOps person** | Set up the server, configure the database, handle deployment | Stages 2–4, 7 |
| **Developer** (or Claude) | Fix bugs, add features, update code | Stages 1, 5, 7 |
| **Team Members** | Use the application, provide feedback | Stages 5–7 |

> **Key insight:** You don't need to do the technical steps yourself. You need
> to know *what* needs to happen and *in what order* so you can direct the
> right people to do it.

---

## Estimated Timeline

| Stage | Duration | Notes |
|-------|----------|-------|
| 1. Verify | 1–2 days | Compare outputs to existing Excel models |
| 2. Prepare environment | 1–3 days | Depends on IT availability |
| 3. Configure | Half day | Straightforward settings changes |
| 4. Deploy | Half day | Mostly automated |
| 5. Test & Validate | 2–3 days | Critical — don't rush this |
| 6. Team Access | 1 day | Account creation + training |
| 7. Maintenance | Ongoing | ~1 hour per week |
| **Total to go live** | **~1–2 weeks** | |

---

## Immediate Next Step

**Right now**, the easiest thing you can do is run the application locally
and test it yourself:

1. Open a terminal in the project folder
2. Run: `npm run dev`
3. Open your browser to: `http://localhost:5173`
4. Log in with: `analyst@opm.local` / `analyst123!`
5. Click the sample valuation and explore

This lets you see and interact with the actual application — no server setup
required. Once you're satisfied it works correctly, you can move to Stage 2.
