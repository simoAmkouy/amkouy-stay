import { ReactNode } from 'react';

import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { Resource } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Client-side route/screen guard for Phase 2 RBAC. Wraps a screen's existing content — renders
 * it unchanged when the current role can access `resource`, otherwise renders a friendly "accès
 * refusé" state in its place. This is a UX-level gate, not the security boundary: real,
 * unbypassable enforcement is Phase 3's RLS policies. Reuses LoadingState/ErrorState as-is, so
 * no new visual language is introduced.
 */
/** `resource` accepts an array for hub screens covering several resource-gated sub-screens (e.g.
 * Commercial) — visible if the role holds ANY of them, same "any-of" semantics already used by
 * the More grid's own filter (see more/index.tsx's MORE_ITEMS). */
export function AccessGuard({ resource, children }: { resource: Resource | Resource[]; children: ReactNode }) {
  const { can, loading } = usePermissions();
  const { t } = useTranslation();

  if (loading) return <LoadingState label={t('common.checkingAccess')} />;

  const allowed = Array.isArray(resource) ? resource.some(can) : can(resource);
  if (!allowed) {
    return <ErrorState icon="lock" iconColor={AmkouyColors.textFaint} message={t('common.accessDenied')} />;
  }

  return <>{children}</>;
}
