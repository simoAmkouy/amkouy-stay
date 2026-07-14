import { z } from 'zod';

import { Database } from '@/types/supabase';

type PayoutSchedule = Database['public']['Enums']['payout_schedule'];
type ContractStatus = Database['public']['Enums']['contract_status'];

export const PAYOUT_SCHEDULE_OPTIONS = [
  { label: 'Hebdomadaire', value: 'weekly' },
  { label: 'Bimensuel', value: 'biweekly' },
  { label: 'Mensuel', value: 'monthly' },
];

/** Stored lifecycle is deliberately 3-state only (Phase 3) — Expiring Soon/Expired are
 * computed at read time from `end_date`, never stored as a status. */
export const CONTRACT_STATUS_OPTIONS = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Actif', value: 'active' },
  { label: 'Résilié', value: 'terminated' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const contractFormSchema = z
  .object({
    ownerId: z.string().uuid('Sélectionnez un propriétaire.'),
    propertyId: z.string().uuid('Sélectionnez un bien.'),
    commissionPct: z.number().min(0, 'Doit être positif.').max(100, 'Doit être entre 0 et 100.'),
    payoutSchedule: z.enum(PAYOUT_SCHEDULE_OPTIONS.map((o) => o.value) as [PayoutSchedule, ...PayoutSchedule[]]),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    autoRenew: z.boolean(),
    terms: z.string().trim().optional(),
  })
  .refine((data) => !data.endDate || data.endDate > data.startDate, {
    message: 'La date de fin doit être après la date de début.',
    path: ['endDate'],
  });

export type ContractFormValues = z.infer<typeof contractFormSchema>;
export type { ContractStatus };
