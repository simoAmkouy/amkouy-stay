# KPI Registry

Single source of truth for every financial/operational KPI in Amkouy Stay. Written as part of the
**Financial Truth Remediation Sprint** (2026-07-10), which fixed the inconsistencies found by the
preceding **KPI Consistency & Financial Truth Audit**.

**Rule going forward:** before adding a new metric or a new screen that shows Revenue, Profit,
Occupancy, or an Owner Payment figure, check this file first. If the number already has an entry
below, call the same query/RPC — do not add a second formula for something that already has one.
If you change a formula listed here, update this file in the same change.

---

## 1. Revenue Attribution Policy (the standard)

**Standard: stay-overlap, prorated to nights inside the queried window.**

A reservation's revenue is attributed to a date range `[start, end]` as:

```
window_frac  = (LEAST(check_out_date, end) - GREATEST(check_in_date, start)) / (check_out_date - check_in_date)
revenue      = total_amount * window_frac
```

A reservation counts toward a range if `check_in_date <= end AND check_out_date >= start` (i.e. any
part of the stay overlaps the range). This replaces two previous conventions:

- **Convention A (check-in-date only)** — used to power the Home dashboard, Operations Center, and
  the Portfolio/Owner-Statement Timeline charts. Simple, but disagreed with Convention B on
  boundary-crossing reservations.
- **Convention C (reservation `created_at`)** — still used, deliberately, by Commercial Agent KPIs
  (see the exception below).

**Documented exception — Commercial Agent attribution (Convention C, kept on purpose):**
`get_commercial_agent_kpis` / `get_commercial_leaderboard` attribute a reservation to whichever
period it was *created* in, not whichever period its stay falls in. This is intentional: an agent's
performance should reflect when they closed the deal, not when the guest happens to stay. Do not
"fix" this to match the Revenue standard — it is answering a different question (attribution of
effort, not accounting for a stay).

**Documented exception — Arrivals/Departures counts (Convention A, kept on purpose):**
`checkIns`/`checkOuts` on the Home dashboard and Operations Center's Arrivals/Departures panels are
correctly check-in/check-out-date-based — "who is arriving today" is inherently about the date an
event happens, not a revenue-attribution question.

**Concierge revenue is not prorated** in the Summary/Property-Performance/Settlement RPCs — a
concierge service is delivered on a specific date, not spread across a stay, so its full value
belongs to whichever period query touches its parent reservation. The Timeline RPCs (which must
avoid double-counting across month buckets) prorate concierge the same way as accommodation revenue
as a documented simplification — see the comment in `report_portfolio_timeline`.

---

## 2. Occupancy Standard

**Standard: booked nights ÷ available room-nights, for active properties only, capped at 100%.**

```
occupancy_rate = LEAST(100, ROUND(
  booked_nights_in_range / ((days_in_range) * active_properties_count) * 100
, 1))
```

This replaces the "properties booked at least once ÷ active properties" formula that used to power
the Home dashboard and Operations Center — it disagreed with the Finance/Reports formula by as much
as **11x** on the same data (53.2% vs 4.8% for the same 2026 full-year window).

