/**
 * AvailabilityCard — lightweight modal shown when the user taps an empty date.
 *
 * IMPORTANT: ReservationForm is NOT mounted here. React Native cannot stack two
 * Modal components (FormModal inside this Modal was silently suppressed). The
 * parent screen owns ReservationForm at its root level — this component just
 * calls onRequestNewReservation() so the parent can close this card first, then
 * open the form with no modal stacking.
 */

import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = [
    'janvier','février','mars','avril','mai','juin',
    'juillet','août','septembre','octobre','novembre','décembre',
  ];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AvailabilityCardProps = {
  visible: boolean;
  propertyId: string | null;
  propertyName: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  onClose: () => void;
  /**
   * Called when the user taps "+ Nouvelle réservation".
   * The parent must close this card then open ReservationForm at its own root
   * level (no stacked modals).
   */
  onRequestNewReservation: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvailabilityCard({
  visible,
  propertyId: _propertyId,
  propertyName,
  date,
  onClose,
  onRequestNewReservation,
}: AvailabilityCardProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Icon name="event_available" size={20} color="#15803D" />
            <Text style={styles.title}>Disponible</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Icon name="close" size={20} color={AmkouyColors.textMuted} />
          </Pressable>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          {propertyName && (
            <View style={styles.infoRow}>
              <Icon name="apartment" size={16} color={AmkouyColors.textMuted} />
              <Text style={styles.infoLabel}>Appartement</Text>
              <Text style={styles.infoValue}>{propertyName}</Text>
            </View>
          )}
          {date && (
            <View style={styles.infoRow}>
              <Icon name="calendar_today" size={16} color={AmkouyColors.textMuted} />
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{formatDate(date)}</Text>
            </View>
          )}
        </View>

        <View style={styles.availableBadge}>
          <View style={styles.availableDot} />
          <Text style={styles.availableText}>Aucune réservation sur cette date</Text>
        </View>

        {/* CTA — closes this card, parent opens ReservationForm at root level */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.newResBtn}
            onPress={onRequestNewReservation}
            activeOpacity={0.85}
          >
            <Icon name="add_circle" size={18} color="#FFFFFF" />
            <Text style={styles.newResBtnText}>+ Nouvelle réservation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...robotoText(700, 18, { color: '#15803D' }),
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    margin: 20,
    backgroundColor: AmkouyColors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  infoLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted, flex: 1 }),
  },
  infoValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
    maxWidth: '55%',
    textAlign: 'right',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#15803D',
  },
  availableText: {
    ...robotoText(400, 13, { color: '#15803D' }),
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: 20,
    right: 20,
  },
  newResBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: AmkouyColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newResBtnText: {
    ...robotoText(700, 15, { color: '#FFFFFF' }),
  },
});
