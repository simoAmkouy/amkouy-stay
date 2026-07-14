/**
 * Design tokens ported from the "Amkouy Prototype.dc.html" design export.
 * Kept separate from `constants/theme.ts` (the Expo-starter light/dark chrome)
 * since this app screen is deliberately light-only, matching the source design.
 */

export const AmkouyColors = {
  primary: '#0F1F3D',
  primaryContainer: '#1E3A6E',
  secondary: '#C9A84C',
  secondaryContainer: '#F5E6C0',
  success: '#22C55E',
  error: '#EF4444',

  surface: '#F8F7F5',
  card: '#FFFFFF',
  hairline: '#EEF0F4',
  border: '#D1D5DB',

  text: '#1A1C1E',
  textMuted: '#5A5E66',
  textFaint: '#8A8F98',
  textFainter: '#A6ABB3',
  onPrimaryMuted: '#9fb0cf',

  shadow: 'rgba(15,31,61,.08)',
} as const;

type BadgePair = { bg: string; text: string };

export const ReservationStatusColors: Record<string, BadgePair> = {
  Confirmée: { bg: '#DEF7E6', text: '#15803D' },
  'En attente': { bg: '#FDEBC8', text: '#B45309' },
  Annulée: { bg: '#FAD9D9', text: '#B91C1C' },
  Terminée: { bg: '#E3E9F4', text: '#1E3A6E' },
};

export const MaintenancePriorityColors: Record<string, BadgePair> = {
  Urgent: { bg: '#FAD9D9', text: '#B91C1C' },
  Élevé: { bg: '#FDEBC8', text: '#B45309' },
  Normal: { bg: '#E3E9F4', text: '#1E3A6E' },
};

export const MaintenanceStatusColors: Record<string, BadgePair> = {
  Ouvert: { bg: '#FAD9D9', text: '#B91C1C' },
  'En cours': { bg: '#FDEBC8', text: '#B45309' },
  Résolu: { bg: '#DEF7E6', text: '#15803D' },
};

export const PropertyStatusColors: Record<string, BadgePair> = {
  Occupé: { bg: '#E3E9F4', text: '#1E3A6E' },
  Disponible: { bg: '#DEF7E6', text: '#15803D' },
};

export const CleaningStatusColors: Record<string, BadgePair> = {
  'En cours': { bg: '#FDEBC8', text: '#B45309' },
  'À faire': { bg: '#E3E9F4', text: '#1E3A6E' },
  Terminé: { bg: '#DEF7E6', text: '#15803D' },
  Planifié: { bg: '#EEEAFB', text: '#6D4FC9' },
};

export const OwnerContractColors: Record<string, BadgePair> = {
  Actif: { bg: '#DEF7E6', text: '#15803D' },
  'Paiement dû': { bg: '#FAD9D9', text: '#B91C1C' },
  'Exp. bientôt': { bg: '#F8EFD4', text: '#8a6d1c' },
};

export const OwnerPaymentColors: Record<string, BadgePair> = {
  'En attente': { bg: '#FDEBC8', text: '#B45309' },
  Versé: { bg: '#DEF7E6', text: '#15803D' },
  Retard: { bg: '#FAD9D9', text: '#B91C1C' },
};

export const CardShadow = {
  shadowColor: '#0F1F3D',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 1 },
  elevation: 2,
} as const;
