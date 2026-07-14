/** Formats a number as the design's "MAD 8 500" French thousand-space style. */
export function formatMAD(amount: number): string {
  return `MAD ${amount.toLocaleString('fr-FR')}`;
}

/** Up to 2 uppercase initials from a full name, e.g. "Hassan Benali" -> "HB". */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Aujourd'hui" / "Hier" / "Il y a N jours" — used for Team Management's Last Login column. */
export function formatRelativeDay(iso: string | null): string {
  if (!iso) return 'Jamais connecté';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}
