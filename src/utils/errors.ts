type SupabaseErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function isSupabaseErrorLike(error: unknown): error is SupabaseErrorLike {
  return !!error && typeof error === 'object' && ('code' in error || 'message' in error);
}

/**
 * Postgres error codes we know how to translate into something a non-technical user can act on.
 * Anything not listed here falls back to the caller's generic message rather than leaking raw
 * Postgres/English text — the raw error is still fully available via logAppError for debugging.
 */
const FRIENDLY_MESSAGE_BY_CODE: Record<string, string> = {
  '23505': 'Cette valeur existe déjà.',
  '23503': "Élément lié introuvable (bien, client ou canal) — vérifiez votre sélection.",
  '23502': 'Un champ obligatoire est manquant.',
  '22001': 'Une valeur saisie est trop longue.',
  '23514': "Une valeur saisie ne respecte pas les règles de validation.",
  '23P01': 'Ces dates ne sont pas disponibles.',
};

/**
 * Raw Postgrest error objects thrown by the query layer are plain objects, never `instanceof
 * Error` — so `error instanceof Error ? error.message : fallback` silently discards their real
 * message for every failure except custom Error subclasses (like DoubleBookingError). This
 * resolves either to a genuine Error's message, a known-code friendly translation, or the
 * caller-provided fallback — never raw Postgres/English jargon.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (isSupabaseErrorLike(error) && error.code && FRIENDLY_MESSAGE_BY_CODE[error.code]) {
    return FRIENDLY_MESSAGE_BY_CODE[error.code];
  }
  return fallback;
}

/** Logs the full raw error for debugging, regardless of what message the user sees. */
export function logAppError(context: string, error: unknown) {
  const e = error as SupabaseErrorLike | null;
  console.error(`[${context}] failed:`, {
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
    code: e?.code,
    raw: error,
  });
}
