import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

export type ArchivedEntityType =
  | 'property'
  | 'owner'
  | 'reservation'
  | 'contract'
  | 'commercial_lead'
  | 'reservation_lead'
  | 'cleaning_task'
  | 'maintenance_ticket'
  | 'expense'
  | 'owner_payment'
  | 'document';

export type ArchivedItem = {
  entity_type: ArchivedEntityType;
  entity_id: string;
  label: string;
  archived_at: string;
  archived_by: string | null;
  archived_by_name: string | null;
};

/** Calls list_archived_items() — a single SECURITY DEFINER function that UNIONs every
 * soft-deleted row across the 11 supported entities, gated to is_admin() server-side. No
 * per-entity query duplicated here; the RPC is the one source of truth for "what's archived". */
export async function listArchivedItems(): Promise<ArchivedItem[]> {
  const { data, error } = await supabase.rpc('list_archived_items');
  if (error) {
    logAppError('archived-items.listArchivedItems', error);
    throw error;
  }
  return (data ?? []) as ArchivedItem[];
}

/** Calls restore_entity() — clears deleted_at/deleted_by only, logs one activity_logs entry
 * server-side. No client-side recalculation or side effect of any kind. */
export async function restoreItem(entityType: ArchivedEntityType, entityId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_entity', { p_entity_type: entityType, p_entity_id: entityId });
  if (error) {
    logAppError('archived-items.restoreItem', error);
    throw error;
  }
}
