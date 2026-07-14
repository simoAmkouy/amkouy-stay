import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoWeight } from '@/constants/typography';

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  trailingIcon,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  trailingIcon?: string;
  /** Extends/overrides the outer wrap style — used by ListFilterBar to drop the default
   * marginHorizontal when the search bar shares a row with other controls. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Icon name="search" size={21} color={AmkouyColors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={AmkouyColors.textFainter}
        style={styles.input}
      />
      {trailingIcon && <Icon name={trailingIcon} size={21} color={AmkouyColors.textFaint} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 22,
    height: 48,
    borderRadius: 24,
    backgroundColor: AmkouyColors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontFamily: robotoWeight(400),
    fontSize: 14,
    color: AmkouyColors.text,
  },
});
