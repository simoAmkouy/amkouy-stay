# AMKOUY INTELLIGENCE — PHASE 0 ARCHITECTURE AUDIT

**Date:** 2026-08-14  
**Status:** READ-ONLY AUDIT — No files modified, no migrations created, no packages installed.  
**Auditor:** Claude Code (automated codebase inspection)

---

## 1. Executive Summary

AMKOUY Stay's Core is a mature, production-grade back-office for short-term rental management. It already stores everything AMKOUY Intelligence will need: reservations with nightly rates and channel attribution, payments with ledger entries, per-property expenses and cleaning costs, concierge services with revenue and cost, owner settlement data, and a full set of server-side RPCs that aggregate most of the required KPIs.

**Key finding:** Intelligence Phase 1 can be built as a **purely read-only analytical layer** that calls existing RPCs and queries. No new database tables are required in Phase 1. No existing Core files need to be modified except for adding a new tab entry in the navigation constants (low-risk).

The single largest gap is **forward-looking pricing intelligence**: the existing data is entirely historical. Demand scoring, price recommendations, and confidence levels require either a future DB view or a client-side computation layer. These are Phase 2+ concerns and require no schema change in Phase 1.

**Verdict: SAFE TO PROCEED**

---

## 2. Existing Core Architecture Relevant to Intelligence

### Application Stack
| Layer | Technology |
|---|---|
| Framework | Expo Router 56 + React Native Web |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth, RLS-enforced |
| Data access | `src/lib/queries/*.ts` — one file per entity, direct `supabase.from()` calls |
| State/caching | TanStack React Query v5 |
| Validation | Zod schemas in `src/lib/validation/*.ts` |
| Permissions | `ROLE_PERMISSIONS` matrix in `src/constants/permissions.ts` + Postgres RLS |

### Routing Structure
```
src/app/(tabs)/
├── dashboard.tsx          ← main home (all roles except owner/cleaner/technician/agent)
├── operations.tsx         ← Operations Center (1382 lines) — TARGET FOR INTELLIGENCE INTEGRATION
├── commercial-dashboard.tsx
├── portal.tsx             ← Owner Portal
├── tasks.tsx / tickets.tsx / leads.tsx / reservation-leads.tsx
```

Intelligence will eventually live as a new tab (`/intelligence`) and as a panel inside `/operations`.

### Data Flow Pattern (Core)
```
Supabase DB (RLS)
  → src/lib/queries/*.ts        (raw Supabase calls + error handling + activity logging)
  → src/hooks/use-*.ts          (React Query wrappers: useQuery / useMutation)
  → src/app/(tabs)/*.tsx        (screens compose hooks)
  → src/components/**           (UI components, pure presentational)
```

Intelligence must follow the same pattern exactly:
```
Existing Supabase RPCs / tables (READ ONLY)
  → src/lib/queries/intelligence.ts     (new, read-only, calls existing RPCs)
  → src/hooks/use-intelligence.ts       (new, React Query wrappers)
  → src/app/(tabs)/intelligence.tsx     (new screen)
  → src/components/intelligence/**      (new UI components)
```

---

## 3. Existing Data Sources

### 3.1 Properties
**Table:** `properties`  
**Key fields for Intelligence:**
- `id`, `name`, `city`, `base_nightly_rate`, `cleaning_fee`, `min_stay_nights`, `status`, `bedrooms`, `max_guests`, `date_activated`

**Ownership:** `property_owners` junction — `ownership_pct`, `is_primary`  
**Contracts:** `contracts` — `commission_pct`, `start_date`, `end_date`, `status`, `payout_schedule`

**Already available:** `listProperties()` with primary owner join; `listPropertyAggregates()` for trailing 90-day occupancy and all-time revenue.

### 3.2 Reservations
**Table:** `reservations`  
**Key fields for Intelligence:**
- `check_in_date`, `check_out_date`, `nights`, `nightly_rate`, `total_amount`, `cleaning_fee_amount`, `channel_commission_amount`, `status`, `cancellation_reason`, `cancelled_at`, `channel_id`
- Joined: `channel:channels(id, name, code)`

**Status enum:** `pending | confirmed | checked_in | checked_out | completed | cancelled | no_show`  
**Terminal statuses:** `cancelled`, `no_show` — excluded from revenue but available for cancellation analysis.

### 3.3 Booking Channels
**Table:** `channels`  
**Key fields:** `id`, `code`, `name`, `default_commission_pct`  
Every reservation has `channel_id` + `channel_commission_amount`. Channel breakdown is fully queryable from existing data.

### 3.4 Payments / Revenue
**Table:** `payments` — guest-facing cash movements (`deposit_hold`, `charge`, `refund`, `deposit_release`)  
**Table:** `ledger_entries` — insert-only, DB-trigger-written, the authoritative financial record  
**RPCs:** `get_reservation_payment_summary`, `get_payments_overview`, `get_outstanding_reservations`

### 3.5 Expenses / Costs
**Table:** `expenses` — `category`, `amount`, `expense_date`, `property_id`, `reservation_id`, `reimbursable_to_owner`  
**Table:** `cleaning_tasks` — `cost_amount`, `scheduled_date`, `property_id`  
**Table:** `maintenance_tickets` — `estimated_cost`, `actual_cost`, `property_id`

