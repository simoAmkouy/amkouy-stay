import { Href } from 'expo-router';

import { Database } from '@/types/supabase';

export type UserRole = Database['public']['Enums']['user_role'];

export type Resource =
  | 'dashboard'
  | 'operations'
  | 'properties'
  | 'reservations'
  | 'owners'
  | 'finance'
  | 'expenses'
  | 'owner_payments'
  | 'cleaning'
  | 'maintenance'
  | 'owner_portal'
  | 'concierge'
  | 'concierge_reports'
  | 'contracts'
  | 'reports'
  | 'commercial_leads'
  | 'reservation_leads'
  | 'commercial_dashboard'
  | 'commercial_management'
  | 'property_activation'
  | 'team_management'
  | 'archived_items'
  | 'executive_command_center';

const ALL_RESOURCES: Resource[] = [
  'dashboard',
  'operations',
  'properties',
  'reservations',
  'owners',
  'finance',
  'expenses',
  'owner_payments',
  'cleaning',
  'maintenance',
  'owner_portal',
  'concierge',
  'concierge_reports',
  'contracts',
  'reports',
  'commercial_leads',
  'reservation_leads',
  'commercial_dashboard',
  'commercial_management',
  'property_activation',
  'team_management',
  'archived_items',
  'executive_command_center',
];

/**
 * Permission matrix — see the Phase 2 plan for the reasoning behind each row. Admin/super_admin
 * get every resource; every other role gets exactly the list agreed in the plan. Notifications
 * and Settings are deliberately not gated here — every authenticated role can reach those.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Resource[]> = {
  super_admin: ALL_RESOURCES,
  admin: ALL_RESOURCES,
  manager: ['dashboard', 'operations', 'properties', 'reservations', 'owners', 'cleaning', 'maintenance', 'concierge', 'concierge_reports', 'contracts', 'reports', 'commercial_leads', 'reservation_leads', 'commercial_management', 'property_activation', 'team_management'],
  // Read-only in practice: the Operations Center hides every Quick Action (assign/verify/etc.)
  // for accountants at the component level, since `canAccess` is a binary resource gate, not a
  // read/write distinction. Same treatment for `contracts`: the Contracts screens hide
  // create/activate/terminate/upload for accountants, matching live RLS (`contracts_select`
  // includes `is_finance()`; `contracts_insert`/`contracts_update` are `is_staff()`-only, which
  // accountant is not). `reports` (Module 8) is fully read-only by nature — every report screen
  // is a read + export, so accountant gets the same full list as manager/admin.
  // `commercial_management` here is specifically for commission approval/payment (commercial_commissions
  // insert/update RLS is `is_staff() OR is_finance()`, and accountant is_finance() — matches).
  accountant: ['dashboard', 'operations', 'finance', 'expenses', 'owner_payments', 'concierge_reports', 'contracts', 'reports', 'commercial_management', 'property_activation', 'team_management'],
  // Owner reporting (Phase 7) is not a separate `reports` grant — it lives inside `owner_portal`,
  // using column/row-restricted RPC calls (RLS + narrower query shapes), never the staff `reports`
  // screens, so an owner can never reach the portfolio/property-performance views even by URL.
  // Équipe & rôles (Team Management) is deliberately excluded for owner/cleaner/technician/
  // commercial_agent — Phase 2 of that spec grants it only to super_admin/admin (full) and
  // manager/accountant (read-only, enforced by `users_update`/`users_insert` staying
  // `is_admin()`-only at the RLS layer regardless of what the UI shows).
  owner: ['owner_portal'],
  cleaner: ['cleaning'],
  technician: ['maintenance'],
  // Deliberately excludes finance/contracts/owner_payments/maintenance/cleaning/reports (Phase 5:
  // "Cannot ... unless explicitly required") — an agent's world is leads + their own
  // reservations/calendar/KPIs, nothing else. `commercial_management` (leaderboard, cross-agent
  // commission approval) is staff-only, not granted here.
  // Also deliberately excludes `property_activation`: the shared Activation Center RPC returns a
  // business-wide onboarding funnel (every agent's acquisitions), and `properties_select`'s
  // `is_commercial_agent()` branch is unscoped by design (agents need to see all properties to
  // book reservation leads) — so the *screen* can't be safely reused for "my acquisitions only."
  // Module 11's "read onboarding status of properties they acquired" is instead served inside
  // the Commercial Dashboard, client-filtered to `acquired_by_agent = me` off the same RPC.
  commercial_agent: ['commercial_leads', 'reservation_leads', 'commercial_dashboard'],
};

export function canAccess(role: UserRole | undefined, resource: Resource): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(resource);
}

/** Where a role lands right after login. Owner/Cleaner/Technician/Commercial Agent now land on
 * their primary TAB (role-navigation.ts) rather than the equivalent `/more/...` screen, so the
 * tab bar highlights the right tab immediately instead of landing on a screen with no active tab
 * indicator. Same screens as before — only the entry route changed. */
export const HOME_ROUTE_BY_ROLE: Record<UserRole, Href> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  manager: '/dashboard',
  accountant: '/dashboard',
  owner: '/portal',
  cleaner: '/tasks',
  technician: '/tickets',
  commercial_agent: '/commercial-dashboard',
};
