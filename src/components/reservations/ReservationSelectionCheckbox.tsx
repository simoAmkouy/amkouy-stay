import { Pressable } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';

/** Selection-mode checkbox rendered on a reservation card. Purely presentational — the parent
 * screen owns which ids are selected and what toggling means. */
export function ReservationSelectionCheckbox({
  selected,
  onToggle,
}: {
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={selected ? 'Désélectionner cette réservation' : 'Sélectionner cette réservation'}>
      <Icon
        name={selected ? 'check_box' : 'check_box_outline_blank'}
        size={22}
        color={selected ? AmkouyColors.primary : AmkouyColors.textFaint}
      />
    </Pressable>
  );
}