### 3.6 Concierge Services
**Table:** `reservation_services`  
**Key fields:** `unit_price`, `total_price`, `cost_amount`, `profit` (generated column), `amount_paid`, `status`, `service_id`  
**Table:** `services` — service catalog with `category`, `default_price`, `default_cost`

### 3.7 Owner Settlements
**Table:** `owner_payments` — `gross_revenue`, `net_revenue`, `total_expenses`, `commission_amount`, `net_amount`, `period_start`, `period_end`, `status`  
**RPC:** `compute_owner_settlement` — authoritative computation per property per period

### 3.8 Calendar / Availability
**Queries in `portfolio-calendar.ts`:** month-windowed reservation overlap query for all properties. Supplies `CalendarReservationBlock[]` per property with `startCol`, `spanCols` for the visual calendar.

**Important distinction:**
- Calendar occupancy = day-set of unique occupied days (visual, check-in-date-attributed)
- Report occupancy = `occupied_nights / (daysInRange × activeProperties)` (prorated, stay-overlap)
- Intelligence must use the **report formula** for consistency with `report_portfolio_summary`

---

## 4. Existing Queries That Intelligence Can Reuse Directly

| Existing Query / RPC | What Intelligence Gets From It |
|---|---|
| `report_portfolio_summary(start, end)` | total_revenue, total_net_revenue, total_concierge_revenue, total_profit, occupancy_rate, adr, avg_stay, cancelled_reservations, total_nights |
| `report_property_performance(start, end)` | Per-property: revenue, profit, occupancy_rate, adr, avg_stay, reservations_count, cancelled_count, concierge_revenue |
| `report_portfolio_timeline(start, end)` | Month-by-month: revenue, concierge_revenue, profit, reservations_count, nights |
| `report_owner_statement(ownerId, range)` | owner_share, amkouy_share, commission_pct, occupancy_rate, concierge_revenue, net_revenue |
| `get_payments_overview(start, end)` | collection_rate, avg_collection_delay_days, deposits_missing_count, balance_overdue_count |
| `getExpenseCategoryBreakdown(range)` | Expense breakdown by category |
| `listReservations({ statuses, dateRange })` | Raw reservation list for ADR calculation, LOS, channel breakdown, cancellation rates |
| `listChannels()` | Channel names for booking source breakdown |
| `listPropertyAggregates()` | Trailing 90-day occupancy + all-time revenue per property |
| `computeOwnerSettlement(propertyId, start, end)` | AMKOUY earning per property per period |

**No new queries are needed for Phase 1.** All five executive KPIs proposed below can be computed from existing RPC outputs.

---

## 5. Existing KPIs Already Available

The following KPIs are **already computed by existing RPCs** and can be surfaced immediately:

| KPI | Source RPC / Query | Field Name |
|---|---|---|
| Portfolio Revenue | `report_portfolio_summary` | `total_net_revenue` |
| Portfolio Occupancy Rate | `report_portfolio_summary` | `occupancy_rate` |
| ADR (Average Daily Rate) | `report_portfolio_summary` | `adr` |
| Average Length of Stay | `report_portfolio_summary` | `avg_stay` |
| Total Concierge Revenue | `report_portfolio_summary` | `total_concierge_revenue` |
| Total AMKOUY Profit | `report_portfolio_summary` | `total_profit` |
| Per-property Occupancy | `report_property_performance` | `occupancy_rate` per row |
| Per-property ADR | `report_property_performance` | `adr` per row |
| Per-property Profit | `report_property_performance` | `profit` per row |
| Cancellation Count | `report_portfolio_summary` | `cancelled_reservations` |
| Month-by-month trend | `report_portfolio_timeline` | full timeline array |
| AMKOUY Share | `report_owner_statement` | `amkouy_share` |
| Owner Share | `report_owner_statement` | `owner_share` |
| Outstanding Balances | `get_payments_overview` | `total_outstanding` |
| Collection Rate | `get_payments_overview` | `collection_rate` |

**Already computed client-side** in `dashboard-metrics.ts` (can be reused by Intelligence without re-querying):
`revenueTotal`, `occupancyRate`, `averageDailyRate`, `profit`, `revenueConcierge`, `checkIns`, `checkOuts`, `conciergeCost`, `conciergeProfit`

---

## 6. Missing Data (Not Yet in Core)

| Missing | Why Needed | Severity |
|---|---|---|
| RevPAN per property | `total_revenue / totalNightsAvailable` — denominator (available nights) requires knowing the property's `date_activated` and counting non-blocked nights. `date_activated` exists on `properties` but available-nights calculation is not in any RPC. | Medium — can be approximated as `revenue / daysInRange` for Phase 1 |
| Booking lead time | Days between `created_at` and `check_in_date` on `reservations`. `created_at` exists on reservations but no RPC computes avg lead time. | Low — can be computed client-side from raw reservation list |
| Day-of-week demand patterns | Need reservation aggregation by `EXTRACT(DOW FROM check_in_date)`. Not in any RPC. | Low — Phase 2 |
| Future pricing recommendations | No price suggestion system exists. Would require a demand model. | High complexity — Phase 3+ |
| Booking pace | Reservations made in rolling windows vs. prior period. No RPC. | Phase 2 |
| Seasonal demand index | Requires multi-year historical aggregation. Only as old as the app. | Phase 3 |
| Confidence level on recommendations | Requires ML/statistical model. | Phase 3+ |
| Property-level available nights | Blocked nights (maintenance, owner stays) not tracked as availability blocks. | Phase 2 — requires new `availability_blocks` concept or blocked-dates tracking |

