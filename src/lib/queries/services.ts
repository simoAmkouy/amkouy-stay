import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ServiceRow = Database['public']['Tables']['services']['Row'];
export type ServiceCategory = Database['public']['Enums']['service_category'];

export async function listServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .is('deleted_at', null)
    .order('category')
    .order('name');
  if (error) {
    logAppError('services.listServices', error);
    throw error;
  }
  return data ?? [];
}

export async function listActiveServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) {
    logAppError('services.listActiveServices', error);
    throw error;
  }
  return data ?? [];
}

export async function getService(id: string): Promise<ServiceRow | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('services.getService', error);
    throw error;
  }
  return data;
}

export type ServiceFormInput = {
  name: string;
  category: ServiceCategory;
  description?: string;
  isActive: boolean;
  requiresProvider: boolean;
  requiresScheduling: boolean;
  defaultPrice: number;
  defaultCost: number;
};

function toPayload(input: ServiceFormInput) {
  return {
    name: input.name,
    category: input.category,
    description: input.description || null,
    is_active: input.isActive,
    requires_provider: input.requiresProvider,
    requires_scheduling: input.requiresScheduling,
    default_price: input.defaultPrice,
    default_cost: input.defaultCost,
  };
}

export async function createService(input: ServiceFormInput): Promise<ServiceRow> {
  const { data, error } = await supabase.from('services').insert(toPayload(input)).select().single();
  if (error) {
    logAppError('services.createService', error);
    throw error;
  }
  await logActivity({ entityType: 'service', entityId: data.id, action: 'service.created' });
  return data;
}

export async function updateService(id: string, input: ServiceFormInput): Promise<ServiceRow> {
  const { data, error } = await supabase.from('services').update(toPayload(input)).eq('id', id).select().single();
  if (error) {
    logAppError('services.updateService', error);
    throw error;
  }
  await logActivity({ entityType: 'service', entityId: id, action: 'service.updated' });
  return data;
}

/** Archive: soft delete, never a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function archiveService(id: string): Promise<void> {
  const { error } = await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    logAppError('services.archiveService', error);
    throw error;
  }
  await logActivity({ entityType: 'service', entityId: id, action: 'service.archived' });
}
