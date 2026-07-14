import { z } from 'zod';

import { Database } from '@/types/supabase';

type LeadStatus = Database['public']['Enums']['lead_status'];

export const LEAD_STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'Nouveau', value: 'new' },
  { label: 'Contacté', value: 'contacted' },
  { label: 'Visite planifiée', value: 'visit_scheduled' },
  { label: 'Proposition envoyée', value: 'proposal_sent' },
  { label: 'Négociation', value: 'negotiation' },
  { label: 'Gagné', value: 'won' },
  { label: 'Perdu', value: 'lost' },
];

/** Free-form, not an enum (matches services.category's reasoning) — a new marketing channel
 * should never need a migration. This is just the suggested/common set shown in the picker. */
export const LEAD_SOURCE_SUGGESTIONS = ['Facebook', 'Instagram', 'Référence', 'Site web', 'WhatsApp', 'Salon immobilier', 'Autre'];

export const commercialLeadFormSchema = z.object({
  ownerName: z.string().trim().min(2, 'Nom requis.'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Email invalide.').optional().or(z.literal('')),
  source: z.string().trim().optional(),
  propertyType: z.enum(['villa', 'riad', 'apartment', 'studio', 'other']).nullable().optional(),
  city: z.string().trim().optional(),
  estimatedUnits: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export type CommercialLeadFormValues = z.infer<typeof commercialLeadFormSchema>;