- `occupiedPropertiesCount` / `availablePropertiesCount` (Home dashboard tiles, Operations
  Center's "X occ. · Y dispo." meta line) **still use the old distinct-property-count logic** —
  that headcount is a real, useful number, it is just not called "Occupancy Rate" anymore. Do not
  conflate the two.
- Archived and soft-deleted properties are excluded from both numerator and denominator everywhere.
  The denominator is always `status = 'active'` properties only.
- Canonical TypeScript implementation: `computeOccupancyRate()` in
  `src/lib/queries/dashboard-metrics.ts` — imported by `operations-center.ts` rather than
  reimplemented. The SQL implementation lives identically in `report_portfolio_summary`,
  `report_property_performance`, and `report_owner_statement`.

---

## 3. Refund Policy

**Standard: Option B — Revenue stays gross; Net Revenue (Revenue − Refunds) is a new, separate KPI;
Profit is computed from Net Revenue.**

Refunds (`payments.type IN ('refund', 'deposit_release')`, `status = 'completed'`) are prorated the
same way as the reservation's revenue and subtracted before Profit is computed. The "Revenue" tile
label is unchanged and still means gross bookings; every screen showing Profit now also shows
Refunds and/or Net Revenue alongside it so the gross-to-net bridge is visible, not hidden.

---

## 4. Profit Terminology

"Profit" was renamed to **"Marge brute" (Gross Margin)** everywhere it appears in the UI (i18n keys,
Operations Center, Finance, Portfolio Report, Reporting Dashboard). The formula did not change —
only the label. What it means, precisely:

```
Marge brute = Net Revenue (Revenue − Refunds) + Concierge Revenue
              − Expenses − Cleaning Costs − Maintenance Costs
```

It does **not** subtract the owner's settlement payout or Amkouy's commission — those are computed
separately by the settlement engine (`compute_owner_settlement`). "Marge brute" is company-wide
gross margin *before* owner payout, not the company's final take-home. If a future screen needs
"profit after owner payout," that is a new, distinct KPI — do not repurpose this one.

---

## 5. KPI Table

| KPI | Formula (short) | Query / RPC | Screens | Roles | Classification |
|---|---|---|---|---|---|
| **Revenue** (gross) | Stay-overlap, prorated to nights in range; excludes cancelled/no_show | `report_portfolio_summary`, `report_property_performance`, `getDashboardMetrics` (`fetchRevenueInRange`) | Home, Finance, Operations Center, Reports (Portfolio/Property Performance) | Staff, Accountant, Manager, Admin, Super Admin | ✅ Trusted |
| **Refunds** | Same prorated window as Revenue; `payments.type IN (refund, deposit_release)` | Same RPCs as Revenue (now return `refunds`/`total_refunds`) | Finance, Reports (Portfolio/Owner Statement) | Accountant, Admin, Super Admin | ✅ Trusted |
| **Net Revenue** | Revenue − Refunds | Same RPCs as Revenue (`net_revenue`/`total_net_revenue`) | Finance, Reports | Accountant, Admin, Super Admin | ✅ Trusted |
| **Marge brute** (formerly "Profit") | Net Revenue + Concierge − Expenses − Cleaning − Maintenance | Same RPCs as Revenue; `getDashboardMetrics` | Home, Finance, Operations Center, Reports | Staff, Accountant, Manager, Admin, Super Admin | ✅ Trusted (relabeled) |
| **Occupancy Rate** | Booked nights ÷ available room-nights, active properties only, capped at 100% | `computeOccupancyRate` (TS), `report_portfolio_summary`/`report_property_performance`/`report_owner_statement` (SQL) | Home, Operations Center, Finance, Reports, Owner Portal | All staff-facing screens + Owner | ✅ Trusted (standardized) |
| **Occupied/Available Properties** (count) | Distinct active properties with ≥1 overlapping booking | `fetchOccupancyRaw` (TS), `computeOccupancyForWindow` (TS) | Home, Operations Center | Staff | ✅ Trusted (distinct metric from Occupancy Rate, not a rate) |
| **ADR** (Average Daily Rate) | Prorated revenue ÷ booked nights, same window | `report_portfolio_summary`, `report_property_performance`, `getDashboardMetrics` | Home, Finance, Reports | Staff, Accountant | ✅ Trusted |
| **Avg. Stay** | Booked nights ÷ reservation count, same window | `report_portfolio_summary`, `report_property_performance` | Finance, Reports | Staff, Accountant | ✅ Trusted |
| **Owner Settlement (gross/expenses/commission/net)** | `compute_owner_settlement()` — the one settlement engine | `compute_owner_settlement`, called by `generate_owner_settlements` and by the Owner Payment create form's live preview | Owner Payments (create + "Générer"), Reports (Owner Statement) | Accountant, Admin, Super Admin | ✅ Trusted for `is_manual_adjustment = false` rows |
| **Owner Payment status/balance/overdue** | Computed at read time from `status`/`due_date`, never stored | `computeDisplayStatus` (TS) | Owner Payments, Finance, Owner Portal, Operations Center | Staff, Accountant, Owner (own rows) | ✅ Trusted |
| **`is_manual_adjustment`** | `true` iff a payment's financial figures were NOT produced by `compute_owner_settlement` (legacy rows only — see below) | `owner_payments.is_manual_adjustment` column | Owner Payments list/detail, Owner Portal, Finance, Operations Center | Same as above | ⚠️ Needs Review — 94 legacy rows carry this flag; see §6 |
| **Commercial Agent Revenue/Reservations Generated** | Reservation `created_at` in range (Convention C, deliberate exception — see §1) | `get_commercial_agent_kpis`, `get_commercial_leaderboard` | Commercial Dashboard, Operations Center leaderboard | Commercial Agent, Staff | ✅ Trusted (documented exception, not a bug) |
| **Commercial Commissions (pending/paid)** | Σ `commercial_commissions.amount` by status | `get_commercial_agent_kpis` | Commercial Dashboard | Commercial Agent | ✅ Trusted |
| **Cash Received / Outstanding / Collection Rate** | Completed `payments` netted against `total_amount`, same overlap window as Revenue | `get_payments_overview`, `get_reservation_payment_summary`, `get_outstanding_reservations` | Home, Operations Center, Reports, Reservation detail | Staff, Accountant | ✅ Trusted |
| **Contracts Expiring (30/60/90d, expired)** | `computeDaysRemaining`/`computeContractHealth` on `contracts.end_date` | `computeContractsPanel` (TS), `computeDaysRemaining` (TS) | Home (30d count), Operations Center, Contracts screen | Staff, Accountant | ✅ Trusted |
| **Business Health Score** | Weighted blend of Reservations/Cleaning/Maintenance/Finance/Contracts/Property-Readiness sub-scores (see `computeBusinessHealthScore`) | `computeBusinessHealthScore` (TS) | Operations Center | Super Admin, Admin, Manager only | ✅ Trusted (documented formula) |
| **Tourist Tax** | Collected on `reservations.tourist_tax_amount`, never read by any KPI | — | — | — | ⬜ Unused — confirm this is intentional (pass-through, not company revenue) before building anything on top of it |
| **"Plus rentable" (Most Profitable Property)** | Revenue − (cleaning + maintenance costs); previously always equal to "Meilleur revenu" because its cost map was permanently empty | `computePerformanceInsights` (TS) | Operations Center | Staff | ✅ Trusted (fixed in this sprint — see Bugs Found in the sprint report); still partial: does not include the general `expenses` table, only cleaning/maintenance |

---

## 6. Owner Payment Integrity

- Going forward, **every new owner payment's financial figures come from `compute_owner_settlement()`**
  — the create form (`OwnerPaymentCreateForm`) only accepts property + period + due date + payment
  method + reference + notes; there is no code path that accepts a typed gross revenue, expense, or
  commission percentage.
- Editing an existing payment (`OwnerPaymentEditForm`) only ever touches due date / payment method /
  reference / notes / status — never financial fields, matching the DB trigger
  `enforce_owner_payment_financial_freeze` (which already blocked financial edits once a payment
  left `pending`; the app layer now blocks it while `pending` too).
- `owner_payments.is_manual_adjustment` (boolean, default `false`) marks any row whose financial
  figures were **not** produced by the settlement engine. The 94 rows the original audit found
  unreconcilable were backfilled to `true` (identified by `company_commission_pct IS NULL`, the
  tell that `generate_owner_settlements` never touched them). Every screen displaying an owner
  payment must show this flag when true — implemented on the Owner Payments list, detail screen,
  Owner Portal, Finance's pending-payments preview, and Operations Center's payment alerts.

---

## 7. Adding a new KPI

1. Check this file — does the number already exist under a different name?
2. If it's Revenue, Profit, Occupancy, or Refunds: it must use the standards in §1–§4. Do not
   introduce a fourth date-window convention or a second occupancy formula.
3. Add a row to §5 with: formula, query/RPC, screens, roles, and a classification (Trusted / Needs
   Review / Deprecated).
4. If the KPI is server-computed, prefer extending an existing RPC over adding a new one, unless the
   existing RPC's shape genuinely doesn't fit (e.g. a different grain or a different table).