---

## 7. Property-Level Intelligence Data Model Proposal

### Phase 1 — Fully Derived from Existing Tables

No new tables. Intelligence reads:
- `report_property_performance(start, end)` → all per-property KPIs
- `listReservations({ statuses: ['confirmed','checked_in','checked_out','completed'], dateRange })` → raw data for LOS histogram, channel breakdown, lead time
- `listOwnerAggregates()` → all-time revenue per property

### Phase 2 — Optional Analytical View (Not a New Operational Table)

A Postgres **view** (not a table — no data ownership concerns):

```sql
-- Proposed view name: v_property_intelligence_snapshot
-- NOT to be created in Phase 1
CREATE VIEW v_property_intelligence_snapshot AS
SELECT
  p.id AS property_id,
  p.name,
  p.base_nightly_rate,
  p.min_stay_nights,
  p.date_activated,
  EXTRACT(DAYS FROM NOW() - p.date_activated) AS days_active,
  -- trailing 12-month metrics (aggregated from reservations)
  COUNT(r.id) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS reservations_12m,
  SUM(r.nights) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS nights_12m,
  AVG(r.nightly_rate) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS adr_12m,
  AVG(r.nights) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS avg_los_12m,
  COUNT(r.id) FILTER (WHERE r.status IN ('cancelled','no_show')) AS cancellations_12m,
  SUM(r.total_amount) FILTER (WHERE r.status NOT IN ('cancelled','no_show')) AS revenue_12m
FROM properties p
LEFT JOIN reservations r ON r.property_id = p.id
  AND r.deleted_at IS NULL
  AND r.check_in_date >= NOW() - INTERVAL '12 months'
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.base_nightly_rate, p.min_stay_nights, p.date_activated;
```

**Why a view, not a table:** A view has no data lifecycle to manage, no migration risk, no RLS to define (it inherits RLS from the underlying tables), and always reflects live data. It cannot become a "second source of truth."

**Why not in Phase 1:** Existing `report_property_performance` RPC already returns the same aggregates for a user-selected period. Phase 1 uses the RPC.

### Phase 3 — Materialized View (Only If Performance Demands It)

If Phase 2 views become slow at portfolio scale (>50 properties), promote to `MATERIALIZED VIEW` with a scheduled `REFRESH`. This is a pure infrastructure decision — no application logic changes.

---

## 8. Pricing Intelligence Proposal

### Phase 1 — Historical Price Analysis (No New Infrastructure)

From `listReservations` + `report_property_performance`, Intelligence can show:
- ADR trend month-over-month (already in `report_portfolio_timeline`)
- Per-property ADR vs. `base_nightly_rate` (gap analysis — is the property under/over its base?)
- Best-performing months by ADR (from timeline data)
- Rate consistency: std-dev of `nightly_rate` across reservations (client-computed)

### Phase 2 — Rule-Based Price Suggestions (New Read-Only Computation)

A new file `src/lib/intelligence/pricing.ts` (pure TypeScript, no DB access) implementing:

```typescript
type PricingSuggestion = {
  propertyId: string;
  targetDate: string;        // ISO date (future night)
  currentBaseRate: number;   // from properties.base_nightly_rate
  suggestedRate: number;     // computed
  changeDirection: 'increase' | 'decrease' | 'hold';
  changePct: number;
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  confidenceLevel: 'low' | 'medium' | 'high';
  reasons: string[];         // human-readable explanations
};
```

Rule inputs:
- Occupancy in the trailing 30/60/90-day window (from existing RPCs)
- Day-of-week pattern (computed client-side from reservation list)
- Month-of-year seasonality (from `report_portfolio_timeline` over prior years)
- Upcoming confirmed reservations in the target window (from `listReservations`)

**No DB write.** Suggestions are displayed with a human approval step before any Core price field is touched.

### Phase 3 — Human-Approved Price Update Flow

When a manager approves a suggestion:
```
Intelligence suggestion
  → Manager reviews and approves in UI
  → Calls existing updateProperty(id, { base_nightly_rate: suggestedRate })
  → Core owns the change; activity log captures it
  → Intelligence has NO direct write path to prices
```

This reuses the existing `updateProperty` mutation with its existing validation, activity logging, and RLS. Intelligence contributes only the suggested value.

---

## 9. Demand Intelligence Proposal

### Phase 1 — Derived from Existing Reservation History

All computable from `listReservations` (full historical dataset, no date filter):

