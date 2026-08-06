import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors, CardShadow } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

/**
 * Floating bulk-action bar for the Reservations list, shown while selection mode is on and at
 * least one reservation is selected. Purely presentational — every action is a callback the
 * screen wires to its own (existing) mutations, so this component owns no business logic.
 */
export function BulkActionBar({
  count,
  canDelete,
  deleting,
  onChangeStatus,
  onDelete,
  onExport,
  onCancel,
}: {
  count: number;
  canDelete: boolean;
  deleting: boolean;
  onChangeStatus: () => void;
  onDelete: () => void;
  onExport: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.bar}>
      <View
        style={styles.inner}
        accessibilityRole="toolbar"
        accessibilityLabel={`${count} réservation(s) sélectionnée(s)`}>
        <Text style={styles.count}>{count} réservation(s) sélectionnée(s)</Text>
        <View style={styles.actions}>
          <Pressable onPress={onChangeStatus} style={styles.action} accessibilityRole="button" accessibilityLabel="Changer le statut">
            <Icon name="sync_alt" size={16} color="#fff" />
            <Text style={styles.actionText}>Changer le statut</Text>
          </Pressable>
          {canDelete && (
            <Pressable
              onPress={onDelete}
              disabled={deleting}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Supprimer les réservations sélectionnées"
              accessibilityState={{ disabled: deleting }}>
              <Icon name="delete_outline" size={16} color="#fff" />
              <Text style={styles.actionText}>Supprimer</Text>
            </Pressable>
          )}
          <Pressable onPress={onExport} style={styles.action} accessibilityRole="button" accessibilityLabel="Exporter">
            <Icon name="ios_share" size={16} color="#fff" />
            <Text style={styles.actionText}>Exporter</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.action} accessibilityRole="button" accessibilityLabel="Annuler la sélection">
            <Icon name="close" size={16} color="#fff" />
            <Text style={styles.actionText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Rendered via `Screen`'s `footer` slot (a normal-flow sibling of the ScrollView, not inside
  // it) — the same mechanism every other sticky action bar in this app uses. Rendering this as a
  // scrolled child with `position: absolute` would anchor it to the bottom of the *content*, not
  // the viewport, so on a long list it would sit far below the fold instead of floating in view.
  bar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: AmkouyColors.surface,
  },
  inner: {
    backgroundColor: AmkouyColors.primary,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    ...CardShadow,
  },
  count: {
    ...robotoText(700, 13, { color: '#fff' }),
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.14)',
  },
  actionText: {
    ...robotoText(600, 12, { color: '#fff' }),
  },
});
