import { Alert, Platform } from 'react-native';

/**
 * react-native-web's Alert.alert() is a documented no-op (it does nothing —
 * no dialog, no button callbacks). Every success/error message and every
 * destructive-action confirmation in this app goes through these two
 * functions instead of calling Alert directly, so web behaves the same as
 * iOS/Android rather than silently doing nothing.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Supprimer'
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
