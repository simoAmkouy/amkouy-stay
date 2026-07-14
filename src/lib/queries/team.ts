import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

// ============================================================================
// Team & Roles — "Assigned Work" (Phase 7). Every function here is a thin,
// per-user-scoped variant of an existing list query, reusing the exact same
// status/formula definitions already established in operations-center.ts —
// never a new KPI table, never a recalculated metric.
// ============================================================================

const OPEN_CLEANING_STATUSES = new Set(['unassigned', 'scheduled', 'in_progress']);
const OPEN_MAINTENANCE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

export type CleanerStats = {
  assignedCount: number;
  completedCount: number;
  pendingCount: number;
  overdueCount: number;
  completionRate: number | null;
  avgCompletionHours: number | null;
};

/** Same formula as `computeCleaningTeamWorkload` in operations-center.ts, scoped to one cleaner
 * via a filtered query instead of the whole-portfolio raw fetch (this is a single-user card, not
 * a team-wide dashboard — no reason to pull every property's tasks for it). */
export async function getCleanerStats(userId: string, todayStr: string): Promise<CleanerStats> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .select('status, scheduled_date, started_at, completed_at')
    .eq('assigned_to_user_id', userId)
    .is('deleted_at', null);
  if (error) {
    logAppError('team.getCleanerStats', error);
    throw error;
  }
  const tasks = (data ?? []).filter((t) => t.status !== 'cancelled');
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'verified');
  const pending = tasks.filter((t) => OPEN_CLEANING_STATUSES.has(t.status));
  const overdue = pending.filter((t) => t.scheduled_date < todayStr);
  const durations = completed
    .filter((t) => t.started_at && t.completed_at)
    .map((t) => (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 3_600_000);
  return {
    assignedCount: tasks.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    overdueCount: overdue.length,
    completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : null,
    avgCompletionHours: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
  };
}

export type TechnicianStats = {
  assignedCount: number;
  openCount: number;
  completedCount: number;
  urgentCount: number;
  avgResolutionHours: number | null;
};

/** Same formula as `computeMaintenanceTeamWorkload`, scoped to one technician. */
export async function getTechnicianStats(userId: string): Promise<TechnicianStats> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select('status, priority, created_at, resolved_at')
    .eq('assigned_to_user_id', userId)
    .is('deleted_at', null);
  if (error) {
    logAppError('team.getTechnicianStats', error);
    throw error;
  }
  const tickets = (data ?? []).filter((t) => t.status !== 'cancelled');
  const open = tickets.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status));
  const completed = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
  const urgent = open.filter((t) => t.priority === 'urgent');
  const durations = completed
    .filter((t) => t.resolved_at)
    .map((t) => (new Date(t.resolved_at as string).getTime() - new Date(t.created_at).getTime()) / 3_600_000);
  return {
    assignedCount: tickets.length,
    openCount: open.length,
    completedCount: completed.length,
    urgentCount: urgent.length,
    avgResolutionHours: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
  };
}

export type ManagerStats = {
  propertiesManaged: number;
  cleaningBacklog: number;
  maintenanceBacklog: number;
  operationalIssues: number;
};

/**
 * The schema has no manager→property assignment (`properties.assigned_manager_id` exists but is
 * never written to by any code path — confirmed by search — so using it would show misleading
 * all-zero data). A manager's real scope in this app is the whole operation, matching how
 * Operations Center itself works: these are portfolio-wide counts, not "this manager's" slice.
 */
export async function getManagerStats(todayStr: string): Promise<ManagerStats> {
  const [{ count: propertiesManaged }, cleaningRows, maintenanceRows] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    supabase.from('cleaning_tasks').select('status, scheduled_date').is('deleted_at', null),
    supabase.from('maintenance_tickets').select('status, priority').is('deleted_at', null),
  ]);
  const cleaningBacklog = (cleaningRows.data ?? []).filter(
    (t) => OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date < todayStr
  ).length;
  const openMaintenance = (maintenanceRows.data ?? []).filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status));
  const maintenanceBacklog = openMaintenance.length;
  const operationalIssues = cleaningBacklog + openMaintenance.filter((t) => t.priority === 'urgent').length;
  return { propertiesManaged: propertiesManaged ?? 0, cleaningBacklog, maintenanceBacklog, operationalIssues };
}

