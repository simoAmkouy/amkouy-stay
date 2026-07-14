import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type CleaningTaskRow = Database['public']['Tables']['cleaning_tasks']['Row'];
export type CleaningStatus = Database['public']['Enums']['cleaning_status'];
export type ChecklistItem = { label: string; done: boolean };

export type CleaningTaskWithRelations = CleaningTaskRow & {
  property: { id: string; name: string } | null;
  reservation: { id: string; check_out_date: string } | null;
  cleaner: { id: string; full_name: string } | null;
};

const SELECT =
  '*, property:properties(id, name), reservation:reservations(id, check_out_date), cleaner:users!cleaning_tasks_assigned_to_user_id_fkey(id, full_name)';

/** Default checklist recorded on every new cleaning task (jsonb array of `{ label, done }`). Also
 * used as the display fallback for tasks the checkout trigger created before it, which start with an empty array. */
export const CHECKLIST_TEMPLATE: ChecklistItem[] = [
  { label: 'Cuisine', done: false },
  { label: 'Salle de bain', done: false },
  { label: 'Chambre', done: false },
  { label: 'Salon', done: false },
  { label: 'Balcon', done: false },
  { label: 'Buanderie / espace lessive', done: false },
];

export async function createCleaningTask(input: {
  propertyId: string;
  scheduledDate: string;
  assignedToUserId: string | null;
  estimatedDurationMinutes: number | null;
  notes?: string;
}): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .insert({
      property_id: input.propertyId,
      scheduled_date: input.scheduledDate,
      assigned_to_user_id: input.assignedToUserId,
      status: input.assignedToUserId ? 'scheduled' : 'unassigned',
      estimated_duration_minutes: input.estimatedDurationMinutes,
      notes: input.notes || null,
      checklist: CHECKLIST_TEMPLATE,
    })
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.createCleaningTask', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: data.id, action: 'cleaning_task.created' });
  return data;
}

export type CleaningTaskListFilters = {
  statuses?: CleaningStatus[];
  propertyId?: string | null;
};

export async function listCleaningTasks(filters: CleaningTaskListFilters = {}): Promise<CleaningTaskWithRelations[]> {
  let query = supabase.from('cleaning_tasks').select(SELECT).is('deleted_at', null);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.propertyId) {
    query = query.eq('property_id', filters.propertyId);
  }
  const { data, error } = await query.order('scheduled_date', { ascending: true });
  if (error) {
    logAppError('cleaning-tasks.listCleaningTasks', error);
    throw error;
  }
  return (data ?? []) as unknown as CleaningTaskWithRelations[];
}

export async function getCleaningTask(id: string): Promise<CleaningTaskWithRelations | null> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('cleaning-tasks.getCleaningTask', error);
    throw error;
  }
  return data as unknown as CleaningTaskWithRelations | null;
}

export async function assignCleaner(id: string, userId: string): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ assigned_to_user_id: userId, status: 'scheduled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.assignCleaner', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.assigned' });
  await notifyUsers({
    userIds: [userId],
    type: 'cleaning',
    title: 'Tâche de ménage assignée',
    body: data.task_number,
    relatedEntityType: 'cleaning_task',
    relatedEntityId: id,
  });
  return data;
}

export async function startTask(id: string): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.startTask', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.started' });
  return data;
}

/** Thrown when neither completion condition (full checklist, or minimum photo evidence) is met —
 * a "completed" cleaning task must not be able to mean "nothing was actually verified." */
export class CleaningTaskIncompleteError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CleaningTaskIncompleteError';
  }
}

/** Minimum number of "after" photos accepted as evidence when the checklist itself isn't fully
 * ticked — "after" specifically, since those are what prove the finished state (not "before",
 * which only documents the starting condition). A documented judgment call, same pattern as this
 * codebase's other adjustable thresholds (e.g. Finance's HIGH_VALUE_EXPENSE_THRESHOLD_MAD). */
const MIN_COMPLETION_PHOTOS = 1;

export async function completeTask(id: string, notes?: string): Promise<CleaningTaskRow> {
  const { data: current, error: fetchError } = await supabase
    .from('cleaning_tasks')
    .select('checklist')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) {
    logAppError('cleaning-tasks.completeTask (fetch)', fetchError);
    throw fetchError;
  }
  const checklist: ChecklistItem[] =
    Array.isArray(current?.checklist) && (current.checklist as ChecklistItem[]).length > 0
      ? (current.checklist as unknown as ChecklistItem[])
      : CHECKLIST_TEMPLATE;
  const checklistComplete = checklist.length > 0 && checklist.every((item) => item.done);

  if (!checklistComplete) {
    const { count, error: photoError } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('cleaning_task_id', id)
      .eq('category', 'photo_after')
      .is('deleted_at', null);
    if (photoError) {
      logAppError('cleaning-tasks.completeTask (photo count)', photoError);
      throw photoError;
    }
    if ((count ?? 0) < MIN_COMPLETION_PHOTOS) {
      throw new CleaningTaskIncompleteError(
        `Impossible de terminer : cochez tous les éléments de la liste de vérification, ou ajoutez au moins ${MIN_COMPLETION_PHOTOS} photo(s) "après" comme preuve.`
      );
    }
  }

  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString(), notes: notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.completeTask', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.completed' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'cleaning',
    title: 'Ménage terminé',
    body: data.task_number,
    relatedEntityType: 'cleaning_task',
    relatedEntityId: id,
  });
  return data;
}

export async function verifyTask(id: string): Promise<CleaningTaskRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: user?.id ?? null })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.verifyTask', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.verified' });
  return data;
}

export async function cancelTask(id: string): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.cancelTask', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.cancelled' });
  return data;
}

export async function updateChecklist(id: string, checklist: ChecklistItem[]): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({ checklist })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.updateChecklist', error);
    throw error;
  }
  return data;
}

export async function updateTaskDetails(
  id: string,
  input: { scheduledDate: string; estimatedDurationMinutes: number | null; notes?: string }
): Promise<CleaningTaskRow> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .update({
      scheduled_date: input.scheduledDate,
      estimated_duration_minutes: input.estimatedDurationMinutes,
      notes: input.notes || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('cleaning-tasks.updateTaskDetails', error);
    throw error;
  }
  await logActivity({ entityType: 'cleaning_task', entityId: id, action: 'cleaning_task.updated' });
  return data;
}
