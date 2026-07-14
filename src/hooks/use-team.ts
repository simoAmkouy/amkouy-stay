import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listActivityForUser } from '@/lib/queries/activity-log';
import * as teamApi from '@/lib/queries/team';
import * as usersApi from '@/lib/queries/users';
import { UserRole } from '@/lib/queries/users';

const KEY = ['team'] as const;

export function useAllUsers() {
  return useQuery({ queryKey: [...KEY, 'all-users'], queryFn: usersApi.listAllUsers });
}

export function useUser(id: string | undefined) {
  return useQuery({ queryKey: [...KEY, 'user', id], queryFn: () => usersApi.getUser(id as string), enabled: !!id });
}

export function useUserActivity(id: string | undefined) {
  return useQuery({ queryKey: [...KEY, 'activity', id], queryFn: () => listActivityForUser(id as string), enabled: !!id });
}

export function useCleanerStats(userId: string | undefined, todayStr: string) {
  return useQuery({
    queryKey: [...KEY, 'cleaner-stats', userId, todayStr],
    queryFn: () => teamApi.getCleanerStats(userId as string, todayStr),
    enabled: !!userId,
  });
}

export function useTechnicianStats(userId: string | undefined) {
  return useQuery({ queryKey: [...KEY, 'technician-stats', userId], queryFn: () => teamApi.getTechnicianStats(userId as string), enabled: !!userId });
}

export function useManagerStats(todayStr: string, enabled = true) {
  return useQuery({ queryKey: [...KEY, 'manager-stats', todayStr], queryFn: () => teamApi.getManagerStats(todayStr), enabled });
}

export function useAccountantStats(userId: string | undefined) {
  return useQuery({ queryKey: [...KEY, 'accountant-stats', userId], queryFn: () => teamApi.getAccountantStats(userId as string), enabled: !!userId });
}

export function useOwnerStats(userId: string | undefined) {
  return useQuery({ queryKey: [...KEY, 'owner-stats', userId], queryFn: () => teamApi.getOwnerStats(userId as string), enabled: !!userId });
}

export function useTeamAlerts(users: { id: string; full_name: string; role: string }[] | undefined, todayStr: string) {
  return useQuery({
    queryKey: [...KEY, 'alerts', (users ?? []).map((u) => u.id).join(','), todayStr],
    queryFn: () => teamApi.getTeamAlerts(users ?? [], todayStr),
    enabled: !!users && users.length > 0,
  });
}

function invalidateTeam(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: [...KEY, 'all-users'] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'user', id] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'activity', id] });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.setUserActive(id, isActive),
    onSuccess: (_data, variables) => invalidateTeam(queryClient, variables.id),
  });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => usersApi.changeUserRole(id, role),
    onSuccess: (_data, variables) => invalidateTeam(queryClient, variables.id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'all-users'] }),
  });
}
