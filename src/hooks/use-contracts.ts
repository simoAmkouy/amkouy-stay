import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as contractsApi from '@/lib/queries/contracts';
import * as documentsApi from '@/lib/queries/documents';

const KEY = ['contracts'] as const;

export function useContracts() {
  return useQuery({ queryKey: KEY, queryFn: contractsApi.listContracts });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => contractsApi.getContract(id as string),
    enabled: !!id,
  });
}

function invalidateContract(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: KEY });
  queryClient.invalidateQueries({ queryKey: [...KEY, id] });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: contractsApi.ContractFormInput) => contractsApi.createContract(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: contractsApi.ContractFormInput }) =>
      contractsApi.updateContract(id, input),
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.id),
  });
}

export function useActivateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.activateContract(id),
    onSuccess: (_data, id) => invalidateContract(queryClient, id),
  });
}

export function useTerminateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.terminateContract(id),
    onSuccess: (_data, id) => invalidateContract(queryClient, id),
  });
}

/** Fire-and-forget: call once contracts have loaded on the Contracts list / Operations Center,
 * staff-only (see contracts.ts). Not a query — it's a side effect, so it's a mutation with no UI
 * loading state tied to it. */
export function useSyncContractExpiryNotifications() {
  return useMutation({
    mutationFn: (contracts: contractsApi.ContractWithRelations[]) =>
      contractsApi.syncContractExpiryNotifications(contracts),
  });
}

/** Owner Portal only — see the column-restricted comment on `listMyContracts` in contracts.ts. */
export function useMyContracts() {
  return useQuery({ queryKey: [...KEY, 'mine'], queryFn: contractsApi.listMyContracts });
}

export function useContractDocuments(contractId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'contract', contractId],
    queryFn: () => documentsApi.listDocumentsForContract(contractId as string),
    enabled: !!contractId,
  });
}

export function useUploadContractDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof documentsApi.uploadContractDocument>[0]) =>
      documentsApi.uploadContractDocument(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'contract', variables.contractId] });
    },
  });
}
