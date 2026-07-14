import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/amkouy/empty-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';

/** Shared placeholder destination for Settings rows that don't have a real screen yet
 * (Langue, Sécurité & connexion, Équipe & rôles, Aide & support) — reused rather than
 * duplicated per row, since the content is identical apart from title/icon. */
export default function ComingSoonScreen() {
  const { title, icon } = useLocalSearchParams<{ title?: string; icon?: string }>();

  return (
    <Screen>
      <ScreenHeader title={title ?? 'Bientôt disponible'} showBack fallbackHref="/more/settings" />
      <EmptyState icon={icon ?? 'schedule'} message="Cette section n'est pas encore disponible. Elle arrive dans une prochaine mise à jour." />
    </Screen>
  );
}
