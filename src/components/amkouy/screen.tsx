import { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';

/** Scrollable screen body on the surface background, matching the design's `.scr` content areas. */
export function Screen({
  children,
  footer,
  contentPadding = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  contentPadding?: boolean;
}) {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={contentPadding ? styles.content : undefined}>
        {Platform.OS === 'web' && <View style={styles.webTopSpacer} />}
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  webTopSpacer: {
    height: 64,
  },
});