export type AccountantStats = {
  ownerPaymentsProcessed: number;
  expensesProcessed: number;
};

/** "Processed" = this accountant is the one recorded as `approved_by` — real audit columns
 * already on both tables, no new tracking needed. */
export async function getAccountantStats(userId: string): Promise<AccountantStats> {
  const [payments, expenses] = await Promise.all([
    supabase.from('owner_payments').select('id', { count: 'exact', head: true }).eq('approved_by', userId).is('deleted_at', null),
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('approved_by', userId).is('deleted_at', null),
  ]);
  return { ownerPaymentsProcessed: payments.count ?? 0, expensesProcessed: expenses.count ?? 0 };
}

export type OwnerStats = {
  propertiesOwned: number;
  activeContracts: number;
  pendingPayments: number;
  propertiesOnboarding: number;
};

/** Resolves `public.users.id` → `owners.id` first (the two are linked but distinct tables), then
 * counts across the same tables the Owner Portal itself reads from. */
export async function getOwnerStats(userId: string): Promise<OwnerStats | null> {
  const { data: owner, error: ownerError } = await supabase.from('owners').select('id').eq('user_id', userId).maybeSingle();
  if (ownerError) {
    logAppError('team.getOwnerStats.lookup', ownerError);
    throw ownerError;
  }
  if (!owner) return null;

  const [properties, contracts, payments] = await Promise.all([
    supabase.from('property_owners').select('property_id, properties(status)').eq('owner_id', owner.id).eq('is_primary', true),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id).eq('status', 'active').is('deleted_at', null),
    supabase
      .from('owner_payments')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .not('status', 'in', '(paid,cancelled)')
      .is('deleted_at', null),
  ]);
  const propertyRows = (properties.data ?? []) as unknown as { property_id: string; properties: { status: string } | null }[];
  return {
    propertiesOwned: propertyRows.length,
    activeContracts: contracts.count ?? 0,
    pendingPayments: payments.count ?? 0,
    propertiesOnboarding: propertyRows.filter((p) => p.properties?.status === 'onboarding').length,
  };
}

// ============================================================================
// Productivity Score (Phase 8) — computed on read, never stored. 0-100, one
// formula per role, each documented inline.
// ============================================================================

/** 40% conversion rate + 30% properties acquired (capped at 10) + 30% properties activated
 * (capped at 5) — acquiring and activating owners is the actual business objective for this
 * role (Module 10/11), conversion rate alone would reward a low-volume agent unfairly. */
export function computeCommercialProductivityScore(kpis: { conversionRate: number; propertiesAcquired: number; propertiesActivated: number }): number {
  const conversionPart = Math.min(kpis.conversionRate, 100) * 0.4;
  const acquiredPart = Math.min(kpis.propertiesAcquired / 10, 1) * 30;
  const activatedPart = Math.min(kpis.propertiesActivated / 5, 1) * 30;
  return Math.round(conversionPart + acquiredPart + activatedPart);
}

/** 70% completion rate - a flat penalty for overdue tasks (10 points each, floored at 0). Overdue
 * work is weighted as a penalty rather than a positive metric since it's the clearest sign of
 * intervention being needed (Phase 10). */
export function computeCleanerProductivityScore(stats: CleanerStats): number {
  if (stats.assignedCount === 0) return 0;
  const completionPart = (stats.completionRate ?? 0) * 0.7;
  const overduePenalty = Math.min(stats.overdueCount * 10, 70);
  return Math.max(0, Math.round(completionPart - overduePenalty + 30));
}

/** 70% completion rate - a flat penalty for open urgent tickets (15 points each). Urgent tickets
 * left open are the clearest technician-side intervention signal. */
export function computeTechnicianProductivityScore(stats: TechnicianStats): number {
  if (stats.assignedCount === 0) return 0;
  const completionRate = (stats.completedCount / stats.assignedCount) * 100;
  const completionPart = completionRate * 0.7;
  const urgentPenalty = Math.min(stats.urgentCount * 15, 70);
  return Math.max(0, Math.round(completionPart - urgentPenalty + 30));
}

