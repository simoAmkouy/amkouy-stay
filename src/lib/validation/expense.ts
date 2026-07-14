import { z } from 'zod';

import { Database } from '@/types/supabase';

type ExpenseCategory = Database['public']['Enums']['expense_category'];
type ExpenseStatus = Database['public']['Enums']['expense_status'];
type PaymentMethodType = Database['public']['Enums']['payment_method_type'];

export const EXPENSE_CATEGORY_OPTIONS = [
  { label: 'Ménage', value: 'cleaning' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Charges (eau/élec.)', value: 'utilities' },
  { label: 'Internet', value: 'internet' },
  { label: 'Fournitures', value: 'supplies' },
  { label: 'Taxes', value: 'tax' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Transport', value: 'transportation' },
  { label: 'Services de conciergerie', value: 'concierge_services' },
  { label: 'Commission plateforme', value: 'platform_commission' },
  { label: 'Assurance', value: 'insurance' },
  { label: 'Autre', value: 'other' },
];

export const EXPENSE_STATUS_OPTIONS = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Approuvée', value: 'approved' },
  { label: 'Payée', value: 'paid' },
  { label: 'Annulée', value: 'cancelled' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Carte', value: 'card' },
  { label: 'Virement bancaire', value: 'bank_transfer' },
  { label: 'Espèces', value: 'cash' },
  { label: 'Passerelle en ligne', value: 'online_gateway' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_OPTIONS.map((o) => o.value) as [ExpenseCategory, ...ExpenseCategory[]], {
    message: 'Sélectionnez une catégorie.',
  }),
  description: z.string().trim().min(2, 'La description est requise.'),
  propertyId: z.string().uuid().nullable(),
  reservationId: z.string().uuid().nullable(),
  ownerId: z.string().uuid().nullable(),
  amount: z.number().positive('Le montant doit être positif.'),
  expenseDate: isoDate,
  vendorName: z.string().trim().optional(),
  paymentMethod: z
    .enum(PAYMENT_METHOD_OPTIONS.map((o) => o.value) as [PaymentMethodType, ...PaymentMethodType[]])
    .nullable(),
  notes: z.string().trim().optional(),
  status: z.enum(EXPENSE_STATUS_OPTIONS.map((o) => o.value) as [ExpenseStatus, ...ExpenseStatus[]]),
  receiptPath: z.string().nullable().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