| Signal | Computation |
|---|---|
| Occupancy by month | Group `nights` by `check_in_date` month, divide by available nights |
| Occupancy by day-of-week | Group by `DAYOFWEEK(check_in_date)` client-side |
| Average LOS | `AVG(nights)` per month |
| Booking lead time | `AVG(DATEDIFF(check_in_date, created_at))` client-side |
| Cancellation rate | `cancelled / total` per month |
| Channel mix | Group by `channel.name` — already joined in `ReservationWithRelations` |

### Phase 2 — Demand Calendar (Future Nights)

A new UI component showing a 90-day forward calendar where each date is color-coded by predicted demand level, derived from historical day-of-week + month-of-year patterns.

No new DB data. The model lives in `src/lib/intelligence/demand.ts` (pure TypeScript).

### Phase 3 — External Signals

Local events, school holidays, public holidays (Morocco). Would require either a third-party API or a manually maintained `intelligence_events` table. **Out of scope until Phase 2 validation.**

---

## 10. Business / Concierge Intelligence Proposal

### Already Available from Existing RPCs

| Business KPI | Source |
|---|---|
| AMKOUY total earning | `report_portfolio_summary.total_profit` |
| AMKOUY earning from rentals | `amkouy_share` per property from `report_owner_statement` |
| AMKOUY earning from concierge | `total_concierge_revenue - concierge_costs` (from `report_portfolio_summary`) |
| Revenue by property | `report_property_performance` per row |
| Profit by property | `report_property_performance.profit` per row |
| Concierge revenue by property | `report_property_performance.concierge_revenue` per row |
| Top services | `getTopServicesAndProvidersInRange` (already called in `getPortfolioReport`) |
| Top providers | Same source |
| Period-over-period comparison | `getPortfolioReport(range, previousRange)` already computes `bestByRevenue`, `worstByRevenue`, `fastestGrowing` |

**The existing `reports.ts` + `use-reports.ts` already does most of what Business Intelligence needs.** Intelligence Phase 1 surfaces this data in a new dedicated view, not a new computation.

---

## 11. Centre d'Opérations Integration Proposal

### Current `operations.tsx` Structure (1382 lines)

The page already contains panels for:
1. Alert Center (risks, anomalies)
2. Arrivals / Departures
3. Occupancy Control
4. Cleaning Panel
5. Maintenance Panel
6. Concierge Panel
7. Owner Payments Panel
8. Contracts Panel
9. Team Workload
10. Risk Center
11. Performance Insights (`computePerformanceInsights`)
12. Business Health Score (`computeBusinessHealthScore`)

### Existing "Performance Insights" Panel

`computePerformanceInsights` in `operations-center.ts` already computes:
- `occupancyRate`, `avgDailyRate`, `revenueGrowthPct`, `profitMarginPct`, `collectionRate`, `avgBookingLeadTimeDays`, `cancellationRate`
- Categorized into `positive[]`, `warnings[]`, `critical[]` arrays

**This is the primary integration point for Intelligence in the Operations page.**  
Phase 1 adds an "Intelligence" collapsible section beneath "Performance Insights" in the existing panel layout — no redesign of the page.

### Safe Insertion Point

```
operations.tsx currently renders:
  ...
  <PerformanceInsightsPanel />     ← EXISTING (do not touch)
  <BusinessHealthPanel />          ← EXISTING (do not touch)
  <IntelligencePanel />            ← NEW: renders intelligence recommendations
                                      only if user has 'intelligence' permission
  ...
```

The `<IntelligencePanel>` is a new component in `src/components/intelligence/` — it imports only from new Intelligence hooks. It does not modify any existing component.

---

## 12. KPI Proposal

### Executive Dashboard — 5 Primary KPIs (Phase 1)

| KPI | Definition | Source | Tooltip Required |
|---|---|---|---|
| **RevPAN** | Revenue per Available Night = `total_net_revenue / (daysInRange × activeProperties)` | `report_portfolio_summary` | Yes |
| **ADR** | Average Daily Rate = `total_net_revenue / total_nights` | `report_portfolio_summary.adr` | Yes |
| **Occupancy Rate** | `occupied_nights / (daysInRange × activeProperties) × 100` | `report_portfolio_summary.occupancy_rate` | Yes |
| **AMKOUY Profit** | Net revenue after owner payouts, expenses, cleaning, maintenance | `report_portfolio_summary.total_profit` | Yes |
| **Concierge Revenue** | Total from reservation_services (active, delivered) | `report_portfolio_summary.total_concierge_revenue` | Yes |

### Recommended Actions — 3–5 Per Period (Phase 1)

Generated client-side from thresholds applied to existing data:

| Action Type | Trigger Condition | Source Field |
|---|---|---|
| Collection warning | `overdue_balance_count > 0` | `get_payments_overview.balance_overdue_count` |
| Low occupancy alert | `occupancy_rate < 60%` for any property | `report_property_performance.occupancy_rate` |
| Underperforming property | Property revenue < 50% of portfolio average | `report_property_performance.revenue` |
| Concierge opportunity | Property with 0 concierge revenue + >3 reservations | `report_property_performance` cross-reference |
| Rate review suggested | Property ADR < `base_nightly_rate × 0.9` | `report_property_performance.adr` vs `properties.base_nightly_rate` |

---

## 13. Tooltip Definitions (KPI Glossary)

Every KPI in the Intelligence UI must display an information tooltip (ⓘ icon). Required content:

