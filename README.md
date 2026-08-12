# SSC Customer Portal

A customer-facing executive portal for a Shared Service Centre. A CFO, CEO or
entity leader signs in and sees, in one place: **what services the SSC provides
them, how much they are using, what they are being charged, how well it is
performing, what is going wrong, what their people think, and what value the
SSC is creating beyond transaction processing.**

This is a **working prototype**. Authentication is simulated and every figure is
illustrative — no SAP, Ariba, HR or automation system is connected. The data is
not random: it is generated from contracted rate cards so that the numbers
reconcile with each other everywhere they appear.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with any demo account (they are listed on the login page):

| Account | Scope | Demonstrates |
|---|---|---|
| `cfo@delhiairport.demo` | Delhi International Airport, all 5 services | The main demo path |
| `group.cfo@gmrgroup.demo` | 9 entities across 5 locations | Location/entity switching, portfolio roll-up |
| `ceo@hyderabadairport.demo` | Hyderabad cluster (2 entities) | A service in genuine trouble (HR SLA 82%) |
| `hr.head@delhiairport.demo` | DIAL, HR + Automation only | Service-level authorisation |

Password for all accounts: `demo1234`

```bash
npm run build        # production build
npm run verify:data  # assert the dataset reconciles (37 checks)
npm run typecheck
```

---

## The demo path

1. **Sign in** as `cfo@delhiairport.demo`
2. **Overview** — executive summary, *Attention required*, service cards, billing,
   customer experience, the value automation and analytics are creating
3. **F&A** → **Overview** — 10,240 invoices, ₹18.40 Cr invoice value, 4.2-day
   processing time, 3.4% rejection rate, 96.8% SLA
4. **F&A → Billing** — *"Why you are charged ₹45.08 L this month"*: transaction
   charging (10,240 invoices × ₹100 = ₹10.24 L) and FTE charging side by side,
   then the drivers behind the month-on-month move
5. **F&A → KPI** — five KPIs with actual, target, status and trend, then the SLA
   decomposed into its weighted components
6. **F&A → Issues** — open items with ageing against target; click any row for the
   full history and the KPI it affects
7. **HR → KPI** — a different KPI set entirely, including the worked
   **KPI → performance gap → issues → feedback** chain on *Talent acquisition SLA*
   (60% against a 90% target)
8. **Automation** — the Bot & AI Control Tower
9. **Analytics** — executive indicators and eight analytics products
10. Switch **Entity** in the top bar — every number on every screen changes

---

## Why the numbers hold together

The brief's central requirement was that figures relate to one another rather
than being plausible-looking noise. The whole dataset is therefore *derived*,
not authored:

```
rate card  ──►  volume(month) × rate  ──►  billing
     │                  │
     │                  └──►  KPI denominators, exception counts, bot workload
     │
     └──►  FTE(month) × rate per FTE  ──►  capacity charges
```

Concretely, and all verifiable via `npm run verify:data`:

- **Billing is never stated, only computed.** Every service's monthly fee is
  `Σ(volume × rate) + Σ(FTE × rate per FTE)`, for all 9 entities.
- **The same volume drives the KPIs.** The 10,240 invoices that produce ₹10.24 L
  of billing are the same 10,240 the 3.4% rejection rate is measured against
  (348 invoices), and the same ones behind the exception queue.
- **SLA is a real weighted roll-up.** Each service SLA is `Σ(component × weight)`
  over its named sub-services; the entity SLA is the billing-weighted average of
  those. That is why HR lands at 94.1% despite talent acquisition sitting at 60%
  — the decomposition is shown on screen.
- **The control tower reconciles to its invoice.** Bots in the tower = bots
  billed for. Σ bot transactions = transactions billed for. ROI = hours released
  × blended rate ÷ the automation fee. The fleet's *measured* success rate is
  what feeds the automation SLA component.
- **Analytics totals tie out.** Σ per-product reports = reports billed for;
  aero + non-aero revenue = total revenue.
- **Issues derive from performance.** Each issue is written against a specific
  KPI or SLA component, and the count scales with entity size and delivery
  quality.
