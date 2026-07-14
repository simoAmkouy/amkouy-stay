import { z } from 'zod';

import { Database } from '@/types/supabase';

type ServiceCategory = Database['public']['Enums']['service_category'];

export const SERVICE_CATEGORY_OPTIONS: { label: string; value: ServiceCategory }[] = [
  { label: 'Transport', value: 'transport' },
  { label: 'Hospitalité', value: 'hospitality' },
  { label: 'Expériences', value: 'experiences' },
  { label: 'Premium', value: 'premium' },
  { label: 'Personnalisé', value: 'custom' },
];

export const serviceCatalogFormSchema = z.object({
  name: z.string().trim().min(2, 'Le nom du service est requis.'),
  category: z.enum(SERVICE_CATEGORY_OPTIONS.map((o) => o.value) as [ServiceCategory, ...ServiceCategory[]], {
    message: 'Sélectionnez une catégorie.',
  }),
  description: z.string().trim().optional(),
  isActive: z.boolean(),
  requiresProvider: z.boolean(),
  requiresScheduling: z.boolean(),
  defaultPrice: z.number().min(0, 'Doit être positif.'),
  defaultCost: z.number().min(0, 'Doit être positif.'),
});

export type ServiceCatalogFormValues = z.infer<typeof serviceCatalogFormSchema>;