### ADR — Average Daily Rate / Prix Moyen par Nuit
- **What:** Average revenue earned per occupied night across selected properties and period.
- **Formula:** `Total rental revenue ÷ Total occupied nights`
- **Why it matters:** Core pricing health indicator. Rising ADR with stable occupancy = pricing power. Falling ADR = may need rate review or channel review.
- **French:** Prix Moyen par Nuit (PMN)

### RevPAN — Revenue per Available Night / Revenu par Nuit Disponible
- **What:** Revenue generated per night the property *could* have been rented (occupied + vacant).
- **Formula:** `Total rental revenue ÷ (Days in period × Number of active properties)`
- **Why it matters:** Combines price AND occupancy into one number. Two properties can have the same ADR but very different RevPAN if one sits empty more. The best single performance metric for a rental portfolio.
- **French:** Revenu par Nuit Disponible (RND)

### Occupancy Rate / Taux d'Occupation
- **What:** Percentage of available nights that were actually occupied.
- **Formula:** `Occupied nights ÷ (Days in period × Active properties) × 100`
- **Why it matters:** Low occupancy = unsold inventory (lost revenue). High occupancy consistently = may support a rate increase.
- **French:** Taux d'Occupation

### LOS — Length of Stay / Durée Moyenne du Séjour
- **What:** Average number of nights per reservation.
- **Formula:** `Sum of all reservation nights ÷ Number of reservations`
- **Why it matters:** Longer stays reduce cleaning and turnover cost per night. Short average LOS may suggest raising the minimum stay setting.
- **French:** Durée Moyenne du Séjour (DMS)

### Booking Pace / Vitesse de Réservation
- **What:** Rate at which future nights are being booked compared to the same period last year.
- **Formula:** `Confirmed reservations for next 30 days (this year) ÷ Confirmed reservations for next 30 days (last year)`
- **Why it matters:** Faster booking pace than prior year = demand is strong, consider a rate increase. Slower pace = may need promotions or rate reduction.
- **French:** Vitesse de Réservation

### Lead Time / Délai de Réservation
- **What:** Average number of days between a reservation being made and the check-in date.
- **Formula:** `Average of (check_in_date − reservation created_at)` in days
- **Why it matters:** Short lead times (< 7 days) = last-minute demand — could capture with last-minute pricing. Long lead times (> 60 days) = guests plan far ahead — support advance purchase discounts.
- **French:** Délai de Réservation Moyen

### Cancellation Rate / Taux d'Annulation
- **What:** Percentage of reservations that were cancelled or marked no-show.
- **Formula:** `(Cancelled + No-show reservations) ÷ Total reservations × 100`
- **Why it matters:** High cancellation rate erodes effective occupancy. May indicate channel-specific issues or overly flexible cancellation policies.
- **French:** Taux d'Annulation

### AMKOUY Profit / Bénéfice AMKOUY
- **What:** Net income retained by AMKOUY after paying owners, expenses, cleaning, and maintenance.
- **Formula:** `Total revenue − Owner payouts − Cleaning costs − Maintenance costs − Expenses`
- **Why it matters:** The bottom line for AMKOUY Stay as a business. Tracks true profitability, not just revenue collected.
- **French:** Bénéfice Net AMKOUY

---

## 14. Recommended Architecture

### Folder Structure (New Files Only)

```
src/
├── lib/
│   ├── intelligence/
│   │   ├── kpis.ts          ← pure functions: compute Intelligence KPIs from existing RPC output
│   │   ├── actions.ts       ← pure functions: derive recommended actions from KPI thresholds
│   │   ├── demand.ts        ← pure functions: day-of-week / monthly demand patterns (Phase 2)
│   │   └── pricing.ts       ← pure functions: rule-based price suggestions (Phase 2)
│   └── queries/
│       └── intelligence.ts  ← READ-ONLY queries; only calls existing RPCs and hooks
├── hooks/
│   └── use-intelligence.ts  ← React Query wrappers for intelligence queries
├── components/
│   └── intelligence/
│       ├── IntelligencePanel.tsx      ← main collapsible panel for /operations
│       ├── KpiCard.tsx                ← single KPI with ⓘ tooltip
│       ├── KpiTooltip.tsx             ← tooltip overlay component
│       ├── ActionCard.tsx             ← single recommended action card
│       ├── PropertyRanking.tsx        ← sorted table of properties by KPI
│       └── TrendSparkline.tsx         ← mini chart for month-over-month trend
└── app/
    └── (tabs)/
        └── intelligence.tsx           ← new dedicated Intelligence tab (Phase 1b)
```

### Data Flow (Intelligence — Read Only)

```
Existing Supabase RPCs
  ├── report_portfolio_summary      ─┐
  ├── report_property_performance    ├─→ src/lib/queries/intelligence.ts
  ├── report_portfolio_timeline      │     (read-only, no mutations)
  └── listReservations               ┘
         ↓
  src/lib/intelligence/kpis.ts
  src/lib/intelligence/actions.ts
         ↓
  src/hooks/use-intelligence.ts
  (React Query, staleTime: 5 min, cacheTime: 30 min)
         ↓
  src/components/intelligence/**
         ↓
  src/app/(tabs)/intelligence.tsx
  src/app/(tabs)/operations.tsx  ← IntelligencePanel inserted here (no redesign)
```

