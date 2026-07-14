# Executive Command Center — Design Spec

Status: **design only, not yet implemented.** This is a blueprint for a future build, produced
against the current app as of 2026-07-10. It reuses `KPI_REGISTRY.md` as its single source of
truth for every number shown — no new formula, no new RPC, no new business logic is introduced by
this spec. Where a widget needs something that doesn't exist yet (a query param, a filter), that
gap is called out explicitly rather than assumed away.

---

## 0. Audit summary — what already exists

The app already has six dashboards. None of them is an executive-level rollup:

| Screen | Audience | Character |
|---|---|---|
| Home (`dashboard.tsx`) | All staff roles | Lightweight daily snapshot |
| Operations Center (`operations.tsx`) | Super Admin, Admin, Manager, Accountant | Deep, day-to-day **operational** detail (arrivals, cleaning, maintenance, team workload) — already the most comprehensive screen in the app, including a Business Health Score |
| Finance (`more/finance.tsx`) | Accountant, Admin, Super Admin | Financial summary + charts |
| Reports (4 screens under `more/reports/`) | Staff with `reports` | Owner Statements, Portfolio Report, Reporting Dashboard, Export Center |
| Owner Portal | Owner | Self-scoped, not staff-facing |
| Commercial Dashboard | Commercial Agent | Self-scoped to one agent |

**The gap:** nothing today is scoped to *just* Super Admin/Admin, and nothing presents the
business at the altitude an executive actually needs — trend, risk concentration, and financial
integrity across the whole portfolio in one glance, with everything else one tap away. Operations
Center is comprehensive but organized for *doing operational work*, not for a 30-second "is the
business healthy" read. This spec is that missing screen — built entirely from data every one of
the screens above already computes correctly.

---

## 1. Architecture

**New screen:** `src/app/(tabs)/more/executive-command-center.tsx`, wrapped in
`<AccessGuard resource="executive_command_center">`.

**Permissions (additive, no existing resource touched):**
- Add `'executive_command_center'` to the `Resource` union and to `ALL_RESOURCES` in
  `src/constants/permissions.ts`. Because `ROLE_PERMISSIONS.super_admin`/`.admin` are literally
  `ALL_RESOURCES` while every other role has its own explicit, curated array (manager, accountant,
  owner, cleaner, technician, commercial_agent all list resources by name), this one addition
  scopes the new resource to Super Admin/Admin only — the exact mechanism already used for
  `archived_items`. No other role's array needs to change.

**Navigation (additive):**
- New `MoreItemKey` `'executive_command_center'` in `src/constants/role-navigation.ts`.
- New tile in `MORE_ITEMS` (`src/app/(tabs)/more/index.tsx`), same pattern as `reports`/`finance`.
- **Not a new tab.** Super Admin/Admin already have 4 primary tabs (`dashboard`, `operations`,
  `properties`, `reservations`) + More; adding a 5th tab would crowd a tab bar this app has
  deliberately kept lean for every role (see the existing comment in `role-navigation.ts` about
  not fragmenting screens into extra tabs). A More-menu tile is the right weight for a screen two
  roles use, not four.

**Data fetching — zero new queries.** Every widget below is powered by an RPC or compute function
that already exists and is already called from another screen. The Executive Command Center calls
the *same* hooks:

| Existing hook | Already used by | Reused here for |
|---|---|---|
| `useOperationsCenterRaw()` | Operations Center | Business Health Score, Risk Center, Reservation Risks, Property Health, Team Workload |
| `usePortfolioSummary(range)` | Finance | Revenue / Refunds / Net Revenue / Marge brute |
| `usePortfolioTimeline(range)` | Reports → Reporting Dashboard | Trend chart |
| `usePropertyPerformance(range)` / `usePortfolioReport(range)` | Reports → Portfolio | Top/Bottom properties |
| `useOwnerPayments()` | Owner Payments, Finance | Owner Payment Integrity count |
| `useCommercialLeaderboard(start, end)` | Commercial Leaderboard, Operations Center | Agent leaderboard |
| `useCommercialSourcePerformance(start, end)` | Reports → Portfolio | Top lead sources |
| `useActivationFunnelReport(...)` | Reports → Portfolio | Acquisition → activation funnel |
| `useContracts()` / `computeContractsPanel` | Contracts, Operations Center | Contract renewal risk |
| `useRecentActivity(range)` | Home, Operations Center | Audit trail feed |
| `listArchivedItems()` (via `useArchivedItems()`) | Recovery Center | Data-integrity signal (items awaiting review) |

Because React Query caches every one of these by its existing query key, opening this screen after
already having visited Operations Center or Reports in the same session costs **zero** additional
network round-trips for that data — it reads straight from cache.

---

## 2. Widgets

Organized top-to-bottom by altitude: strategic health first, then financial, then portfolio, then
risk, then growth, then trust/audit. Every row cites its exact existing source — nothing here is a
new formula.

