import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as activationApi from '@/lib/queries/property-activation';
import * as documentsApi from '@/lib/queries/documents';

const KEY = ['property-activation'] as const;

export function usePropertyActivationStatus(propertyId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'status', propertyId],
    queryFn: () => activationApi.getPropertyActivationStatus(propertyId as string),
    enabled: !!propertyId,
  });
}

export function useActivationCenterSummary() {
  return useQuery({ queryKey: [...KEY, 'center'], queryFn: activationApi.getActivationCenterSummary });
}

export function useSyncStaleOnboardingNotifications() {
  return useMutation({
    mutationFn: (properties: activationApi.ActivationCenterEntry[]) => activationApi.syncStaleOnboardingNotifications(properties),
  });
}

export function useOnboardingDashboardMetrics(startIso: string, endIso: string) {
  return useQuery({
    queryKey: [...KEY, 'dashboard', startIso, endIso],
    queryFn: () => activationApi.getOnboardingDashboardMetrics(startIso, endIso),
  });
}

export function useActivationFunnelReport(startIso: string, endIso: string, agentId?: string, propertyType?: string) {
  return useQuery({
    queryKey: [...KEY, 'funnel', startIso, endIso, agentId, propertyType],
    queryFn: () => activationApi.getActivationFunnelReport(startIso, endIso, agentId, propertyType),
  });
}

export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'property-photos', propertyId],
    queryFn: () => documentsApi.listPropertyPhotos(propertyId as string),
    enabled: !!propertyId,
  });
}

function invalidateProperty(queryClient: ReturnType<typeof useQueryClient>, propertyId: string) {
  queryClient.invalidateQueries({ queryKey: [...KEY, 'status', propertyId] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'center'] });
  queryClient.invalidateQueries({ queryKey: ['documents', 'property-photos', propertyId] });
  queryClient.invalidateQueries({ queryKey: ['properties'] });
  queryClient.invalidateQueries({ queryKey: ['properties', propertyId] });
}

export function useUploadPropertyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof documentsApi.uploadPropertyPhoto>[0]) => documentsApi.uploadPropertyPhoto(params),
    onSuccess: (_data, variables) => invalidateProperty(queryClient, variables.propertyId),
  });
}

export function useDeletePropertyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, propertyId }: { documentId: string; propertyId: string }) => documentsApi.deletePropertyPhoto(documentId),
    onSuccess: (_data, variables) => invalidateProperty(queryClient, variables.propertyId),
  });
}

export function useUpdatePropertySetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: activationApi.PropertySetupInput }) => activationApi.updatePropertySetup(id, input),
    onSuccess: (_data, variables) => invalidateProperty(queryClient, variables.id),
  });
}

export function useUpdatePropertyPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: activationApi.PropertyPricingInput }) => activationApi.updatePropertyPricing(id, input),
    onSuccess: (_data, variables) => invalidateProperty(queryClient, variables.id),
  });
}

export function useActivateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => activationApi.activateProperty(id, name),
    onSuccess: (_data, variables) => invalidateProperty(queryClient, variables.id),
  });
}
