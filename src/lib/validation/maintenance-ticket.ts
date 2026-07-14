import { z } from 'zod';

import { Database } from '@/types/supabase';

type MaintenanceCategory = Database['public']['Enums']['maintenance_category'];
type MaintenancePriority = Database['public']['Enums']['maintenance_priority'];
type MaintenanceStatus = Database['public']['Enums']['maintenance_status'];

export const MAINTENANCE_CATEGORY_OPTIONS: { label: string; value: MaintenanceCategory }[] = [
  { label: 'Plomberie', value: 'plumbing' },
  { label: 'Électricité', value: 'electrical' },
  { label: 'Climatisation', value: 'hvac' },
  { label: 'Électroménager', value: 'appliance' },
  { label: 'Structurel', value: 'structural' },
  { label: 'Nuisibles', value: 'pest_control' },
  { label: 'Autre', value: 'other' },
];

export type EscalationReason =
  | 'broken_item'
  | 'missing_item'
  | 'appliance_problem'
  | 'water_leak'
  | 'electrical_issue'
  | 'internet_issue'
  | 'ac_issue'
  | 'general_damage'
  | 'other';

/** Cleaner-facing escalation reasons — distinct keys (not `maintenance_category` values directly,
 * several of which would collide on `other` and break SelectField's value-based selection display)
 * mapped to a real category via `ESCALATION_REASON_TO_CATEGORY` at submission time. */
export const ESCALATION_REASON_OPTIONS: { label: string; value: EscalationReason }[] = [
  { label: 'Objet cassé', value: 'broken_item' },
  { label: 'Objet manquant', value: 'missing_item' },
  { label: "Problème d'appareil", value: 'appliance_problem' },
  { label: "Fuite d'eau", value: 'water_leak' },
  { label: 'Problème électrique', value: 'electrical_issue' },
  { label: 'Problème internet', value: 'internet_issue' },
  { label: 'Climatisation', value: 'ac_issue' },
  { label: 'Dommage général', value: 'general_damage' },
  { label: 'Autre', value: 'other' },
];

export const ESCALATION_REASON_TO_CATEGORY: Record<EscalationReason, MaintenanceCategory> = {
  broken_item: 'other',
  missing_item: 'other',
  appliance_problem: 'appliance',
  water_leak: 'plumbing',
  electrical_issue: 'electrical',
  internet_issue: 'other',
  ac_issue: 'hvac',
  general_damage: 'structural',
  other: 'other',
};

export const MAINTENANCE_PRIORITY_OPTIONS: { label: string; value: MaintenancePriority }[] = [
  { label: 'Basse', value: 'low' },
  { label: 'Moyenne', value: 'normal' },
  { label: 'Élevée', value: 'high' },
  { label: 'Urgente', value: 'urgent' },
];

export const MAINTENANCE_STATUS_OPTIONS: { label: string; value: MaintenanceStatus }[] = [
  { label: 'Signalé', value: 'open' },
  { label: 'Assigné', value: 'assigned' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Attente pièces', value: 'on_hold' },
  { label: 'Terminé', value: 'resolved' },
  { label: 'Vérifié', value: 'closed' },
  { label: 'Annulé', value: 'cancelled' },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ).');

export const maintenanceTicketCreateSchema = z.object({
  propertyId: z.string().uuid('Sélectionnez un bien.'),
  category: z.enum(MAINTENANCE_CATEGORY_OPTIONS.map((o) => o.value) as [MaintenanceCategory, ...MaintenanceCategory[]], {
    message: 'Sélectionnez une catégorie.',
  }),
  priority: z.enum(MAINTENANCE_PRIORITY_OPTIONS.map((o) => o.value) as [MaintenancePriority, ...MaintenancePriority[]]),
  issueSummary: z.string().trim().min(2, "Le titre du problème est requis."),
  description: z.string().trim().optional(),
  scheduledDate: z.union([isoDate, z.literal('')]).optional(),
  estimatedCost: z.number().min(0).nullable(),
});

export type MaintenanceTicketCreateValues = z.infer<typeof maintenanceTicketCreateSchema>;

export const escalateTicketSchema = z.object({
  reason: z.enum(ESCALATION_REASON_OPTIONS.map((o) => o.value) as [EscalationReason, ...EscalationReason[]], {
    message: 'Sélectionnez un motif.',
  }),
  reasonLabel: z.string(),
  description: z.string().trim().min(2, 'Décrivez le problème constaté.'),
  priority: z.enum(MAINTENANCE_PRIORITY_OPTIONS.map((o) => o.value) as [MaintenancePriority, ...MaintenancePriority[]]),
});

export type EscalateTicketValues = z.infer<typeof escalateTicketSchema>;

export const assignTechnicianSchema = z.object({
  assignedToUserId: z.string().uuid('Sélectionnez un technicien.'),
});

export type AssignTechnicianValues = z.infer<typeof assignTechnicianSchema>;

export const completeTicketSchema = z.object({
  actualCost: z.number().min(0).nullable(),
  notes: z.string().trim().optional(),
});

export type CompleteTicketValues = z.infer<typeof completeTicketSchema>;

export const holdForPartsSchema = z.object({
  notes: z.string().trim().min(2, 'Précisez les pièces attendues.'),
});

export type HoldForPartsValues = z.infer<typeof holdForPartsSchema>;

export const generateExpenseSchema = z.object({
  amount: z.number().positive('Le montant doit être positif.'),
  description: z.string().trim().min(2, 'La description est requise.'),
});

export type GenerateExpenseValues = z.infer<typeof generateExpenseSchema>;
