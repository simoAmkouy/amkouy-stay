import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

export type CommercialAgentKpis = {
  propertiesAcquired: number;
  propertiesActivated: number;
  activationRate: number;
  reservationsGenerated: number;
  revenueGenerated: number;
  nightsGenerated: number;
  commissionsPending: number;
  commissionsPaid: number;
  leadsTotal: number;
  leadsWon: number;
  leadsLost: number;
  conversionRate: number;
};

export async function getCommercialAgentKpis(agentId: string, startIso: string, endIso: string): Promise<CommercialAgentKpis> {
  const { data, error } = await supabase.rpc('get_commercial_agent_kpis', { p_agent_id: agentId, p_start: startIso, p_end: endIso });
  if (error) {
    logAppError('commercial-kpis.getCommercialAgentKpis', error);
    throw error;
  }
  const row = data?.[0];
  return {
    propertiesAcquired: row?.properties_acquired ?? 0,
    propertiesActivated: row?.properties_activated ?? 0,
    activationRate: Number(row?.activation_rate ?? 0),
    reservationsGenerated: row?.reservations_generated ?? 0,
    revenueGenerated: Number(row?.revenue_generated ?? 0),
    nightsGenerated: row?.nights_generated ?? 0,
    commissionsPending: Number(row?.commissions_pending ?? 0),
    commissionsPaid: Number(row?.commissions_paid ?? 0),
    leadsTotal: row?.leads_total ?? 0,
    leadsWon: row?.leads_won ?? 0,
    leadsLost: row?.leads_lost ?? 0,
    conversionRate: Number(row?.conversion_rate ?? 0),
  };
}

export type CommercialLeaderboardEntry = {
  agentId: string;
  agentName: string;
  propertiesAcquired: number;
  propertiesActivated: number;
  activationRate: number;
  reservationsGenerated: number;
  revenueGenerated: number;
  nightsGenerated: number;
  commissionsEarned: number;
  leadsWon: number;
  leadsLost: number;
  conversionRate: number;
};

export async function getCommercialLeaderboard(startIso: string, endIso: string): Promise<CommercialLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_commercial_leaderboard', { p_start: startIso, p_end: endIso });
  if (error) {
    logAppError('commercial-kpis.getCommercialLeaderboard', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    agentId: row.agent_id,
    agentName: row.agent_name,
    propertiesAcquired: row.properties_acquired ?? 0,
    propertiesActivated: row.properties_activated ?? 0,
    activationRate: Number(row.activation_rate ?? 0),
    reservationsGenerated: row.reservations_generated ?? 0,
    revenueGenerated: Number(row.revenue_generated ?? 0),
    nightsGenerated: row.nights_generated ?? 0,
    commissionsEarned: Number(row.commissions_earned ?? 0),
    leadsWon: row.leads_won ?? 0,
    leadsLost: row.leads_lost ?? 0,
    conversionRate: Number(row.conversion_rate ?? 0),
  }));
}

export type SourcePerformanceEntry = {
  source: string;
  ownerLeadsCount: number;
  ownerLeadsWon: number;
  guestLeadsCount: number;
  guestLeadsConfirmed: number;
};

export async function getCommercialSourcePerformance(startIso: string, endIso: string): Promise<SourcePerformanceEntry[]> {
  const { data, error } = await supabase.rpc('get_commercial_source_performance', { p_start: startIso, p_end: endIso });
  if (error) {
    logAppError('commercial-kpis.getCommercialSourcePerformance', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    source: row.source,
    ownerLeadsCount: row.owner_leads_count ?? 0,
    ownerLeadsWon: row.owner_leads_won ?? 0,
    guestLeadsCount: row.guest_leads_count ?? 0,
    guestLeadsConfirmed: row.guest_leads_confirmed ?? 0,
  }));
}
