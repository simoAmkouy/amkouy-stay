import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

export type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row'];

/**
 * Records one event against an entity (reservation, property, ...). Insert-only —
 * activity_logs has no soft delete / updated_at by design (see DATABASE_SCHEMA.md §6).
 * Never throws: a logging failure should not block the mutation that triggered it.
 */
export async function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, string | number | boolean | null>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('activity_logs').insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    changes: params.changes ?? null,
    user_id: user?.id ?? null,
  });
  if (error) {
    console.warn('[activity-log] failed to record', params.action, error.message);
  }
}

export async function listActivity(entityType: string, entityId: string): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Team Management's per-user Activity tab. Note: `user_id` was only stamped on inserts starting
 * with this change — actions logged before it (33 rows as of this migration) have no attributed
 * user and simply won't appear here for anyone. */
export async function listActivityForUser(userId: string, limit = 20): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Cross-entity feed for the Dashboard's "Activité récente" — newest first, within a date range. */
export async function listRecentActivity(
  range: { start: Date; end: Date },
  limit = 8
): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .gte('created_at', range.start.toISOString())
    .lte('created_at', range.end.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
