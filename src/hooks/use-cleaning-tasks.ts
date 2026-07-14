import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as cleaningTasksApi from '@/lib/queries/cleaning-tasks';
import * as documentsApi from '@/lib/queries/documents';
import * as usersApi from '@/lib/queries/users';

const KEY = ['cleaning-tasks'] as const;

export function useCleaningTasks(filters: cleaningTasksApi.CleaningTaskListFilters = {}) {
  const { statuses, propertyId } = filters;
  return useQuery({
    queryKey: [...KEY, 'list', statuses ?? [], propertyId ?? null],
    queryFn: () => cleaningTasksApi.listCleaningTasks(filters),
  });
}

export function useCleaningTask(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => cleaningTasksApi.getCleaningTask(id as string),
    enabled: !!id,
  });
}

export function useCleaners() {
  return useQuery({ queryKey: ['users', 'cleaner'], queryFn: () => usersApi.listUsersByRole('cleaner') });
}

export function useCreateCleaningTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof cleaningTasksApi.createCleaningTask>[0]) =>
      cleaningTasksApi.createCleaningTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

function invalidateTask(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: KEY });
  queryClient.invalidateQueries({ queryKey: [...KEY, id] });
}

export function useAssignCleaner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => cleaningTasksApi.assignCleaner(id, userId),
    onSuccess: (_data, variables) => invalidateTask(queryClient, variables.id),
  });
}

export function useStartTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cleaningTasksApi.startTask(id),
    onSuccess: (_data, id) => invalidateTask(queryClient, id),
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => cleaningTasksApi.completeTask(id, notes),
    onSuccess: (_data, variables) => invalidateTask(queryClient, variables.id),
  });
}

export function useVerifyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cleaningTasksApi.verifyTask(id),
    onSuccess: (_data, id) => invalidateTask(queryClient, id),
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cleaningTasksApi.cancelTask(id),
    onSuccess: (_data, id) => invalidateTask(queryClient, id),
  });
}

export function useUpdateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checklist }: { id: string; checklist: cleaningTasksApi.ChecklistItem[] }) =>
      cleaningTasksApi.updateChecklist(id, checklist),
    onSuccess: (_data, variables) => invalidateTask(queryClient, variables.id),
  });
}

export function useUpdateTaskDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { scheduledDate: string; estimatedDurationMinutes: number | null; notes?: string };
    }) => cleaningTasksApi.updateTaskDetails(id, input),
    onSuccess: (_data, variables) => invalidateTask(queryClient, variables.id),
  });
}

export function useCleaningTaskPhotos(cleaningTaskId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'cleaning-task', cleaningTaskId],
    queryFn: () => documentsApi.listDocumentsForCleaningTask(cleaningTaskId as string),
    enabled: !!cleaningTaskId,
  });
}

export function useUploadCleaningPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof documentsApi.uploadCleaningPhoto>[0]) =>
      documentsApi.uploadCleaningPhoto(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'cleaning-task', variables.cleaningTaskId] });
    },
  });
}
