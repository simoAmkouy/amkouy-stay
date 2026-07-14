import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const reservationFormSchema = z
  .object({
    propertyId: z.string().uuid('Sélectionnez un bien.'),
    channelId: z.string().uuid('Sélectionnez un canal.'),
    guestName: z.string().trim().min(2, 'Le nom du client est requis.'),
    guestPhone: z
      .string()
      .trim()
      .min(6, 'Numéro de téléphone invalide.')
      .max(20, 'Le numéro de téléphone ne doit pas dépasser 20 caractères.'),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    nightlyRate: z.number().positive('Le tarif doit être positif.'),
    cleaningFeeAmount: z.number().min(0, 'Doit être positif.'),
    adults: z.number().int().min(1, 'Au moins 1 adulte.').max(30),
    children: z.number().int().min(0).max(30),
    status: z.enum([
      'pending',
      'confirmed',
      'checked_in',
      'checked_out',
      'completed',
      'cancelled',
      'no_show',
    ]),
    specialRequests: z.string().trim().optional(),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: "La date de départ doit être après la date d'arrivée.",
    path: ['checkOutDate'],
  });

export type ReservationFormValues = z.infer<typeof reservationFormSchema>;

export const RESERVATION_STATUS_OPTIONS = [
  { label: 'En attente', value: 'pending' },
  { label: 'Confirmée', value: 'confirmed' },
  { label: 'Arrivée effectuée', value: 'checked_in' },
  { label: 'Départ effectué', value: 'checked_out' },
  { label: 'Terminée', value: 'completed' },
  { label: 'Annulée', value: 'cancelled' },
  { label: 'No-show', value: 'no_show' },
] as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUS_OPTIONS)[number]['value'];

/**
 * CB-01 (Launch Readiness Audit): valid next statuses per current status, so a reservation can't
 * be flipped into a nonsensical state (e.g. checked_out → pending, or checked_in without ever
 * being confirmed). A status always transitions to itself (no-op edit that doesn't touch status).
 * Enforced here for the edit form's dropdown AND server-side in `updateReservation` — the form is
 * a convenience, the query layer is the actual boundary.
 */
export const RESERVATION_STATUS_TRANSITIONS: Record<ReservationStatusValue, ReservationStatusValue[]> = {
  pending: ['pending', 'confirmed', 'cancelled', 'no_show'],
  confirmed: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_in', 'checked_out'],
  checked_out: ['checked_out', 'completed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  no_show: ['no_show'],
};

/** A brand-new reservation can only start out pending or confirmed — check-in/check-out/completed
 * only happen via the guarded transitions above, never at creation time. */
export const RESERVATION_CREATE_STATUS_OPTIONS = RESERVATION_STATUS_OPTIONS.filter(
  (o) => o.value === 'pending' || o.value === 'confirmed'
);