### Intelligence Query File Contract

`src/lib/queries/intelligence.ts` must:
- Call only existing RPCs or existing query functions
- Never call `supabase.from('reservations').update(...)` or any mutation
- Never call `createReservation`, `updateReservation`, `updateProperty`, or any Core mutation
- Export only `async function get*` — no `create*`, `update*`, `delete*`

This is enforced by code review, not by TypeScript (TypeScript cannot prevent read vs write intent on a Supabase client).

---

## 15. Core vs Intelligence Data Ownership

| Data | Owner | Intelligence Role |
|---|---|---|
| Properties | **Core** | Read only |
| Reservations | **Core** | Read only |
| Payments / Ledger | **Core** | Read only |
| Owner Settlements | **Core** | Read only |
| Expenses | **Core** | Read only |
| Cleaning Tasks | **Core** | Read only |
| Maintenance Tickets | **Core** | Read only |
| Concierge Services | **Core** | Read only |
| Channels | **Core** | Read only |
| Contracts | **Core** | Read only |
| KPI Computations | **Intelligence** | Source of truth for derived metrics |
| Price Suggestions | **Intelligence** | Source of truth (never auto-applied) |
| Demand Scores | **Intelligence** | Source of truth (client-computed) |
| Recommended Actions | **Intelligence** | Source of truth (client-computed) |

**Rule:** Intelligence has no INSERT, UPDATE, or DELETE path to any Core table. The only write operation Intelligence will ever trigger is calling the existing `updateProperty` mutation with manager approval — and only in Phase 3.

---

## 16. Security / RLS Considerations

### Existing RLS Functions (Already Enforced)
```sql
is_admin()           → super_admin, admin
is_staff()           → super_admin, admin, manager, accountant
is_finance()         → super_admin, admin, accountant
is_commercial_agent()→ commercial_agent
owns_property(id)    → owner (scoped to their properties)
owns_reservation(id) → owner (scoped to their reservations)
current_user_role()  → returns user_role for current session
```

### Intelligence Permission Model

**Proposed new `Resource`:** `'intelligence'`

Access matrix (to be added to `permissions.ts` only):
```typescript
intelligence: ['super_admin', 'admin', 'manager', 'accountant']
```

- `owner` role: **NO access** — Intelligence may reveal cross-portfolio data they should not see
- `cleaner`, `technician`, `commercial_agent`: **NO access** — irrelevant to their roles
- `manager`: **YES** — operational intelligence is core to their role
- `accountant`: **YES** — financial intelligence and KPIs
- `admin` / `super_admin`: **YES** — full access

**No new RLS policies needed for Phase 1** because Intelligence only calls existing RPCs (which already enforce RLS server-side). The `'intelligence'` Resource is a UI-level gate in `ROLE_PERMISSIONS` — the underlying queries already restrict data by role at the database level.

### Revenue Data Sensitivity

`report_portfolio_summary` and `report_property_performance` include cross-property revenue. These RPCs are already restricted by RLS (staff/finance only). Intelligence inherits this restriction without any additional configuration.

---

## 17. High-Risk Files — MUST NOT BE TOUCHED During Intelligence Implementation

These files are Core operational logic. A bug here affects production reservations, payments, and owner settlements.

| File | Risk | Why |
|---|---|---|
| `src/lib/queries/reservations.ts` | **CRITICAL** | Reservation CRUD, double-booking prevention, status transitions |
| `src/lib/queries/payments.ts` | **CRITICAL** | Financial ledger, refund logic, payment summary RPCs |
| `src/lib/queries/owner-payments.ts` | **CRITICAL** | Owner settlement generation, financial freeze trigger |
| `src/lib/queries/reservation-services.ts` | **HIGH** | Concierge state machine, refund architecture |
| `src/lib/validation/reservation.ts` | **HIGH** | `RESERVATION_STATUS_TRANSITIONS` — changing this breaks status guard |
| `src/lib/validation/payment.ts` | **HIGH** | Payment amount validation against net collected |
| `src/lib/queries/reports.ts` | **MEDIUM-HIGH** | RPC wrappers; safe to READ but must not add mutations |
| `src/lib/queries/portfolio-calendar.ts` | **MEDIUM** | Calendar data source — don't add write operations |
| `src/app/(tabs)/operations.tsx` | **MEDIUM** | 1382-line Operations Center — Intelligence adds ONE panel at the bottom only |
| `src/app/(tabs)/dashboard.tsx` | **MEDIUM** | Main dashboard — Intelligence does not modify this |
| `src/types/supabase.ts` | **MEDIUM** | Generated file — never manually edit; re-generate only via CLI |
| `metro.config.js` | **MEDIUM** | jsPDF resolver override — do not change without understanding AMD issue |
| `src/lib/export/pdf.web.ts` | **LOW-MEDIUM** | Web PDF generation — don't touch during Intelligence work |
| All `src/lib/validation/*.ts` | **MEDIUM** | Zod schemas; changes here affect form validation across the app |
| `src/constants/permissions.ts` | **LOW-MEDIUM** | Adding `'intelligence'` resource is safe; changing existing role permissions is not |

