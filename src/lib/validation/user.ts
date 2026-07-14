import { z } from 'zod';

// `super_admin` is intentionally excluded from the assignable list here — it's the platform's
// highest privilege level and granting it should never be a casual dropdown choice on a general
// Team Management screen. The enum value still exists and is fully supported everywhere else;
// this is a UI-level caution, not a schema restriction.
export const ASSIGNABLE_ROLE_OPTIONS = [
  { label: 'Administrateur', value: 'admin' },
  { label: "Responsable d'exploitation", value: 'manager' },
  { label: 'Comptable', value: 'accountant' },
  { label: 'Agent commercial', value: 'commercial_agent' },
  { label: 'Agent de ménage', value: 'cleaner' },
  { label: 'Technicien', value: 'technician' },
  { label: 'Propriétaire', value: 'owner' },
];

export const userFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom est requis (2 caractères minimum).'),
  email: z.string().trim().email('E-mail invalide.'),
  phone: z.string().trim().optional(),
  role: z.enum(['admin', 'manager', 'accountant', 'commercial_agent', 'cleaner', 'technician', 'owner']),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
