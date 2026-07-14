import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';

/**
 * Small circular icon-only button for inline row actions (edit/remove).
 * Matches FormModal's closeButton proportions — the closest existing
 * icon-only circular button in the app — rather than inventing a new shape.
 */
export function IconActionButton({
  icon,
  color = AmkouyColors.textMuted,
  onPress,
}: {
  icon: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.button}>
      <Icon name={icon} size={17} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
