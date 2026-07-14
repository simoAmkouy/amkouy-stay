import { z } from 'zod';

import { Database } from '@/types/supabase';

type ReservationServiceStatus = Database['public']['Enums']['reservation_service_status'];

export const SERVICE_STATUS_OPTIONS: { label: string; value: ReservationServiceStatus }[] = [
  { label: 'Demandé', value: 'offered' },
  { label: 'Confirmé', value: 'accepted' },
  { label: 'Planifié', value: 'scheduled' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Terminé', value: 'delivered' },
  { label: 'Annulé', value: 'cancelled' },
  { label: 'Remboursé', value: 'refunded' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const reservationServiceFormSchema = z.object({
  serviceId: z.string().uuid('Sélectionnez un service.'),
  providerId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1, 'Doit être au moins 1.').max(50, 'Doit être au plus 50.'),
  unitPrice: z.number().min(0, 'Le prix doit être positif.'),
  costAmount: z.number().min(0, 'Doit être positif.').nullable(),
  status: z.enum(SERVICE_STATUS_OPTIONS.map((o) => o.value) as [ReservationServiceStatus, ...ReservationServiceStatus[]]),
  scheduledDate: z.union([isoDate, z.literal('')]).optional(),
  scheduledTime: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type ReservationServiceFormValues = z.infer<typeof reservationServiceFormSchema>;

export const scheduleServiceSchema = z.object({
  scheduledDate: isoDate,
  scheduledTime: z.string().trim().optional(),
});

export type ScheduleServiceValues = z.infer<typeof scheduleServiceSchema>;

export const assignServiceProviderSchema = z.object({
  providerId: z.string().uuid('Sélectionnez un prestataire.'),
});

export type AssignServiceProviderValues = z.infer<typeof assignServiceProviderSchema>;
