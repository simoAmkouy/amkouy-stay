import { Href } from 'expo-router';

import { UserRole } from '@/constants/permissions';
import { TranslationKey } from '@/i18n';

/**
 * Role-Based Navigation & Portal Experience — single source of truth for "what does this role
 * SEE" (tabs + More menu curation), layered strictly ON TOP of `permissions.ts`'s "what can this
 * role DO/ACCESS" (`canAccess`/RLS). Visibility here never grants anything: every tab and every
 * More item still requires the underlying resource permission — this file only ever narrows a
 * role's view further, it never widens it. See permissions.ts for the actual security boundary.
 */

// ============================================================================
// Tabs
// ============================================================================

export type TabKey =
  | 'dashboard'
  | 'operations'
  | 'properties'
  | 'reservations'
  | 'portal'
  | 'tasks'
  | 'tickets'
  | 'commercial_dashboard'
  | 'leads'
  | 'reservation_leads'
  | 'more';

export type TabDef = { key: TabKey; name: string; href: Href; labelKey: TranslationKey; icon: string };

/** One row per possible tab destination. `name` must match an actual route file directly under
 * `(tabs)/` — required by `NativeTabs.Trigger`, which (unlike the web `TabTrigger`) cannot point
 * at an arbitrary nested path. Where a role's tab reuses an existing screen (Owner Portal,
 * Cleaning, Maintenance, Commercial Dashboard/Leads/Reservation Leads), the route file is a
 * one-line re-export — see `src/app/(tabs)/{portal,tasks,tickets,commercial-dashboard,leads,
 * reservation-leads}.tsx` — never a duplicated component. */
export const TAB_DEFS: Record<TabKey, TabDef> = {
  dashboard: { key: 'dashboard', name: 'dashboard', href: '/dashboard', labelKey: 'nav.home', icon: 'home' },
  operations: { key: 'operations', name: 'operations', href: '/operations', labelKey: 'nav.operations', icon: 'dashboard' },
  properties: { key: 'properties', name: 'properties', href: '/properties', labelKey: 'nav.properties', icon: 'apartment' },
  reservations: { key: 'reservations', name: 'reservations', href: '/reservations', labelKey: 'nav.reservations', icon: 'event' },
  portal: { key: 'portal', name: 'portal', href: '/portal', labelKey: 'nav.portal', icon: 'badge' },
  tasks: { key: 'tasks', name: 'tasks', href: '/tasks', labelKey: 'nav.tasks', icon: 'cleaning_services' },
  tickets: { key: 'tickets', name: 'tickets', href: '/tickets', labelKey: 'nav.tickets', icon: 'build' },
  commercial_dashboard: {
    key: 'commercial_dashboard',
    name: 'commercial-dashboard',
    href: '/commercial-dashboard',
    labelKey: 'nav.commercialDashboard',
    icon: 'trending_up',
  },
  leads: { key: 'leads', name: 'leads', href: '/leads', labelKey: 'nav.leads', icon: 'person_add' },
  reservation_leads: {
    key: 'reservation_leads',
    name: 'reservation-leads',
    href: '/reservation-leads',
    labelKey: 'nav.reservationLeads',
    icon: 'event_available',
  },
  more: { key: 'more', name: 'more', href: '/more', labelKey: 'nav.more', icon: 'menu' },
};

/**
 * Per role, in display order. `more` is appended to every role rather than repeated below —
 * every role keeps a way to reach Notifications/Language/Settings regardless of what else they
 * see (matches the existing "Notifications and Settings are never gated" rule in permissions.ts).
 *
 * Owner/Cleaner/Technician/Commercial Agent deliberately get ONE consolidated primary tab rather
 * than one tab per bullet in the mission's example list — Owner Portal, Cleaning, and Maintenance
 * are each already a single unified screen (properties + reservations + revenue + contracts for
 * the owner; today's tasks for the cleaner; tickets for the technician), and splitting an
 * already-cohesive screen into several tabs would fragment it and risk duplicating state, which
 * Phase 10 explicitly rules out. Commercial Agent gets three (Dashboard/Leads/Reservation Leads)
 * since those are three genuinely distinct existing screens; "Acquired Properties" is already a
 * KPI on the Commercial Dashboard (Module 10/11), not a separate screen, so it isn't a 4th tab.
 */
const ROLE_PRIMARY_TABS: Record<UserRole, TabKey[]> = {
  super_admin: ['dashboard', 'operations', 'properties', 'reservations'],
  admin: ['dashboard', 'operations', 'properties', 'reservations'],
  // Manager: unchanged — "keep operational visibility" (Phase 3).
  manager: ['dashboard', 'operations', 'properties', 'reservations'],
  // Accountant: unchanged tabs — Phase 3's "Payments/Contracts/Reports/Exports" focus is already
  // served by the existing Operations Center integration (Module 9 payments, Module 7 contracts)
  // and the More menu (narrowed below), not by new top-level screens duplicating that content.
  accountant: ['dashboard', 'operations'],
  owner: ['portal'],
  cleaner: ['tasks'],
  technician: ['tickets'],
  commercial_agent: ['commercial_dashboard', 'leads', 'reservation_leads'],
};

export function getTabsForRole(role: UserRole | undefined): TabDef[] {
  const keys = role ? ROLE_PRIMARY_TABS[role] : [];
  return [...keys, 'more' as const].map((k) => TAB_DEFS[k]);
}

// ============================================================================
// More menu curation
// ============================================================================

export type MoreItemKey =
  | 'owners'
  | 'activation_center'
  | 'commercial'
  | 'finance'
  | 'expenses'
  | 'owner_payments'
  | 'contracts'
  | 'reports'
  | 'cleaning'
  | 'maintenance'
  | 'concierge_catalog'
  | 'concierge_providers'
  | 'concierge_reports'
  | 'notifications'
  | 'owner_portal'
  | 'archived_items'
  | 'executive_command_center'
  | 'settings';

/**
 * Roles NOT listed here fall back to full `canAccess`-driven visibility (today's behavior,
 * unchanged) — this matches "Manager: keep operational visibility" / "Admin: keep full
 * visibility" from Phase 4 without needing to enumerate their items twice.
 *
 * Roles listed here see the INTERSECTION of this list and `canAccess` — this file only narrows,
 * it never re-grants a resource the role doesn't already hold (Phase 6: navigation visibility is
 * not security). `notifications`/`settings` are included explicitly even though they're
 * ungated in `permissions.ts`, since every role's Phase 4 list names them.
 */
export const ROLE_MORE_VISIBLE: Partial<Record<UserRole, MoreItemKey[]>> = {
  // Owner's "My Contracts" already lives inside the Portal tab (Owner Portal's "Mes contrats"
  // section, Module 7) — not repeated here as a separate tile to avoid showing the same data
  // behind two different entry points.
  owner: ['notifications', 'settings'],
  cleaner: ['notifications', 'settings'],
  technician: ['notifications', 'settings'],
  // Dashboard/Leads/Reservation Leads moved to tabs for this role, but the "Commercial" hub tile
  // is kept — it's also how this role reaches Calendar and the Leaderboard (Commissions view),
  // which aren't tabs. Tapping into Dashboard/Leads/Reservation Leads from inside that hub just
  // lands on the same screens their tabs already open — same destination, not a duplicate one.
  commercial_agent: ['commercial', 'notifications', 'settings'],
  accountant: ['finance', 'expenses', 'owner_payments', 'contracts', 'reports', 'notifications', 'settings'],
};
