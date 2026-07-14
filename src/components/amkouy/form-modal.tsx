import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

/**
 * Reusable Create/Edit form sheet. Not a route — a component conditionally
 * rendered on top of an existing list/detail screen via local state.
 */
export function FormModal({
  visible,
  title,
  onClose,
  onSubmit,
  submitting,
  submitLabel = 'Enregistrer',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Icon name="close" size={22} color={AmkouyColors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}>
            {submitting ? (
              <ActivityIndicator color={AmkouyColors.primary} />
            ) : (
              <Text style={styles.submitText}>{submitLabel}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  title: {
    ...robotoText(700, 18, { color: AmkouyColors.primary }),
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 22,
    paddingBottom: 40,
  },
  footer: {
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    backgroundColor: '#fff',
  },
  submitButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: AmkouyColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    ...robotoText(700, 15, { color: AmkouyColors.primary }),
  },
});
