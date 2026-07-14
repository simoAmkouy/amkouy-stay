import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type CommissionRow = Database['public']['Tables']['commercial_commissions']['Row'];
export type CommissionType = Database['public']['Enums']['commission_type'];
export type CommissionStatus = Database['public']['Enums']['commission_status'];

export type CommissionWithRelations = CommissionRow & {
  agent: { id: string; full_name: string } | null;
};

const SELECT = '*, agent:users!commercial_commissions_agent_id_fkey(id, full_name)';

/** Staff/finance see everyone's commissions; an agent sees only their own — enforced by RLS. */
export async function listCommissions(): Promise<CommissionWithRelations[]> {
  const { data, error } = await supabase.from('commercial_commissions').select(SELECT).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) {
    logAppError('commercial-commissions.listCommissions', error);
    throw error;
  }
  return (data ?? []) as unknown as CommissionWithRelations[];
}

export type CommissionInput = {
  agentId: string;
  commissionType: CommissionType;
  leadId?: string | null;
  reservationId?: string | null;
  propertyId?: string | null;
  amount: number;
  notes?: string;
};

/** Staff/finance only (commercial_commissions_insert RLS) — an agent can never award themselves
 * a commission, only view ones already created for them. */
export async function createCommission(input: CommissionInput): Promise<CommissionRow> {
  const { data, error } = await supabase
    .from('commercial_commissions')
    .insert({
      agent_id: input.agentId,
      commission_type: input.commissionType,
      lead_id: input.leadId ?? null,
      reservation_id: input.reservationId ?? null,
      property_id: input.propertyId ?? null,
      amount: input.amount,
      notes: input.notes || null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) {
    logAppError('commercial-commissions.createCommission', error);
    throw error;
  }
  await logActivity({ entityType: 'commercial_commission', entityId: data.id, action: 'commercial_commission.created' });
  return data;
}

export async function updateCommissionStatus(id: string, status: CommissionStatus): Promise<CommissionRow> {
  const { data, error } = await supabase.from('commercial_commissions').update({ status }).eq('id', id).select().single();
  if (error) {
    logAppError('commercial-commissions.updateCommissionStatus', error);
    throw error;
  }
  await logActivity({ entityType: 'commercial_commission', entityId: id, action: `commercial_commission.${status}` });
  if (status === 'approved' || status === 'paid') {
    await notifyUsers({
      userIds: [data.agent_id],
      type: 'commercial',
      title: status === 'approved' ? 'Commission approuvée' : 'Commission payée',
      body: `${data.amount} MAD`,
      relatedEntityType: 'commercial_commission',
      relatedEntityId: id,
    });
  }
  return data;
}
