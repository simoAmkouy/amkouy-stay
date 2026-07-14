import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type NotificationType = Database['public']['Enums']['notification_type'];
export type NotificationPriority = Database['public']['Enums']['notification_priority'];

export async function listNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    logAppError('notifications.listNotifications', error);
    throw error;
  }
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logAppError('notifications.markNotificationRead', error);
    throw error;
  }
}

/**
 * Fire-and-forget: inserts one `in_app` row per recipient for an action-triggered event
 * (ticket created/assigned/started/completed/verified). Never throws — a notification failure
 * should not block the mutation that triggered it, same contract as `logActivity`.
 */
export async function notifyUsers(params: {
  userIds: (string | null | undefined)[];
  type: NotificationType;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<void> {
  const recipients = Array.from(new Set(params.userIds.filter((id): id is string => !!id)));
  if (recipients.length === 0) return;
  const { error } = await supabase.from('notifications').insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      priority: params.priority ?? 'info',
      channel: 'in_app' as const,
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
    }))
  );
  if (error) console.warn('[notifications] failed to notify', params.type, error.message);
}
