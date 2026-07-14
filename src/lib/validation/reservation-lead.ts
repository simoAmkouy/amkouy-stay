import { z } from 'zod';

import { Database } from '@/types/supabase';

type ReservationLeadStatus = Database['public']['Enums']['reservation_lead_status'];

export const RESERVATION_LEAD_STATUS_OPTIONS: { label: string; value: ReservationLeadStatus }[] = [
  { label: 'Nouveau', value: 'new' },
  { label: 'Offre envoyée', value: 'offer_sent' },
  { label: 'Négociation', value: 'negotiation' },
  { label: 'Confirmé', value: 'confirmed' },
  { label: 'Annulé', value: 'cancelled' },
];

export const reservationLeadFormSchema = z
  .object({
    guestName: z.string().trim().min(2, 'Nom requis.'),
    phone: z.string().trim().optional(),
    email: z.string().trim().email('Email invalide.').optional().or(z.literal('')),
    checkIn: z.string().trim().optional(),
    checkOut: z.string().trim().optional(),
    guestsCount: z.number().int().min(1).nullable().optional(),
    propertyId: z.string().uuid().nullable().optional(),
    source: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !data.checkIn || !data.checkOut || data.checkOut > data.checkIn, {
    message: 'La date de départ doit être après la date d’arrivée.',
    path: ['checkOut'],
  });

export type ReservationLeadFormValues = z.infer<typeof reservationLeadFormSchema>;
