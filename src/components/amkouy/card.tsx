import { StyleSheet, View, ViewProps } from 'react-native';

import { AmkouyColors, CardShadow } from '@/constants/amkouy-theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AmkouyColors.card,
    borderRadius: 14,
    ...CardShadow,
  },
});
