import { z } from 'zod';

import { Database } from '@/types/supabase';

type PaymentMethodType = Database['public']['Enums']['payment_method_type'];
type PaymentType = Database['public']['Enums']['payment_type'];

export const PAYMENT_METHOD_OPTIONS: { label: string; value: PaymentMethodType }[] = [
  { label: 'Espèces', value: 'cash' },
  { label: 'Virement bancaire', value: 'bank_transfer' },
  { label: 'Carte bancaire', value: 'card' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Terminal (POS)', value: 'pos_terminal' },
  { label: 'Passerelle en ligne', value: 'online_gateway' },
];

export const PAYMENT_TYPE_OPTIONS: { label: string; value: Extract<PaymentType, 'deposit_hold' | 'charge'> }[] = [
  { label: 'Acompte', value: 'deposit_hold' },
  { label: 'Solde', value: 'charge' },
];

/** `maxAmount` is the reservation's current outstanding balance at the time the form opens — CB-06
 * (Launch Readiness Audit): a payment could otherwise be recorded far larger than what's actually
 * owed, with no error, polluting every cash-collected/collection-rate figure app-wide. Bound via a
 * factory rather than a fixed constant, mirroring `createRefundSchema` below exactly. */
export function createPaymentSchema(maxAmount: number) {
  return z.object({
    type: z.enum(['deposit_hold', 'charge']),
    amount: z
      .number()
      .positive('Le montant doit être positif.')
      .max(maxAmount, `Le montant ne peut pas dépasser le solde restant dû (${maxAmount} MAD).`),
    method: z.enum(PAYMENT_METHOD_OPTIONS.map((o) => o.value) as [PaymentMethodType, ...PaymentMethodType[]], {
      message: 'Sélectionnez un moyen de paiement.',
    }),
    gatewayReference: z.string().trim().optional(),
  });
}

export type PaymentFormValues = z.infer<ReturnType<typeof createPaymentSchema>>;

/** `maxRefundable` is the reservation's current net-collected amount at the time the form opens
 * — Zod schemas are static, so the "refund <= paid amount" rule is bound via a factory rather
 * than a fixed constant, matching how amount limits vary per reservation. */
export function createRefundSchema(maxRefundable: number) {
  return z.object({
    amount: z
      .number()
      .positive('Le montant doit être positif.')
      .max(maxRefundable, `Le remboursement ne peut pas dépasser le montant encaissé (${maxRefundable} MAD).`),
    isDepositRelease: z.boolean(),
    method: z.enum(PAYMENT_METHOD_OPTIONS.map((o) => o.value) as [PaymentMethodType, ...PaymentMethodType[]], {
      message: 'Sélectionnez un moyen de paiement.',
    }),
    notes: z.string().trim().optional(),
  });
}

export type RefundFormValues = z.infer<ReturnType<typeof createRefundSchema>>;