---

## 18. Low-Risk Extension Points

These files can be safely added to or minimally modified:

| File / Location | Change Needed | Risk |
|---|---|---|
| `src/constants/permissions.ts` | Add `'intelligence'` to `Resource` union + `ROLE_PERMISSIONS` | **LOW** — additive only |
| `src/constants/role-navigation.ts` | Add Intelligence tab to `super_admin / admin / manager / accountant` tabs | **LOW** — additive only |
| `src/app/(tabs)/_layout.tsx` | Register new `intelligence` tab route | **LOW** — additive |
| `src/app/(tabs)/operations.tsx` | Append `<IntelligencePanel />` at bottom of scroll view | **LOW** — no existing logic touched |
| `src/hooks/use-date-filter.tsx` | Intelligence reuses this hook unchanged | **NONE** — no modification |
| `src/hooks/use-reports.ts` | Intelligence can import and call `usePortfolioReport`, `usePortfolioSummary` | **NONE** — read only |
| `src/utils/format.ts` | Intelligence uses `formatMAD`, `formatDate` unchanged | **NONE** |
| `src/components/amkouy/**` | Intelligence uses existing design system components unchanged | **NONE** |

**New files only (zero modification to existing files except the 4 additive changes above):**
- `src/lib/intelligence/kpis.ts`
- `src/lib/intelligence/actions.ts`
- `src/lib/queries/intelligence.ts`
- `src/hooks/use-intelligence.ts`
- `src/components/intelligence/IntelligencePanel.tsx`
- `src/components/intelligence/KpiCard.tsx`
- `src/components/intelligence/KpiTooltip.tsx`
- `src/components/intelligence/ActionCard.tsx`
- `src/app/(tabs)/intelligence.tsx`

---

## 19. Proposed Implementation Phases

### Phase 1 — Historical Intelligence (READ ONLY, No New DB Objects)
**Goal:** Surface existing KPIs in a new Intelligence view with tooltips and recommended actions.

1. Add `'intelligence'` resource to `permissions.ts` (3 lines)
2. Add Intelligence tab to role navigation (3 lines)
3. Create `src/lib/queries/intelligence.ts` — calls existing RPCs only
4. Create `src/lib/intelligence/kpis.ts` — pure KPI computation functions
5. Create `src/lib/intelligence/actions.ts` — threshold-based recommended actions
6. Create `src/hooks/use-intelligence.ts` — React Query wrappers
7. Create `src/components/intelligence/` — KpiCard, KpiTooltip, ActionCard, PropertyRanking
8. Create `src/app/(tabs)/intelligence.tsx` — new screen
9. Append `<IntelligencePanel />` to `operations.tsx` (2 lines added at bottom)
10. Run `npx tsc --noEmit` + `npm run build`

**Database changes:** None.  
**Package changes:** None (charts via existing SVG or a Phase 1b addition).

### Phase 2 — Demand Patterns + Lead Time Analysis
**Goal:** Add day-of-week and monthly demand heatmap; compute booking lead time and booking pace.

- New `src/lib/intelligence/demand.ts` (pure TypeScript, no DB)
- Optional: Postgres view `v_property_intelligence_snapshot` (read-only, no RLS change)
- Chart components for demand visualization

**Database changes:** 1 optional read-only view (no new tables, no RLS).

### Phase 3 — Pricing Recommendations (Human-Approved)
**Goal:** Rule-based price suggestions with manager approval workflow.

- New `src/lib/intelligence/pricing.ts`
- Suggestion UI with approve/reject per recommendation
- On approval: calls existing `updateProperty(id, { base_nightly_rate })` — no new mutation

**Database changes:** None. Core `updateProperty` is reused.

### Phase 4 — Predictive Intelligence
**Goal:** Forward-looking occupancy and revenue forecasts using historical trend extrapolation.

- Requires 12+ months of historical data in Core
- May introduce a `materialized view` for performance
- Seasonal index computation

**Database changes:** 1 optional materialized view, scheduled refresh.

---

## 20. Risks and Safeguards

| Risk | Likelihood | Mitigation |
|---|---|---|
| Intelligence query accidentally calling a mutation | Low | Code review; `intelligence.ts` exports only `get*` functions |
| Double-counting revenue (accommodation + services) | Medium | Explicitly use `report_portfolio_summary` RPCs which already delineate; document formula sources in `kpis.ts` with references to `KPI_REGISTRY.md` |
| Intelligence occupancy formula diverging from Core formula | Medium | Always call `report_portfolio_summary.occupancy_rate` — never re-implement the formula in `kpis.ts` |
| Calendar occupancy (day-set) vs Report occupancy (prorated) confusion | Medium | Document in `kpis.ts`: "use `report_portfolio_summary`, not `buildPortfolioCalendarData`" |
| RLS bypass via Intelligence queries | Low | Intelligence calls existing RPCs which already enforce RLS; no direct table access added |
| Operations.tsx becoming too long | Low | `<IntelligencePanel>` is a self-contained component; only 2 lines added to `operations.tsx` |
| Intelligence tab visible to owners/cleaners | Low | `'intelligence'` Resource gates the tab; owner role excluded from matrix |
| KPI formula inconsistency between Intelligence and Portal | Medium | Intelligence reuses `usePortfolioReport` / `useOwnerStatement` hooks — same source |
| Phase 3 price suggestion auto-applied without approval | Very Low | Architecture requires explicit manager button press → `updateProperty`; no automation |

