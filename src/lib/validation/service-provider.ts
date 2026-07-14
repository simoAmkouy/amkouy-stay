import { z } from 'zod';

import { Database } from '@/types/supabase';
import { SERVICE_CATEGORY_OPTIONS } from '@/lib/validation/service-catalog';

type ProviderStatus = Database['public']['Enums']['provider_status'];
type ServiceCategory = Database['public']['Enums']['service_category'];

export { SERVICE_CATEGORY_OPTIONS };

export const PROVIDER_STATUS_OPTIONS: { label: string; value: ProviderStatus }[] = [
  { label: 'Actif', value: 'active' },
  { label: 'Inactif', value: 'inactive' },
  { label: 'Suspendu', value: 'suspended' },
];

export const serviceProviderFormSchema = z.object({
  name: z.string().trim().min(2, 'Le nom du prestataire est requis.'),
  companyName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('E-mail invalide.').optional().or(z.literal('')),
  serviceCategories: z.array(
    z.enum(SERVICE_CATEGORY_OPTIONS.map((o) => o.value) as [ServiceCategory, ...ServiceCategory[]])
  ),
  pricingAgreement: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  status: z.enum(PROVIDER_STATUS_OPTIONS.map((o) => o.value) as [ProviderStatus, ...ProviderStatus[]]),
});

export type ServiceProviderFormValues = z.infer<typeof serviceProviderFormSchema>;
