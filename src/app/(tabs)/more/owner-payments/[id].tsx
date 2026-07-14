import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { MarkPaidForm } from '@/components/forms/mark-paid-form';
import { OwnerPaymentEditForm } from '@/components/forms/owner-payment-form';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  useApproveOwnerPayment,
  useCancelOwnerPayment,
  useMarkOwnerPaymentAsPaid,
  useOwnerPayment,
  useUpdateOwnerPaymentMetadata,
} from '@/hooks/use-owner-payments';
import { computeDisplayStatus, DisplayStatus } from '@/lib/queries/owner-payments';
import {
  DISPLAY_STATUS_OPTIONS,
  MarkAsPaidValues,
  OwnerPaymentMetadataValues,
  PAYOUT_METHOD_OPTIONS,
} from '@/lib/validation/owner-payment';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

const STATUS_LABEL = Object.fromEntries(DISPLAY_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PAYOUT_METHOD_LABEL = Object.fromEntries(PAYOUT_METHOD_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<DisplayStatus, { bg: string; text: string }> = {
  upcoming: { bg: '#E3E9F4', text: '#1E3A6E' },
  due: { bg: '#F8EFD4', text: '#8a6d1c' },
  overdue: { bg: '#FAD9D9', text: '#B91C1C' },
  approved: { bg: '#E4E9FA', text: '#3730A3' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function OwnerPaymentDetailScreen() {
  return (
    <AccessGuard resource="owner_payments">
      <OwnerPaymentDetailContent />
    </AccessGuard>
  );
}

function OwnerPaymentDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: payment, isLoading, isError, refetch } = useOwnerPayment(id);
  const updatePayment = useUpdateOwnerPaymentMetadata();
  const markAsPaid = useMarkOwnerPaymentAsPaid();
  const approvePayment = useApproveOwnerPayment();
  const cancelPayment = useCancelOwnerPayment();
  const [showEdit, setShowEdit] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  const handleUpdate = (values: OwnerPaymentMetadataValues) => {
    updatePayment.mutate(
      { id: id as string, input: values },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Versement modifié', 'Les changements ont été enregistrés.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le versement.')),
      }
    );
  };

  const handleMarkPaid = (values: MarkAsPaidValues) => {
    markAsPaid.mutate(
      { id: id as string, input: values },
      {
        onSuccess: () => {
          setShowMarkPaid(false);
          notify('Versement payé', 'Le versement a été marqué comme payé.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de confirmer le paiement.')),
      }
    );
  };

  const handleApprove = () => {
    if (!payment) return;
    approvePayment.mutate(payment.id, {
      onSuccess: () => notify('Versement approuvé', 'Les montants sont désormais figés.'),
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible d’approuver le versement.')),
    });
  };

  const handleCancel = () => {
    if (!payment) return;
    confirmDestructive('Annuler ce versement ?', `Le versement ${payment.payment_number} sera marqué comme annulé.`, () => {
      cancelPayment.mutate(payment.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible d’annuler le versement.')),
      });
    });
  };

  if (isLoading) return <LoadingState label="Chargement du versement…" />;
  if (isError || !payment)
    return <ErrorState message="Versement introuvable ou erreur de chargement." onRetry={refetch} />;

  const displayStatus = computeDisplayStatus(payment);
  const statusColors = STATUS_COLOR[displayStatus];
  const canAct = displayStatus !== 'paid' && displayStatus !== 'cancelled';
  // Editing free-text financial figures is only meaningful before approval — once a
  // settlement is approved/processing, trg_owner_payments_freeze_financials rejects any
  // change to gross_revenue/total_expenses/commission_amount/net_amount at the DB level,
  // so the edit form is hidden rather than offered and then failing on save.
  const canEdit = payment.status === 'pending';
  const canApprove = payment.status === 'pending';
  // CB-10 (Launch Readiness Audit): "Marquer payé" used to render for every non-paid/non-cancelled
  // status, so a freshly generated, unreviewed ('pending') settlement could be paid out in one tap,
  // skipping the approval review entirely. Now it only appears once a settlement has actually been
  // approved (or is already mid-payout) — matches the same statuses `markOwnerPaymentAsPaid` accepts.
  const canMarkPaid = payment.status === 'approved' || payment.status === 'processing';

  return (
    <Screen
      footer={
        canAct ? (
          <View style={styles.stickyFooter}>
            {canEdit && (
              <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
                <Icon name="edit" size={18} color={AmkouyColors.primary} />
                <Text style={styles.editButtonText}>Modifier</Text>
              </Pressable>
            )}
            {canApprove && (
              <Pressable onPress={handleApprove} style={styles.editButton}>
                <Icon name="verified" size={18} color={AmkouyColors.primary} />
                <Text style={styles.editButtonText}>Approuver</Text>
              </Pressable>
            )}
            {canMarkPaid && (
              <Pressable onPress={() => setShowMarkPaid(true)} style={styles.paidButton}>
                <Icon name="check_circle" size={18} color="#fff" />
                <Text style={styles.paidButtonText}>Marquer payé</Text>
              </Pressable>
            )}
          </View>
        ) : undefined
      }>
      <ScreenHeader title={payment.payment_number} showBack fallbackHref="/more/owner-payments" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.owner}>{payment.owner?.full_name ?? '—'}</Text>
          <Badge label={STATUS_LABEL[displayStatus] ?? displayStatus} bg={statusColors.bg} color={statusColors.text} />
        </View>
        <Text style={styles.period}>
          {payment.period_start} → {payment.period_end}
        </Text>
        {payment.is_manual_adjustment && (
          <View style={styles.manualBadgeRow}>
            <Icon name="warning" size={15} color="#B45309" />
            <Text style={styles.manualBadgeText}>
              Ajustement manuel — ces montants n&apos;ont pas été calculés par le moteur de règlement.
            </Text>
          </View>
        )}

        <View style={styles.revenueRow}>
          <View style={[styles.revenueCard, styles.revenueGross]}>
            <Text style={styles.revenueLabelDark}>Revenu brut</Text>
            <Text style={styles.revenueValueDark}>{formatMAD(payment.gross_revenue)}</Text>
          </View>
          <View style={[styles.revenueCard, styles.revenueNet]}>
            <Text style={styles.revenueLabelLight}>Revenu net</Text>
            <Text style={styles.revenueValueLight}>{formatMAD(payment.net_revenue ?? 0)}</Text>
          </View>
          <View style={[styles.revenueCard, styles.revenueDue]}>
            <Text style={[styles.revenueLabelLight, { color: '#8a6d1c' }]}>Dû propriétaire</Text>
            <Text style={[styles.revenueValueLight, { color: AmkouyColors.secondary }]}>
              {formatMAD(payment.net_amount)}
            </Text>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Bien" value={payment.property?.name ?? '—'} border />
          <InfoRow label="Dépenses" value={formatMAD(payment.total_expenses)} border />
          <InfoRow label="% Propriétaire" value={payment.owner_commission_pct != null ? `${payment.owner_commission_pct}%` : '—'} border />
          <InfoRow label="% Amkouy" value={payment.company_commission_pct != null ? `${payment.company_commission_pct}%` : '—'} border />
          <InfoRow label="Montant Amkouy" value={formatMAD(payment.commission_amount)} border />
          <InfoRow label="Échéance" value={payment.due_date ?? '—'} border />
          <InfoRow label="Date de paiement" value={payment.paid_at ? payment.paid_at.slice(0, 10) : '—'} border />
          <InfoRow
            label="Moyen de paiement"
            value={payment.payment_method ? PAYOUT_METHOD_LABEL[payment.payment_method] : '—'}
            border
          />
          <InfoRow label="Référence" value={payment.payment_reference ?? '—'} />
        </Card>

        {!!payment.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{payment.notes}</Text>
            </View>
          </>
        )}

        {canAct && (
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Icon name="cancel" size={20} color={AmkouyColors.error} />
            <Text style={styles.cancelButtonText}>Annuler ce versement</Text>
          </Pressable>
        )}
      </View>

      <OwnerPaymentEditForm
        visible={showEdit}
        initialValues={{
          dueDate: payment.due_date ?? '',
          paymentMethod: payment.payment_method,
          paymentReference: payment.payment_reference ?? '',
          notes: payment.notes ?? '',
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updatePayment.isPending}
      />

      <MarkPaidForm
        visible={showMarkPaid}
        onClose={() => setShowMarkPaid(false)}
        onSubmit={handleMarkPaid}
        submitting={markAsPaid.isPending}
      />
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

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  owner: {
    ...robotoText(700, 20, { color: AmkouyColors.primary }),
  },
  period: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  manualBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#FDEBC8',
    borderRadius: 10,
    padding: 10,
  },
  manualBadgeText: {
    ...robotoText(500, 11.5, { color: '#8a6d1c', flex: 1 }),
  },
  revenueRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  revenueCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  revenueGross: {
    backgroundColor: AmkouyColors.primary,
  },
  revenueNet: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  revenueDue: {
    backgroundColor: 'rgba(201,168,76,.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,.3)',
  },
  revenueLabelDark: {
    ...robotoText(400, 10.5, { color: AmkouyColors.onPrimaryMuted }),
  },
  revenueValueDark: {
    ...robotoText(900, 16, { color: '#fff', marginTop: 4 }),
  },
  revenueLabelLight: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint }),
  },
  revenueValueLight: {
    ...robotoText(900, 16, { color: AmkouyColors.text, marginTop: 4 }),
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  infoLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  infoValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  notesCard: {
    backgroundColor: '#FFFBEC',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 15,
  },
  notesText: {
    ...robotoText(400, 12.5, { color: '#6a5a22', lineHeight: 19 }),
  },
  cancelButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
  },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  editButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  paidButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paidButtonText: {
    ...robotoText(700, 14, { color: '#fff' }),
  },
});