- **Entity scale is one lever.** Changing an entity's `scale` re-prices volumes,
  FTEs, bots, balance sheet and issue counts coherently.
- **It is deterministic.** No `Math.random()` anywhere — variation comes from a
  seeded hash, so the demo tells the same story every run.

Reporting date is fixed at **30 Nov 2025**, eight months into FY 2026
(Apr 2025 – Mar 2026). That is what allows YTD actuals, a full-year forecast and
budget variance to coexist honestly.

---

## Architecture

```
src/
├── app/
│   ├── login/                    Sign-in with demo personas
│   └── (portal)/                 Auth-gated shell
│       ├── overview/             Executive dashboard
│       ├── services/             Service catalogue
│       │   └── [serviceId]/      Overview | Billing | KPI | Issues
│       ├── billing/              Billing analysis and charging model
│       ├── performance/          SLA, all KPIs, customer experience
│       ├── issues/               Issue register and feedback
│       ├── automation/           Bot & AI Control Tower
│       ├── analytics/            Analytics portfolio and executive indicators
│       └── portfolio/            Group scope: all entities compared
│
├── lib/
│   ├── api.ts                    ◄── THE INTEGRATION SEAM
│   ├── domain/types.ts               The contract the UI consumes
│   ├── format.ts                     Lakh/crore formatting, status grading
│   └── mock/
│       ├── calendar.ts               Indian fiscal calendar
│       ├── organisation.ts           Locations, entities, users, services
│       ├── rate-cards.ts             Rate cards, demand curves, SLA weights
│       ├── kpis.ts                   KPI definitions and targets
│       ├── issues.ts                 Issue and feedback banks
│       ├── automation-fleet.ts       Bot roster
│       ├── analytics-products.ts     Analytics products, financial baseline
│       └── engine.ts                 Derives everything from the above
│
├── components/
│   ├── ui/primitives.tsx         Cards, tiles, tables, status vocabulary
│   ├── charts/                   Hand-rolled SVG charts (no chart library)
│   └── portal/                   Shell, nav, blocks, drawers, export
│
├── state/session.tsx             Simulated session: identity + scope
└── scripts/verify-data.ts        The reconciliation assertions
```

### Replacing the mock data with real systems

**No page or component imports from `lib/mock/*`.** Everything goes through
`src/lib/api.ts`, whose function bodies are the only thing that needs to change:

| Function | Becomes |
|---|---|
| `authenticate()` | Identity provider / SSO |
| `getUserScope()` | Entitlements service |
| `getSnapshot()` | Composition API over S/4HANA, Ariba, HRMS, RPA control tower, warehouse |
| `getServiceDetail()` | The same, scoped to one service tower |
| `getPortfolio()` | Group roll-up endpoint |

The return types in `lib/domain/types.ts` are already the contract. If the real
sources are remote, make these `async` and `await` them in the pages — nothing
else moves. The conceptual system-of-record mapping is displayed in the UI
(Services → *Where this information will come from*) and lives in
`DATA_SOURCE_MAP`.

---

## Notable decisions

- **No charting library.** The dashboard needs a specific set of marks —
  actual-vs-forecast lines, budget overlays, bullet gauges against a target,
  stacked service columns — and one consistent visual language. The SVG
  components in `components/charts` measure their own container so strokes stay
  1px crisp at any width.
- **`@theme static` in `globals.css` is deliberate.** Service colours are
  consumed via `var(--color-svc-…)` in inline styles and `color-mix()`, which
  Tailwind v4's source scanner cannot see. Without `static` it tree-shakes them
  and the palette silently loses colours.
- **Tabular numerals everywhere.** Every figure in a finance product sits in a
  column; `font-variant-numeric: tabular-nums` keeps them aligned.
- **Download report actually works.** It generates a real CSV from the same
  snapshot the screens render, rather than being a dead button.

## What is deliberately not built

Per the brief: no real SAP/Ariba/HRMS/RPA integration, no real authentication,
no database, no production security. These are the things the architecture is
shaped to accept later, not things the prototype pretends to have.
