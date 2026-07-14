import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useMarkNotificationRead, useNotifications } from '@/hooks/use-notifications';
import { NotificationRow } from '@/lib/queries/notifications';

const TYPE_META: Record<string, { icon: string; bg: string; color: string }> = {
  reservation: { icon: 'event_available', bg: '#EEEAFB', color: '#6D4FC9' },
  concierge: { icon: 'room_service', bg: '#F8EFD4', color: '#8a6d1c' },
  payment: { icon: 'payments', bg: '#F8EFD4', color: '#8a6d1c' },
  maintenance: { icon: 'build', bg: '#FDEBEB', color: AmkouyColors.error },
  cleaning: { icon: 'cleaning_services', bg: '#E3F0FF', color: AmkouyColors.primaryContainer },
  contract: { icon: 'description', bg: '#EEEAFB', color: '#6D4FC9' },
  system: { icon: 'notifications', bg: '#EEF0F4', color: AmkouyColors.textFaint },
};

function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  const handlePress = (notification: NotificationRow) => {
    if (!notification.read_at) markRead.mutate(notification.id);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        subtitle={`${unreadCount} non lues`}
        showBack
        fallbackHref="/more"
      />

      {isLoading && <LoadingState label="Chargement des notifications…" />}
      {isError && <ErrorState message="Impossible de charger les notifications." onRetry={refetch} />}
      {!isLoading && !isError && (notifications ?? []).length === 0 && (
        <EmptyState icon="notifications" message="Aucune notification pour le moment." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {(notifications ?? []).map((item) => {
            const meta = TYPE_META[item.type] ?? TYPE_META.system;
            const unread = !item.read_at;
            return (
              <Pressable key={item.id} onPress={() => handlePress(item)}>
                <View style={[styles.card, { backgroundColor: unread ? '#FFFDF6' : '#fff' }]}>
                  <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
                    <Icon name={meta.icon} size={21} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    {!!item.body && <Text style={styles.body}>{item.body}</Text>}
                    <Text style={styles.time}>{formatNotificationTime(item.created_at)}</Text>
                  </View>
                  {unread && <View style={styles.dot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 22,
    gap: 9,
  },
  card: {
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 12,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  body: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2, lineHeight: 16 }),
  },
  time: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFainter, marginTop: 5 }),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AmkouyColors.secondary,
    marginTop: 4,
  },
});