### 2.1 Hero — Business Health Score
- Score /100 + six sub-scores (Reservations, Cleaning, Maintenance, Finance, Contracts, Property
  Readiness) + Top Risks list.
- **Source:** `computeBusinessHealthScore()`, `operations-center.ts` — already built and already
  gated to Super Admin/Admin/Manager on Operations Center. No change to the function; this screen
  just renders it again, restricted to Super Admin/Admin here (Manager still sees it on Operations
  Center, unchanged).

### 2.2 Financial Trust panel
- **Revenue / Refunds / Net Revenue / Marge brute**, selectable period — `report_portfolio_summary`
  via `usePortfolioSummary(range)` (Finance's exact source).
- **Trend chart** (monthly) — `report_portfolio_timeline` via `usePortfolioTimeline(range)`
  (Reporting Dashboard's exact source).
- **Owner Payment Integrity** — count of `owner_payments` where `is_manual_adjustment = true` and
  `status NOT IN ('paid', 'cancelled')` — a client-side filter over `useOwnerPayments()`, the exact
  same query the Owner Payments list already runs, no new formula (this is literally what
  `KPI_REGISTRY.md` §6 documents as the thing every screen must surface).
- **Settlement Queue** — reuses Finance's existing `ownerFinance.settlementQueue`/
  `ownersAwaitingSettlement` computation verbatim.

### 2.3 Portfolio Performance panel
- **Best / Worst / Fastest-Growing property** — `getPortfolioReport()`'s existing
  `bestByRevenue`/`worstByRevenue`/`fastestGrowing`, already computed for Reports → Portfolio.
- **Top 5 by Revenue, Top 5 by Occupancy Rate** — `report_property_performance` via
  `usePropertyPerformance(range)`, sorted client-side (same sort keys the Portfolio Report screen
  already offers).
- **Property Health** (missing photos / pricing / contract / owner, pending activation) —
  `computePropertyHealthPanel()`, `operations-center.ts` (Mission D).

### 2.4 Operational Risk Rollup
- **Risk Center counts** (properties without reservation, needing cleaning, blocked, unassigned
  cleaning/maintenance/concierge, overdue owner payments) — `computeRiskCenter()`.
- **Reservation Risks** (missing guest info, pending confirmation, arriving <48h) —
  `computeReservationRisks()`.
- **Contracts** (expiring 30/60/90 days, expired) — `computeContractsPanel()`.

All three functions above are already called by Operations Center against the same
`useOperationsCenterRaw()` payload — no new fetch, just re-rendered at a higher altitude (counts
and top-3 lists only, not the full itemized panels Operations Center shows).

### 2.5 Commercial & Growth panel
- **Agent leaderboard** (top 3 by revenue generated, conversion rate) —
  `get_commercial_leaderboard` via `useCommercialLeaderboard(start, end)`.
- **Top lead sources** — `get_commercial_source_performance` via `useCommercialSourcePerformance`.
- **Activation funnel** (acquired → activated, activation rate, avg days to first booking) —
  `get_activation_funnel_report` via `useActivationFunnelReport`.

### 2.6 Trust & Audit panel
- **Recent high-signal activity** — `listRecentActivity(range)`, filtered client-side to the
  action prefixes that matter at executive altitude: `property.reassigned`, `owner_payment.*`,
  `contract.*`, `user.role_changed` — same table, same query, narrower client-side filter (not a
  new query).
- **Archived items awaiting review** — count from `list_archived_items()` via
  `useArchivedItems()` (Recovery Center's exact source), surfaced as a data-integrity signal, not
  duplicated as a new restore UI (tapping it goes to the existing Recovery Center).

---

## 3. Alerts

Reuses `computeAlertCenter()` (`operations-center.ts`, Mission D) exactly as-is — **no new alert
type, no new severity logic.** The only change at this altitude is a stricter client-side filter:

```
executiveAlerts = computeAlertCenter(raw, todayStr, tomorrowStr).filter(a => a.severity === 'urgent')
```

Operations Center keeps showing the full list (urgent + warning); the Executive Command Center
shows only `urgent` — contract expiring ≤30 days, overdue cleaning, overdue owner payment,
reservation not confirmed arriving ≤48h. This matches how the rest of the app already treats
severity (Operations Center's own alert list is already sorted urgent-first) — just a narrower cut
for a screen meant to be read in 30 seconds.

---

## 4. Drill-down flows

Every widget taps through to an existing screen. Where the target screen already supports the
needed filter (built in the Global Sorting/Filtering and Command Center missions), the link is
ready today; where it isn't, that's called out so it's not assumed to already work.

| Widget | Destination | Ready today? |
|---|---|---|
| Business Health Score / Top Risks | `/operations` | ✅ Yes |
| Revenue/Profit trend | `/more/reports/dashboard` | ✅ Yes |
| Best/Worst/Fastest-growing property | `/more/reports/portfolio` | ✅ Yes |
| Owner Payment Integrity count | `/more/owner-payments` | ⚠️ Lands on the unfiltered list — no `?filter=manual` param exists yet (see Roadmap Phase 9) |
| Settlement Queue | `/more/owner-payments` | ✅ Yes (screen already default-sorts by due date) |
| Contracts expiring | `/more/contracts?health=expiring` | ✅ Yes (built in the Command Center sprint) |
| Property Health tiles | `/properties?status=onboarding` | ✅ Yes (built in the Command Center sprint) |
| Risk Center: overdue cleaning | `/more/cleaning?view=overdue` | ✅ Yes |
| Risk Center: urgent maintenance | `/more/maintenance?view=urgent` | ✅ Yes |
| Commercial leaderboard | `/more/commercial/leaderboard` | ✅ Yes |
| Activation funnel | `/more/reports/portfolio` (funnel section) or `/more/activation-center` | ✅ Yes |
| Recent activity row | Route implied by `entity_type`/`entity_id` on the activity row (e.g. `/properties/{id}`, `/more/owner-payments/{id}`) | ✅ Yes — same pattern already used by Operations Center's alert rows |
| Archived items count | `/more/archived-items` | ✅ Yes |
| Urgent alerts | Each alert's own `href` (unchanged from `computeAlertCenter`) | ✅ Yes |

---

## 5. Performance requirements

- **No full-table client loads beyond what Operations Center already does.** Every source above is
  either a Postgres RPC (already server-aggregated) or the same `useOperationsCenterRaw()` payload
  Operations Center fetches in one `Promise.all`.
- **Cache-first.** All hooks reused here already have their own React Query keys; a user who
  opened Operations Center or Reports earlier in the session sees this screen populate instantly
  from cache, with a background refetch per each hook's existing `staleTime` policy (unchanged).
- **Parallel fetch on cold load.** All ~6 top-level hooks (`useOperationsCenterRaw`,
  `usePortfolioSummary`, `usePortfolioTimeline`, `usePropertyPerformance`,
  `useCommercialLeaderboard`, `useActivationFunnelReport`) should be called independently (React
  Query fires them concurrently by default) rather than sequentially awaited — matches how
  Operations Center already composes ~10 independent hooks today.
- **No client-side heavy computation introduced.** Every aggregate (score, panel, funnel, ranking)
  is already computed either in Postgres or in an existing pure function; this screen only slices
  (top-N, filter-by-severity) and re-renders.
- **Validation before ship:** re-run this screen's full hook set against the live database and
  confirm total distinct network calls doesn't exceed "Operations Center + Reports → Portfolio +
  Commercial Leaderboard opened separately" — i.e., this screen must be provably cheaper than
  visiting its three source screens one after another, not a new burden layered on top.

---

## 6. Implementation roadmap

1. **Navigation & permissions scaffolding** — `Resource`, `ALL_RESOURCES`, `MoreItemKey`,
   `MORE_ITEMS` tile, empty route file behind `AccessGuard`.
2. **Hero: Business Health Score** — render `computeBusinessHealthScore()`'s existing output.
3. **Financial Trust panel** — wire `usePortfolioSummary`, `usePortfolioTimeline`, owner-payment
   integrity filter.
4. **Portfolio Performance panel** — wire `usePropertyPerformance`/`usePortfolioReport`,
   `computePropertyHealthPanel`.
5. **Operational Risk Rollup** — wire `computeRiskCenter`, `computeReservationRisks`,
   `computeContractsPanel`.
6. **Commercial & Growth panel** — wire leaderboard, source performance, activation funnel.
7. **Trust & Audit panel** — wire recent activity (filtered) + archived items count.
8. **Alerts** — reuse `computeAlertCenter`, filter to `urgent`.
9. **Close the one drill-down gap** — add `?filter=manual` query-param support to
   `more/owner-payments/index.tsx` (same `useLocalSearchParams` pattern already used by
   Cleaning/Maintenance/Properties/Contracts), so the Owner Payment Integrity widget deep-links
   precisely instead of landing on the unfiltered list.
10. **Performance validation & regression pass** — confirm cache-reuse claim in §5 empirically
    (network tab / query-key inspection), `tsc --noEmit` + `eslint` clean, update
    `KPI_REGISTRY.md` if any widget surfaces a KPI not yet listed there (none currently expected —
    every widget above already has a registry entry).

---

## 7. Explicitly out of scope

- No new formula, RPC, or database column.
- No change to any existing screen's own visibility (Manager/Accountant keep Operations Center and
  Finance exactly as they are).
- No new alert severity or alert source — only a stricter filter over the existing engine.
- No reconciliation/drift-detection logic for the owner-payment formula changes noted in the
  Financial Truth Remediation report — that remains a human-reviewed action via the existing
  "Générer" flow, not something this screen automates.