---

## 21. Exact Files Modified in Phase 1

| File | Type of Change | Lines Changed (est.) |
|---|---|---|
| `src/constants/permissions.ts` | Add `'intelligence'` to `Resource` union + 4 role entries | ~8 lines added |
| `src/constants/role-navigation.ts` | Add `intelligence` tab for admin/manager/accountant | ~6 lines added |
| `src/app/(tabs)/_layout.tsx` | Register new tab route | ~4 lines added |
| `src/app/(tabs)/operations.tsx` | Import + render `<IntelligencePanel />` at bottom | ~3 lines added |

**All other Phase 1 work is new files only.**

---

## 22. Exact Database Objects Introduced (If Any)

### Phase 1
**None.** Zero new tables, views, RPCs, triggers, or indexes.

### Phase 2 (Proposed, Not Decided)
| Object | Type | Purpose | RLS Impact |
|---|---|---|---|
| `v_property_intelligence_snapshot` | VIEW | Pre-aggregate trailing 12-month KPIs per property | None — inherits RLS from `properties` and `reservations` |

### Phase 3 (Proposed, Not Decided)
No new DB objects. Reuses existing `updateProperty` path.

### Phase 4 (Proposed, Not Decided)
| Object | Type | Purpose | RLS Impact |
|---|---|---|---|
| `mv_property_monthly_metrics` | MATERIALIZED VIEW | Performance: pre-aggregated monthly stats for fast dashboard loads | None — inherits base table RLS |
| Scheduled `pg_cron` job | Cron | Refresh `mv_property_monthly_metrics` nightly | None |

---

## 23. Verification / Testing Strategy

### For Each Phase 1 File

| File | Verification Method |
|---|---|
| `permissions.ts` change | `npx tsc --noEmit` (type-checks `Resource` union across all callers) |
| `role-navigation.ts` change | `npx tsc --noEmit` |
| `intelligence.ts` query file | TypeScript: all return types match existing RPC output types |
| `kpis.ts` computation | Unit-testable pure functions (input → output, no Supabase); verify against known values from existing dashboard |
| `use-intelligence.ts` | React Query wrappers; verify `staleTime` and `cacheTime` match other report hooks |
| `intelligence.tsx` screen | Visual check in browser dev server; verify data matches `dashboard.tsx` numbers for same date range |
| `operations.tsx` change | Verify existing Operations Center panels are pixel-identical before and after; `<IntelligencePanel>` appears only at the bottom |

### Cross-Validation Rule
After Phase 1 ships, verify that:
- `IntelligencePanel.occupancyRate` === `DashboardMetrics.occupancyRate` for the same date range
- `IntelligencePanel.adr` === `PortfolioSummary.adr` for the same date range
- `IntelligencePanel.totalProfit` === `DashboardMetrics.profit` for the same date range

Any divergence = formula inconsistency → fix by aligning Intelligence to use the same RPC output, not by changing the Core formula.

### Build Verification
After Phase 1 implementation:
```
npx tsc --noEmit   → 0 errors required
npm run build      → exit 0 required
```

---

## PHASE 0 RESULT

**SAFE TO PROCEED**

### Summary of Findings

1. **The existing Core already contains every data source Intelligence needs for Phases 1 and 2.** No new tables, views, or migrations are required for Phase 1.

2. **Existing RPCs (`report_portfolio_summary`, `report_property_performance`, `report_portfolio_timeline`) already compute ADR, occupancy rate, average LOS, concierge revenue, and AMKOUY profit.** Intelligence Phase 1 is primarily a new presentation layer over data that already exists.

3. **The operations.tsx page already contains a `computePerformanceInsights` function** that computes occupancy rate, ADR, revenue growth, cancellation rate, and lead time. Intelligence integration into that page is additive — one new panel at the bottom.

4. **Four files need minor additive changes** (permissions, navigation, layout, operations bottom). All other Phase 1 work is new files only. No existing logic is touched.

5. **The highest-risk files** (`reservations.ts`, `payments.ts`, `owner-payments.ts`) are **not modified in any phase** of Intelligence implementation.

6. **Pricing suggestions (Phase 3) are isolated behind a human approval step** that calls the existing `updateProperty` mutation — Intelligence has no autonomous write path to Core data.

### Pre-Conditions for Phase 1 Start
- [ ] Confirm `KPI_REGISTRY.md` formulas are available (file referenced in CLAUDE.md but absent from disk — reconstruct or confirm formulas from RPC source)
- [ ] Confirm `DATABASE_SCHEMA_V2.md` is available (same situation — needed for RLS policy detail)
- [ ] Decide which chart library to use for sparklines/trend charts (no charting library currently installed; options: `react-native-svg` already installed, or a dedicated chart library as a new dependency)
- [ ] Define the Intelligence tab icon and label for the navigation bar
