import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

/**
 * The one permanent addition to the Reservations list when selection mode is off: a small toggle
 * pill matching the existing refresh-button proportions. Meant to sit beside `ListFilterBar`
 * (Sort/Refresh) in the screen's own layout — this component only renders the button itself.
 */
export function SelectionToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.toggle, active && styles.toggleActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? 'Quitter le mode sélection' : 'Activer le mode sélection'}>
      <Icon name="checklist" size={18} color={active ? '#fff' : AmkouyColors.textMuted} />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>Sélectionner</Text>
    </Pressable>
  );
}

/**
 * "Tout sélectionner" row — only ever rendered by the parent while selection mode is on. Shows the
 * currently visible (filtered) reservation count so the action's scope is unambiguous, per "only
 * visible reservations should be selected".
 */
export function SelectAllRow({
  visibleCount,
  selectedCount,
  allSelected,
  onToggleAll,
}: {
  visibleCount: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <Pressable
      onPress={onToggleAll}
      style={styles.selectAllRow}
      disabled={visibleCount === 0}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: allSelected, disabled: visibleCount === 0 }}
      accessibilityLabel={allSelected ? 'Tout désélectionner' : `Tout sélectionner, ${visibleCount} réservations visibles`}>
      <Icon
        name={allSelected ? 'check_box' : 'check_box_outline_blank'}
        size={18}
        color={AmkouyColors.primary}
      />
      <Text style={styles.selectAllText}>
        {allSelected ? 'Tout désélectionner' : `Tout sélectionner (${visibleCount})`}
      </Text>
      {selectedCount > 0 && <Text style={styles.selectAllCount}>{selectedCount} sélectionnée(s)</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: AmkouyColors.hairline,
  },
  toggleActive: {
    backgroundColor: AmkouyColors.primary,
  },
  toggleText: {
    ...robotoText(600, 12.5, { color: AmkouyColors.textMuted }),
  },
  toggleTextActive: {
    color: '#fff',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 8,
  },
  selectAllText: {
    ...robotoText(600, 12.5, { color: AmkouyColors.primary }),
  },
  selectAllCount: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginLeft: 'auto' }),
  },
});
