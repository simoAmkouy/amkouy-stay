import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ConfirmReservationLeadForm, ConfirmReservationLeadValues } from '@/components/forms/confirm-reservation-lead-form';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ReservationLeadForm } from '@/components/forms/reservation-lead-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  useCreateReservationAsAgent,
  useReservationLead,
  useUpdateReservationLead,
  useUpdateReservationLeadStatus,
} from '@/hooks/use-reservation-leads';
import { computeTotals } from '@/lib/queries/reservations';
import { RESERVATION_LEAD_STATUS_OPTIONS, ReservationLeadFormValues } from '@/lib/validation/reservation-lead';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(RESERVATION_LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  new: { bg: '#E3E9F4', text: '#1E3A6E' },
  offer_sent: { bg: '#F8EFD4', text: '#8a6d1c' },
  negotiation: { bg: '#FDEBC8', text: '#B45309' },
  confirmed: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function ReservationLeadDetailScreen() {
  return (
    <AccessGuard resource="reservation_leads">
      <ReservationLeadDetailContent />
    </AccessGuard>
  );
}

function ReservationLeadDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: lead, isLoading, isError, refetch } = useReservationLead(id);
  const updateLead = useUpdateReservationLead();
  const updateStatus = useUpdateReservationLeadStatus();
  const createReservation = useCreateReservationAsAgent();
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) return <LoadingState label="Chargement du lead…" />;
  if (isError || !lead) return <ErrorState message="Lead introuvable." onRetry={refetch} />;

  const colors = STATUS_COLOR[lead.status];
  const canConfirm = lead.status !== 'confirmed' && lead.status !== 'cancelled' && !!lead.property_id && !!lead.check_in && !!lead.check_out;

  const handleEdit = (values: ReservationLeadFormValues) => {
    updateLead.mutate({ id: lead.id, input: values }, { onSuccess: () => setShowEdit(false), onError: (error) => notify('Erreur', getErrorMessage(error, 'Mise à jour impossible.')) });
  };

  const handleCancel = () => {
    updateStatus.mutate({ id: lead.id, status: 'cancelled' }, { onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible d’annuler ce lead.')) });
  };

  const handleConfirm = (values: ConfirmReservationLeadValues) => {
    if (!lead.property_id || !lead.check_in || !lead.check_out) return;
    const { subtotalAmount, totalAmount } = computeTotals({
      checkInDate: lead.check_in,
      checkOutDate: lead.check_out,
      nightlyRate: values.nightlyRate,
      cleaningFeeAmount: values.cleaningFeeAmount,
    });
    createReservation.mutate(
      {
        propertyId: lead.property_id,
        guestName: lead.guest_name,
        guestPhone: lead.phone ?? '',
        channelId: values.channelId,
        checkInDate: lead.check_in,
        checkOutDate: lead.check_out,
        adults: values.adults,
        children: values.children,
        nightlyRate: values.nightlyRate,
        subtotalAmount,
        cleaningFeeAmount: values.cleaningFeeAmount,
        totalAmount,
        reservationLeadId: lead.id,
      },
      {
        onSuccess: (result) => {
          setShowConfirm(false);
          notify('Réservation créée', result.reservationCode);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer la réservation.')),
      }
    );
  };

  return (
    <Screen
      footer={
        lead.status !== 'confirmed' && lead.status !== 'cancelled' ? (
          <View style={styles.footer}>
            {canConfirm && <FooterButton label="Confirmer" icon="check_circle" onPress={() => setShowConfirm(true)} tone="success" />}
            <FooterButton label="Annuler" icon="cancel" onPress={handleCancel} tone="secondary" />
          </View>
        ) : undefined
      }>
      <ScreenHeader title={lead.guest_name} subtitle={lead.lead_number} showBack fallbackHref="/more/commercial/reservation-leads" />

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge label={STATUS_LABEL[lead.status] ?? lead.status} bg={colors.bg} color={colors.text} />
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Téléphone" value={lead.phone ?? '—'} border />
          <InfoRow label="Email" value={lead.email ?? '—'} border />
          <InfoRow label="Bien souhaité" value={lead.property?.name ?? 'Non décidé'} border />
          <InfoRow label="Arrivée" value={lead.check_in ?? '—'} border />
          <InfoRow label="Départ" value={lead.check_out ?? '—'} border />
          <InfoRow label="Voyageurs" value={lead.guests_count != null ? String(lead.guests_count) : '—'} border />
          <InfoRow label="Source" value={lead.source ?? '—'} />
        </Card>

        {!!lead.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{lead.notes}</Text>
            </View>
          </>
        )}

        <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
          <Icon name="edit" size={18} color={AmkouyColors.primary} />
          <Text style={styles.editButtonText}>Modifier</Text>
        </Pressable>
      </View>

      <ReservationLeadForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          guestName: lead.guest_name,
          phone: lead.phone ?? '',
          email: lead.email ?? '',
          checkIn: lead.check_in ?? '',
          checkOut: lead.check_out ?? '',
          guestsCount: lead.guests_count,
          propertyId: lead.property_id,
          source: lead.source ?? '',
          notes: lead.notes ?? '',
          assignedTo: lead.assigned_to,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleEdit}
        submitting={updateLead.isPending}
      />

      {lead.check_in && lead.check_out && (
        <ConfirmReservationLeadForm
          visible={showConfirm}
          checkIn={lead.check_in}
          checkOut={lead.check_out}
          onClose={() => setShowConfirm(false)}
          onSubmit={handleConfirm}
          submitting={createReservation.isPending}
        />
      )}
    </Screen>
  );
}

function InfoRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={[styles.infoRow, border && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function FooterButton({ label, icon, onPress, tone }: { label: string; icon: string; onPress: () => void; tone: 'success' | 'secondary' }) {
  return (
    <Pressable onPress={onPress} style={[styles.footerButton, tone === 'success' ? styles.footerButtonSuccess : styles.footerButtonSecondary]}>
      <Icon name={icon} size={18} color={tone === 'secondary' ? AmkouyColors.primary : '#fff'} />
      <Text style={[styles.footerButtonText, tone === 'secondary' && { color: AmkouyColors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingTop: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  infoCard: { paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: AmkouyColors.hairline },
  infoLabel: { ...robotoText(400, 13, { color: AmkouyColors.textMuted }) },
  infoValue: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  sectionTitle: { ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }) },
  notesCard: { backgroundColor: '#FFFBEC', borderWidth: 1, borderColor: '#F3E6BE', borderRadius: 14, padding: 13, paddingHorizontal: 15 },
  notesText: { ...robotoText(400, 12.5, { color: '#6a5a22', lineHeight: 19 }) },
  editButton: { marginTop: 24, height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: AmkouyColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editButtonText: { ...robotoText(600, 13, { color: AmkouyColors.primary }) },
  footer: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', gap: 8, shadowColor: AmkouyColors.primary, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
  footerButton: { flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerButtonSuccess: { backgroundColor: AmkouyColors.success },
  footerButtonSecondary: { backgroundColor: AmkouyColors.secondaryContainer },
  footerButtonText: { ...robotoText(700, 13, { color: '#fff' }) },
});
