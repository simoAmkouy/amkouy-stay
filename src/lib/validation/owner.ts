import { z } from 'zod';

export const ownerFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom est requis (2 caractères minimum).'),
  companyName: z.string().trim().optional(),
  email: z
    .union([z.literal(''), z.string().trim().email('Adresse e-mail invalide.')])
    .optional(),
  phone: z
    .string()
    .trim()
    .min(6, 'Numéro de téléphone invalide.')
    .max(20, 'Le numéro de téléphone ne doit pas dépasser 20 caractères.')
    .optional()
    .or(z.literal('')),
  status: z.enum(['prospect', 'active', 'inactive']),
  bankName: z.string().trim().optional(),
  bankIban: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type OwnerFormValues = z.infer<typeof ownerFormSchema>;

export const OWNER_STATUS_OPTIONS = [
  { label: 'Prospect', value: 'prospect' },
  { label: 'Actif', value: 'active' },
  { label: 'Inactif', value: 'inactive' },
];
