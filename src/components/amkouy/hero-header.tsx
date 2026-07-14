import { Href } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { goBackOrReplace } from '@/utils/navigation';

/** Navy hero header with rounded bottom corners, used by Dashboard, Owner Detail, Reservation Detail, Owner Portal. */
export function HeroHeader({
  showBack = false,
  fallbackHref,
  gradient = false,
  children,
}: {
  showBack?: boolean;
  /** Where to go if there's no previous screen to return to. Required when showBack is true. */
  fallbackHref?: Href;
  gradient?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.wrap, gradient && styles.gradient]}>
      {showBack && (
        <Pressable
          onPress={() => goBackOrReplace(fallbackHref ?? '/dashboard')}
          style={styles.backButton}
          hitSlop={8}>
          <Icon name="arrow_back" size={23} color="#fff" />
        </Pressable>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: AmkouyColors.primary,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  gradient: {
    backgroundColor: AmkouyColors.primaryContainer,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
