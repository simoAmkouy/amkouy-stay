import { useQuery } from '@tanstack/react-query';

import * as kpisApi from '@/lib/queries/commercial-kpis';

const KEY = ['commercial-kpis'] as const;

export function useCommercialAgentKpis(agentId: string | undefined, startIso: string, endIso: string) {
  return useQuery({
    queryKey: [...KEY, 'agent', agentId, startIso, endIso],
    queryFn: () => kpisApi.getCommercialAgentKpis(agentId as string, startIso, endIso),
    enabled: !!agentId,
  });
}

export function useCommercialLeaderboard(startIso: string, endIso: string) {
  return useQuery({
    queryKey: [...KEY, 'leaderboard', startIso, endIso],
    queryFn: () => kpisApi.getCommercialLeaderboard(startIso, endIso),
  });
}

export function useCommercialSourcePerformance(startIso: string, endIso: string) {
  return useQuery({
    queryKey: [...KEY, 'sources', startIso, endIso],
    queryFn: () => kpisApi.getCommercialSourcePerformance(startIso, endIso),
  });
}
