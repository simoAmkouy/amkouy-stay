import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ServiceProviderRow = Database['public']['Tables']['service_providers']['Row'];
export type ProviderStatus = Database['public']['Enums']['provider_status'];
export type ServiceCategory = Database['public']['Enums']['service_category'];

export async function listServiceProviders(): Promise<ServiceProviderRow[]> {
  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) {
    logAppError('service-providers.listServiceProviders', error);
    throw error;
  }
  return data ?? [];
}

export async function getServiceProvider(id: string): Promise<ServiceProviderRow | null> {
  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('service-providers.getServiceProvider', error);
    throw error;
  }
  return data;
}

export type ServiceProviderFormInput = {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  serviceCategories: ServiceCategory[];
  pricingAgreement?: string;
  internalNotes?: string;
  status: ProviderStatus;
};

function toPayload(input: ServiceProviderFormInput) {
  return {
    name: input.name,
    company_name: input.companyName || null,
    phone: input.phone || null,
    email: input.email || null,
    service_categories: input.serviceCategories,
    pricing_agreement: input.pricingAgreement || null,
    internal_notes: input.internalNotes || null,
    status: input.status,
  };
}

export async function createServiceProvider(input: ServiceProviderFormInput): Promise<ServiceProviderRow> {
  const { data, error } = await supabase.from('service_providers').insert(toPayload(input)).select().single();
  if (error) {
    logAppError('service-providers.createServiceProvider', error);
    throw error;
  }
  await logActivity({ entityType: 'service_provider', entityId: data.id, action: 'service_provider.created' });
  return data;
}

export async function updateServiceProvider(id: string, input: ServiceProviderFormInput): Promise<ServiceProviderRow> {
  const { data, error } = await supabase
    .from('service_providers')
    .update(toPayload(input))
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('service-providers.updateServiceProvider', error);
    throw error;
  }
  await logActivity({ entityType: 'service_provider', entityId: id, action: 'service_provider.updated' });
  return data;
}

/** Archive: soft delete, never a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function archiveServiceProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('service_providers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logAppError('service-providers.archiveServiceProvider', error);
    throw error;
  }
  await logActivity({ entityType: 'service_provider', entityId: id, action: 'service_provider.archived' });
}

export type ProviderKpis = {
  servicesDeliveredCount: number;
  revenueGenerated: number;
  costGenerated: number;
  profitGenerated: number;
  averageCompletionDays: number | null;
  completionRate: number | null; // 0-100, delivered / (delivered + cancelled)
};

/**
 * KPIs read from `reservation_services` — revenue/cost/profit come straight from the stored
 * `total_price`/`cost_amount`/`profit` columns (profit is a generated column, never recomputed
 * here), so these numbers can never drift from what's actually stored for reporting.
 */
export async function getProviderKpis(providerId: string): Promise<ProviderKpis> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select('total_price, cost_amount, profit, requested_date, completion_date, status')
    .eq('provider_id', providerId)
    .is('deleted_at', null);
  if (error) {
    logAppError('service-providers.getProviderKpis', error);
    throw error;
  }
  const rows = data ?? [];
  const delivered = rows.filter((r) => r.status === 'delivered');
  const cancelled = rows.filter((r) => r.status === 'cancelled');
  const revenueGenerated = delivered.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
  const costGenerated = delivered.reduce((sum, r) => sum + (r.cost_amount ?? 0), 0);
  const profitGenerated = delivered.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  const completionDurations = delivered
    .filter((r) => r.completion_date && r.requested_date)
    .map((r) => (new Date(r.completion_date as string).getTime() - new Date(r.requested_date).getTime()) / 86_400_000);
  const completionDenominator = delivered.length + cancelled.length;

  return {
    servicesDeliveredCount: delivered.length,
    revenueGenerated,
    costGenerated,
    profitGenerated,
    averageCompletionDays:
      completionDurations.length > 0
        ? completionDurations.reduce((sum, d) => sum + d, 0) / completionDurations.length
        : null,
    completionRate: completionDenominator > 0 ? (delivered.length / completionDenominator) * 100 : null,
  };
}
