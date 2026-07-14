import { z } from 'zod';

export const propertyFormSchema = z.object({
  name: z.string().trim().min(2, 'Le nom est requis (2 caractères minimum).'),
  propertyType: z.enum(['villa', 'riad', 'apartment', 'studio', 'other']),
  status: z.enum(['onboarding', 'active', 'maintenance', 'inactive', 'archived']),
  city: z.string().trim().min(2, 'La ville est requise.'),
  addressLine: z.string().trim().optional(),
  bedrooms: z.number().int().min(0, 'Doit être positif.').max(50).optional(),
  bathrooms: z.number().int().min(0, 'Doit être positif.').max(50).optional(),
  maxGuests: z.number().int().min(1, 'Doit être au moins 1.').max(100).optional(),
  baseNightlyRate: z.number().min(0, 'Le tarif doit être positif.').optional(),
  cleaningFee: z.number().min(0, 'Les frais de ménage doivent être positifs.'),
  ownerId: z.string().uuid().nullable(),
  assignedManagerId: z.string().uuid().nullable(),
  defaultCleanerId: z.string().uuid().nullable(),
  acquiredByAgent: z.string().uuid().nullable(),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const PROPERTY_TYPE_OPTIONS = [
  { label: 'Villa', value: 'villa' },
  { label: 'Riad', value: 'riad' },
  { label: 'Appartement', value: 'apartment' },
  { label: 'Studio', value: 'studio' },
  { label: 'Autre', value: 'other' },
];

export const PROPERTY_STATUS_OPTIONS: { label: string; value: PropertyFormValues['status'] }[] = [
  { label: 'Onboarding', value: 'onboarding' },
  { label: 'Actif', value: 'active' },
  { label: 'En maintenance', value: 'maintenance' },
  { label: 'Inactif', value: 'inactive' },
  { label: 'Archivé', value: 'archived' },
];