// ============================================================================
// Team Alerts (Phase 10) — computed only, no storage. Each check reuses data
// already fetched for the stats above; nothing new is queried here.
// ============================================================================

export type TeamAlert = { userId: string; userName: string; severity: 'warning' | 'urgent'; message: string };

export function computeCleanerAlert(userId: string, userName: string, stats: CleanerStats): TeamAlert | null {
  if (stats.overdueCount === 0) return null;
  return { userId, userName, severity: 'urgent', message: `${stats.overdueCount} tâche(s) de ménage en retard` };
}

export function computeTechnicianAlert(userId: string, userName: string, stats: TechnicianStats): TeamAlert | null {
  if (stats.urgentCount === 0) return null;
  return { userId, userName, severity: 'urgent', message: `${stats.urgentCount} ticket(s) urgent(s) ouvert(s)` };
}

/**
 * Team Overview's alert list — two bulk queries (not one per user, which would be N+1 at scale),
 * grouped client-side against the user list the screen already loaded. Scoped to the three
 * person-level signals that don't already exist anywhere else in the app: a cleaner's overdue
 * tasks, a technician's open urgent tickets, and 7+ day inactivity. Property-onboarding-stalled
 * and lead-backlog-growing style alerts are deliberately NOT duplicated here — they're already
 * surfaced in the Activation Center (Module 11) and Operations Center (Module 10), and this
 * screen is a lens over people, not another home for the same portfolio-level alerts.
 */
export async function getTeamAlerts(
  users: { id: string; full_name: string; role: string }[],
  todayStr: string
): Promise<TeamAlert[]> {
  const cleanerIds = users.filter((u) => u.role === 'cleaner').map((u) => u.id);
  const technicianIds = users.filter((u) => u.role === 'technician').map((u) => u.id);
  const [cleaningRows, maintenanceRows] = await Promise.all([
    cleanerIds.length
      ? supabase.from('cleaning_tasks').select('assigned_to_user_id, status, scheduled_date').in('assigned_to_user_id', cleanerIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as { assigned_to_user_id: string | null; status: string; scheduled_date: string }[] }),
    technicianIds.length
      ? supabase.from('maintenance_tickets').select('assigned_to_user_id, status, priority').in('assigned_to_user_id', technicianIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as { assigned_to_user_id: string | null; status: string; priority: string }[] }),
  ]);

  const alerts: TeamAlert[] = [];
  for (const cleanerId of cleanerIds) {
    const overdueCount = (cleaningRows.data ?? []).filter(
      (t) => t.assigned_to_user_id === cleanerId && OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date < todayStr
    ).length;
    if (overdueCount > 0) {
      const name = users.find((u) => u.id === cleanerId)?.full_name ?? '—';
      alerts.push({ userId: cleanerId, userName: name, severity: 'urgent', message: `${overdueCount} tâche(s) de ménage en retard` });
    }
  }
  for (const techId of technicianIds) {
    const urgentCount = (maintenanceRows.data ?? []).filter(
      (t) => t.assigned_to_user_id === techId && OPEN_MAINTENANCE_STATUSES.has(t.status) && t.priority === 'urgent'
    ).length;
    if (urgentCount > 0) {
      const name = users.find((u) => u.id === techId)?.full_name ?? '—';
      alerts.push({ userId: techId, userName: name, severity: 'urgent', message: `${urgentCount} ticket(s) urgent(s) ouvert(s)` });
    }
  }
  return alerts;
}

/** "Inactive 7+ days" per the spec — last activity is the max of last_login_at and the most
 * recent activity_logs row for this user (whichever is more recent), not last_login_at alone,
 * since a still-logged-in session with no recent actions is the more meaningful signal here. */
export function computeInactivityAlert(
  userId: string,
  userName: string,
  lastLoginAt: string | null,
  lastActivityAt: string | null
): TeamAlert | null {
  const mostRecent = [lastLoginAt, lastActivityAt].filter(Boolean).sort().pop();
  if (!mostRecent) return null;
  const daysSince = (Date.now() - new Date(mostRecent).getTime()) / 86_400_000;
  if (daysSince < 7) return null;
  return { userId, userName, severity: 'warning', message: `Inactif depuis ${Math.floor(daysSince)} jours` };
}
