import { z } from 'zod';

import { Database } from '@/types/supabase';

type PayoutMethod = Database['public']['Enums']['payout_method'];

export const PAYOUT_METHOD_OPTIONS = [
  { label: 'Virement bancaire', value: 'bank_transfer' },
  { label: 'Chèque', value: 'check' },
  { label: 'Espèces', value: 'cash' },
];

/** Display-only status filters — "upcoming/due/overdue" are computed, never stored. */
export const DISPLAY_STATUS_OPTIONS = [
  { label: 'À venir', value: 'upcoming' },
  { label: "Aujourd'hui", value: 'due' },
  { label: 'En retard', value: 'overdue' },
  { label: 'Approuvé', value: 'approved' },
  { label: 'Payé', value: 'paid' },
  { label: 'Annulé', value: 'cancelled' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

/**
 * Financial Truth Remediation, Phase 2: creating a settlement no longer accepts typed financial
 * values — the caller only picks WHICH property/period/due-date/payment-method to generate a
 * settlement for; gross_revenue/expenses/commission/net_amount are always computed fresh from
 * compute_owner_settlement() (see owner-payments.ts's `previewOwnerSettlement`/`createOwnerPayment`).
 */
export const ownerPaymentCreateSchema = z
  .object({
    propertyId: z.string().uuid('Sélectionnez un bien.'),
    periodStart: isoDate,
    periodEnd: isoDate,
    dueDate: isoDate,
    paymentMethod: z
      .enum(PAYOUT_METHOD_OPTIONS.map((o) => o.value) as [PayoutMethod, ...PayoutMethod[]])
      .nullable(),
    paymentReference: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: 'La fin de période doit être après le début.',
    path: ['periodEnd'],
  });

export type OwnerPaymentCreateValues = z.infer<typeof ownerPaymentCreateSchema>;

/** Financial Truth Remediation, Phase 2: editing an existing (still-pending) settlement is
 * restricted to non-financial metadata — property, period, and every financial figure are fixed
 * at creation time (matches the DB trigger that already freezes them once a payment leaves
 * 'pending'; this closes the same gap while it's still pending). */
export const ownerPaymentMetadataSchema = z.object({
  dueDate: isoDate,
  paymentMethod: z
    .enum(PAYOUT_METHOD_OPTIONS.map((o) => o.value) as [PayoutMethod, ...PayoutMethod[]])
    .nullable(),
  paymentReference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type OwnerPaymentMetadataValues = z.infer<typeof ownerPaymentMetadataSchema>;

/** CB-09 (Launch Readiness Audit): a real ledger debit is posted the moment this is submitted —
 * `paymentReference` must no longer be left blank, or there is zero proof of the actual transfer
 * to reconcile against if the owner ever disputes non-receipt. */
export const markAsPaidSchema = z.object({
  paidAt: isoDate,
  paymentMethod: z.enum(PAYOUT_METHOD_OPTIONS.map((o) => o.value) as [PayoutMethod, ...PayoutMethod[]], {
    message: 'Sélectionnez un moyen de paiement.',
  }),
  paymentReference: z.string().trim().min(1, 'Une référence de paiement est requise.'),
});

export type MarkAsPaidValues = z.infer<typeof markAsPaidSchema>;

export const generateSettlementsSchema = z
  .object({
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: 'La fin de période doit être après le début.',
    path: ['periodEnd'],
  });

export type GenerateSettlementsValues = z.infer<typeof generateSettlementsSchema>;
