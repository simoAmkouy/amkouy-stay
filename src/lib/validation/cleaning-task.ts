import { z } from 'zod';

import { Database } from '@/types/supabase';

type CleaningStatus = Database['public']['Enums']['cleaning_status'];

export const CLEANING_STATUS_OPTIONS: { label: string; value: CleaningStatus }[] = [
  { label: 'Non assigné', value: 'unassigned' },
  { label: 'Planifié', value: 'scheduled' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Terminé', value: 'completed' },
  { label: 'Vérifié', value: 'verified' },
  { label: 'Annulé', value: 'cancelled' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const cleaningTaskCreateSchema = z.object({
  propertyId: z.string().uuid('Sélectionnez un bien.'),
  scheduledDate: isoDate,
  assignedToUserId: z.string().uuid().nullable(),
  estimatedDurationMinutes: z.number().int().min(0).nullable(),
  notes: z.string().trim().optional(),
});

export type CleaningTaskCreateValues = z.infer<typeof cleaningTaskCreateSchema>;

export const assignCleanerSchema = z.object({
  assignedToUserId: z.string().uuid('Sélectionnez un agent de ménage.'),
});

export type AssignCleanerValues = z.infer<typeof assignCleanerSchema>;

export const cleaningTaskDetailsSchema = z.object({
  scheduledDate: isoDate,
  estimatedDurationMinutes: z.number().int().min(0).nullable(),
  notes: z.string().trim().optional(),
});

export type CleaningTaskDetailsValues = z.infer<typeof cleaningTaskDetailsSchema>;

export const completeTaskSchema = z.object({
  notes: z.string().trim().optional(),
});

export type CompleteTaskValues = z.infer<typeof completeTaskSchema>;
