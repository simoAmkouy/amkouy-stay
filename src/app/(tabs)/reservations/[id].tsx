import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { HeroHeader } from '@/components/amkouy/hero-header';
import { IconActionButton } from '@/components/amkouy/icon-action-button';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { Timeline } from '@/components/amkouy/timeline';
import { AssignServiceProviderForm } from '@/components/forms/assign-service-provider-form';
import { PaymentForm } from '@/components/forms/payment-form';
import { RefundForm } from '@/components/forms/refund-form';
import { ReservationForm } from '@/components/forms/reservation-form';
import { ReservationServiceForm } from '@/components/forms/reservation-service-form';
import { ScheduleServiceForm } from '@/components/forms/schedule-service-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useActivityLog } from '@/hooks/use-activity-log';
import { useAuth } from '@/hooks/use-auth';
import {
  useAssignServiceProvider,
  useCancelReservationService,
  useCompleteReservationService,
  useConfirmReservationService,
  useCreateReservationService,
  useDeleteReservationService,
  useRefundReservationService,
  useReservationServices,
  useScheduleReservationService,
  useStartReservationService,
  useUpdateReservationService,
} from '@/hooks/use-reservation-services';
import {
  useDeleteReservation,
  useReservation,
  useUpdateReservation,
} from '@/hooks/use-reservations';
import { useCreatePayment, usePayments, useRefundPayment, useReservationPaymentSummary } from '@/hooks/use-payments';
import { ActivityLogRow } from '@/lib/queries/activity-log';
import { computePaymentStatus, PaymentStatus } from '@/lib/queries/payments';
import { ReservationServiceWithRelations } from '@/lib/queries/reservation-services';
import { DoubleBookingError } from '@/lib/queries/reservations';
import { PaymentFormValues, RefundFormValues } from '@/lib/validation/payment';
import { RESERVATION_STATUS_OPTIONS, ReservationFormValues } from '@/lib/validation/reservation';
import {
  AssignServiceProviderValues,
  SERVICE_STATUS_OPTIONS,
  ScheduleServiceValues,
  ReservationServiceFormValues,
} from '@/lib/validation/reservation-service';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD, getInitials } from '@/utils/format';
import { goBackOrReplace } from '@/utils/navigation';

const STATUS_LABEL = Object.fromEntries(RESERVATION_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FDEBC8', text: '#B45309' },
  confirmed: { bg: '#DEF7E6', text: '#15803D' },
  checked_in: { bg: '#E3E9F4', text: '#1E3A6E' },
  checked_out: { bg: '#E3E9F4', text: '#1E3A6E' },
  completed: { bg: '#EEF0F4', text: '#5A5E66' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
  no_show: { bg: '#FAD9D9', text: '#B91C1C' },
};

const SERVICE_STATUS_LABEL = Object.fromEntries(SERVICE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const SERVICE_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  offered: { bg: '#F8EFD4', text: '#8a6d1c' },
  accepted: { bg: '#E3E9F4', text: '#1E3A6E' },
  scheduled: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  delivered: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
  refunded: { bg: '#EEF0F4', text: '#5A5E66' },
};

const ACTIVITY_LABELS: Record<string, string> = {
  'reservation.created': 'Réservation créée',
  'reservation.updated': 'Réservation modifiée',
  'reservation_service.added': 'Service ajouté',
  'reservation_service.updated': 'Service modifié',
  'reservation_service.removed': 'Service supprimé',
  'reservation_service.confirmed': 'Service confirmé',
  'reservation_service.provider_assigned': 'Prestataire assigné',
  'reservation_service.scheduled': 'Service planifié',
  'reservation_service.started': 'Service démarré',
  'reservation_service.completed': 'Service terminé',
  'reservation_service.cancelled': 'Service annulé',
  'reservation_service.refunded': 'Service remboursé',
};
const ACTIVITY_COLOR: Record<string, { dot: string; ring: string }> = {
  'reservation.created': { dot: '#22C55E', ring: '#c9f0d6' },
  'reservation_service.added': { dot: '#22C55E', ring: '#c9f0d6' },
  'reservation_service.completed': { dot: '#22C55E', ring: '#c9f0d6' },
  'reservation.updated': { dot: '#C9A84C', ring: '#f0e2b8' },
  'reservation_service.updated': { dot: '#C9A84C', ring: '#f0e2b8' },
  'reservation_service.confirmed': { dot: '#C9A84C', ring: '#f0e2b8' },
  'reservation_service.provider_assigned': { dot: '#6D4FC9', ring: '#e3dcf7' },
  'reservation_service.scheduled': { dot: '#6D4FC9', ring: '#e3dcf7' },
  'reservation_service.started': { dot: '#B45309', ring: '#fbe4c0' },
  'reservation_service.removed': { dot: '#D1D5DB', ring: '#eceef1' },
  'reservation_service.cancelled': { dot: '#EF4444', ring: '#fbd5d5' },
  'reservation_service.refunded': { dot: '#D1D5DB', ring: '#eceef1' },
};

function describeActivity(row: ActivityLogRow): string {
  return ACTIVITY_LABELS[row.action] ?? row.action;
}

function formatActivityTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReservationDetailScreen() {
  return (
    <AccessGuard resource="reservations">
      <ReservationDetailContent />
    </AccessGuard>
  );
}

function ReservationDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  // payments_insert/payments_update RLS is `is_finance()`-only (admin/super_admin/accountant) —
  // narrower than who can reach this screen (`reservations` resource = admin/manager). Without
  // this gate, a manager would see working-looking buttons that fail with a raw RLS error on
  // submit; found live during Phase 16 REST testing, not by inspection.
  const canManageFinance = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'accountant';
  const { data: reservation, isLoading, isError, refetch } = useReservation(id);
  const { data: services } = useReservationServices(id);
  const { data: activity } = useActivityLog('reservation', id);
  const updateReservation = useUpdateReservation();
  const deleteReservation = useDeleteReservation();
  const createService = useCreateReservationService(id as string);
  const updateService = useUpdateReservationService(id as string);
  const deleteService = useDeleteReservationService(id as string);
  const confirmService = useConfirmReservationService(id as string);
  const assignProvider = useAssignServiceProvider(id as string);
  const scheduleService = useScheduleReservationService(id as string);
  const startService = useStartReservationService(id as string);
  const completeService = useCompleteReservationService(id as string);
  const cancelService = useCancelReservationService(id as string);
  const refundService = useRefundReservationService(id as string);
  const { data: paymentSummary } = useReservationPaymentSummary(id);
  const { data: payments } = usePayments(id);
  const createPayment = useCreatePayment();
  const refundPayment = useRefundPayment();

  const [showEdit, setShowEdit] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<ReservationServiceWithRelations | null>(null);
  const [showAssignProvider, setShowAssignProvider] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [actingServiceId, setActingServiceId] = useState<string | null>(null);

  const handleUpdate = (values: ReservationFormValues) => {
    updateReservation.mutate(
      {
        id: id as string,
        input: {
          propertyId: values.propertyId,
          channelId: values.channelId,
          guestName: values.guestName,
          guestPhone: values.guestPhone,
          checkInDate: values.checkInDate,
          checkOutDate: values.checkOutDate,
          nightlyRate: values.nightlyRate,
          cleaningFeeAmount: values.cleaningFeeAmount,
          adults: values.adults,
          children: values.children,
          status: values.status,
          specialRequests: values.specialRequests,
        },
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Réservation modifiée', 'Les changements ont été enregistrés.');
        },
        onError: (error) => {
          if (error instanceof DoubleBookingError) {
            notify('Dates indisponibles', error.message);
            return;
          }
          notify('Erreur', getErrorMessage(error, 'Impossible de modifier la réservation.'));
        },
      }
    );
  };

  const handleDelete = () => {
    if (!reservation) return;
    confirmDestructive('Supprimer cette réservation ?', 'Cette action retirera la réservation de vos listes.', () => {
      deleteReservation.mutate(reservation.id, {
        onSuccess: () => goBackOrReplace('/reservations'),
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Suppression impossible.')),
      });
    });
  };

  const handleAddService = () => {
    setEditingService(null);
    setShowServiceForm(true);
  };

  const handleRecordPayment = (values: PaymentFormValues) => {
    createPayment.mutate(
      { reservationId: id as string, type: values.type, amount: values.amount, method: values.method, gatewayReference: values.gatewayReference },
      {
        onSuccess: () => {
          setShowPaymentForm(false);
          notify('Paiement enregistré', `${values.amount} MAD (${values.type === 'deposit_hold' ? 'acompte' : 'solde'})`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'enregistrer le paiement.")),
      }
    );
  };

  const handleRefund = (values: RefundFormValues) => {
    refundPayment.mutate(
      { reservationId: id as string, amount: values.amount, isDepositRelease: values.isDepositRelease, method: values.method, notes: values.notes },
      {
        onSuccess: () => {
          setShowRefundForm(false);
          notify('Remboursement émis', `${values.amount} MAD`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'émettre le remboursement.")),
      }
    );
  };

  const handleEditService = (service: ReservationServiceWithRelations) => {
    setEditingService(service);
    setShowServiceForm(true);
  };

  const handleServiceSubmit = (values: ReservationServiceFormValues) => {
    const payload = {
      serviceId: values.serviceId,
      providerId: values.providerId,
      quantity: values.quantity,
      unitPrice: values.unitPrice,
      costAmount: values.costAmount,
      status: values.status,
      scheduledDate: values.scheduledDate || null,
      scheduledTime: values.scheduledTime || null,
      notes: values.notes,
    };

    if (editingService) {
      updateService.mutate(
        { id: editingService.id, input: payload },
        {
          onSuccess: () => {
            setShowServiceForm(false);
            notify('Service modifié', 'Les changements ont été enregistrés.');
          },
          onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le service.')),
        }
      );
    } else {
      createService.mutate(payload, {
        onSuccess: () => {
          setShowServiceForm(false);
          notify('Service ajouté', 'Le service a été ajouté à la réservation.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'ajouter le service.")),
      });
    }
  };

  const handleConfirmService = (service: ReservationServiceWithRelations) => {
    confirmService.mutate(service.id, {
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de confirmer le service.')),
    });
  };

  const handleOpenAssignProvider = (service: ReservationServiceWithRelations) => {
    setActingServiceId(service.id);
    setShowAssignProvider(true);
  };

  const handleAssignProviderSubmit = (values: AssignServiceProviderValues) => {
    if (!actingServiceId) return;
    assignProvider.mutate(
      { id: actingServiceId, providerId: values.providerId },
      {
        onSuccess: () => {
          setShowAssignProvider(false);
          notify('Prestataire assigné', 'Le prestataire a été assigné au service.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'assigner le prestataire.")),
      }
    );
  };

  const handleOpenSchedule = (service: ReservationServiceWithRelations) => {
    setActingServiceId(service.id);
    setShowSchedule(true);
  };

  const handleScheduleSubmit = (values: ScheduleServiceValues) => {
    if (!actingServiceId) return;
    scheduleService.mutate(
      { id: actingServiceId, input: values },
      {
        onSuccess: () => {
          setShowSchedule(false);
          notify('Service planifié', 'Le service a été planifié avec succès.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de planifier le service.')),
      }
    );
  };

  const handleStartService = (service: ReservationServiceWithRelations) => {
    startService.mutate(service.id, {
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de démarrer le service.')),
    });
  };

  const handleCompleteService = (service: ReservationServiceWithRelations) => {
    completeService.mutate(service.id, {
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de terminer le service.')),
    });
  };

  const handleCancelService = (service: ReservationServiceWithRelations) => {
    confirmDestructive('Annuler ce service ?', `"${service.request_number}" sera marqué comme annulé.`, () => {
      cancelService.mutate(service.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'annuler le service.")),
      });
    });
  };

  const handleRefundService = (service: ReservationServiceWithRelations) => {
    confirmDestructive('Rembourser ce service ?', `"${service.request_number}" sera marqué comme remboursé.`, () => {
      refundService.mutate(service.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de rembourser le service.')),
      });
    });
  };

  const handleRemoveService = (service: ReservationServiceWithRelations) => {
    confirmDestructive(
      'Supprimer ce service ?',
      `"${service.request_number}" sera retiré de cette réservation.`,
      () => {
        deleteService.mutate(
          { id: service.id, requestNumber: service.request_number },
          {
            onError: (error) => notify('Erreur', getErrorMessage(error, 'Suppression impossible.')),
          }
        );
      }
    );
  };

  if (isLoading) return <LoadingState label="Chargement de la réservation…" />;
  if (isError || !reservation)
    return <ErrorState message="Réservation introuvable ou erreur de chargement." onRetry={refetch} />;

  const statusColors = STATUS_COLOR[reservation.status];
  // Internal management view only — never shown to owners (no `reservations` resource for
  // that role, and reservation_services itself is staff/finance-only at the RLS layer).
  const activeServices = (services ?? []).filter((s) => s.status !== 'cancelled' && s.status !== 'refunded');
  const conciergeRevenue = activeServices.reduce((sum, s) => sum + (s.total_price ?? 0), 0);
  const conciergeCost = activeServices.reduce((sum, s) => sum + (s.cost_amount ?? 0), 0);
  const conciergeProfit = activeServices.reduce((sum, s) => sum + (s.profit ?? 0), 0);
  const accommodationRevenue = reservation.total_amount;
  const totalGuestValue = accommodationRevenue + conciergeRevenue;

  const timelineItems = (activity ?? []).map((row) => ({
    dot: ACTIVITY_COLOR[row.action]?.dot ?? '#D1D5DB',
    ring: ACTIVITY_COLOR[row.action]?.ring ?? '#eceef1',
    label: describeActivity(row),
    time: formatActivityTime(row.created_at),
  }));

  return (
    <Screen contentPadding={false}>
      <HeroHeader showBack fallbackHref="/reservations">
        <View style={styles.identityRow}>
          <Avatar
            initials={getInitials(reservation.guest?.full_name ?? '?')}
            size={56}
            bg={AmkouyColors.secondary}
            color={AmkouyColors.primary}
          />
          <View>
            <Text style={styles.guestName}>{reservation.guest?.full_name ?? 'Client inconnu'}</Text>
            <Text style={styles.propertyName}>{reservation.property?.name ?? 'Bien inconnu'}</Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <Badge
            label={STATUS_LABEL[reservation.status] ?? reservation.status}
            bg={statusColors.bg}
            color={statusColors.text}
          />
          <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
            <Icon name="edit" size={16} color="#fff" />
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>
        </View>
      </HeroHeader>

      <View style={styles.content}>
        <View style={styles.revenueRow}>
          <View style={[styles.revenueCard, styles.revenueAccommodation]}>
            <Text style={styles.revenueLabelDark}>Hébergement</Text>
            <Text style={styles.revenueValueDark}>{formatMAD(accommodationRevenue)}</Text>
          </View>
          <View style={[styles.revenueCard, styles.revenueUpsell]}>
            <Text style={styles.revenueLabelLight}>Concierge</Text>
            <Text style={styles.revenueValueLight}>{formatMAD(conciergeRevenue)}</Text>
          </View>
          <View style={[styles.revenueCard, styles.revenueTotal]}>
            <Text style={[styles.revenueLabelLight, { color: '#8a6d1c' }]}>Valeur totale client</Text>
            <Text style={[styles.revenueValueLight, { color: AmkouyColors.secondary }]}>
              {formatMAD(totalGuestValue)}
            </Text>
          </View>
        </View>

        {activeServices.length > 0 && (
          <View style={styles.conciergeFinanceRow}>
            <View style={styles.conciergeFinanceBox}>
              <Text style={styles.conciergeFinanceLabel}>Coût concierge</Text>
              <Text style={[styles.conciergeFinanceValue, { color: AmkouyColors.error }]}>{formatMAD(conciergeCost)}</Text>
            </View>
            <View style={styles.conciergeFinanceBox}>
              <Text style={styles.conciergeFinanceLabel}>Profit concierge</Text>
              <Text style={[styles.conciergeFinanceValue, { color: AmkouyColors.success }]}>{formatMAD(conciergeProfit)}</Text>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Icon name="login" size={22} color={AmkouyColors.success} />
            <Text style={styles.statValue}>{reservation.check_in_date}</Text>
            <Text style={styles.statLabel}>Arrivée</Text>
          </View>
          <View style={styles.statBox}>
            <Icon name="logout" size={22} color={AmkouyColors.error} />
            <Text style={styles.statValue}>{reservation.check_out_date}</Text>
            <Text style={styles.statLabel}>Départ</Text>
          </View>
          <View style={styles.statBox}>
            <Icon name="dark_mode" size={22} color={AmkouyColors.primaryContainer} />
            <Text style={styles.statValue}>{reservation.nights ?? '—'}</Text>
            <Text style={styles.statLabel}>Nuits</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Informations financières</Text>
        <Card style={styles.financeCard}>
          <FinanceRow label="Sous-total séjour" value={formatMAD(reservation.subtotal_amount)} border />
          <FinanceRow label="Frais de ménage" value={formatMAD(reservation.cleaning_fee_amount)} border />
          {reservation.tourist_tax_amount > 0 && (
            <FinanceRow label="Taxe de séjour" value={formatMAD(reservation.tourist_tax_amount)} border />
          )}
          <FinanceRow label="Total" value={formatMAD(reservation.total_amount)} bold />
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Paiements</Text>
          {paymentSummary && (
            <PaymentStatusBadge status={computePaymentStatus(paymentSummary, reservation.check_in_date)} />
          )}
        </View>
        {paymentSummary && (
          <>
            <Card style={styles.financeCard}>
              <FinanceRow label="Valeur de la réservation" value={formatMAD(paymentSummary.reservationTotal)} border />
              <FinanceRow label="Acompte payé" value={formatMAD(paymentSummary.depositPaid)} border />
              <FinanceRow label="Solde payé" value={formatMAD(paymentSummary.balancePaid)} border />
              <FinanceRow label="Remboursé" value={`- ${formatMAD(paymentSummary.refunded)}`} border />
              <FinanceRow label="Reste dû" value={formatMAD(paymentSummary.outstanding)} border />
              <FinanceRow label="Taux d'encaissement" value={`${paymentSummary.collectionRate}%`} bold />
            </Card>
            {canManageFinance ? (
              <View style={styles.paymentActionsRow}>
                <Pressable onPress={() => setShowPaymentForm(true)} style={styles.paymentActionButton}>
                  <Icon name="payments" size={18} color="#fff" />
                  <Text style={styles.paymentActionText}>Enregistrer un paiement</Text>
                </Pressable>
                {paymentSummary.netCollected > 0 && (
                  <Pressable onPress={() => setShowRefundForm(true)} style={[styles.paymentActionButton, styles.refundActionButton]}>
                    <Icon name="undo" size={18} color={AmkouyColors.error} />
                    <Text style={[styles.paymentActionText, { color: AmkouyColors.error }]}>Rembourser</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={styles.financeReadOnlyHint}>Lecture seule — la comptabilité gère l&apos;enregistrement des paiements.</Text>
            )}
            {(payments ?? []).length > 0 && (
              <View style={styles.paymentHistoryList}>
                {(payments ?? []).map((p) => (
                  <View key={p.id} style={styles.paymentHistoryRow}>
                    <Icon
                      name={p.type === 'refund' || p.type === 'deposit_release' ? 'call_made' : 'call_received'}
                      size={16}
                      color={p.type === 'refund' || p.type === 'deposit_release' ? AmkouyColors.error : AmkouyColors.success}
                    />
                    <Text style={styles.paymentHistoryLabel}>{PAYMENT_HISTORY_LABEL[p.type]} · {p.method}</Text>
                    <Text style={styles.paymentHistoryAmount}>{formatMAD(p.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Services & Suppléments</Text>
          <Pressable onPress={handleAddService} style={styles.addServiceButton}>
            <Icon name="add" size={16} color={AmkouyColors.primary} />
            <Text style={styles.addServiceButtonText}>Ajouter</Text>
          </Pressable>
        </View>

        {(services ?? []).length === 0 ? (
          <EmptyState icon="room_service" message="Aucun service ajouté à cette réservation." />
        ) : (
          <View style={styles.serviceList}>
            {(services ?? []).map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={() => handleEditService(service)}
                onRemove={() => handleRemoveService(service)}
                onConfirm={() => handleConfirmService(service)}
                onAssignProvider={() => handleOpenAssignProvider(service)}
                onSchedule={() => handleOpenSchedule(service)}
                onStart={() => handleStartService(service)}
                onComplete={() => handleCompleteService(service)}
                onCancel={() => handleCancelService(service)}
                onRefund={() => handleRefundService(service)}
              />
            ))}
          </View>
        )}

        {!!reservation.special_requests && (
          <>
            <Text style={styles.sectionTitle}>Demandes du client</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{reservation.special_requests}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Chronologie</Text>
        {timelineItems.length === 0 ? (
          <EmptyState icon="history" message="Aucun évènement enregistré." />
        ) : (
          <Timeline items={timelineItems} />
        )}

        <Text style={styles.sectionTitle}>Client</Text>
        <Card style={styles.guestCard}>
          <Icon name="call" size={20} color={AmkouyColors.primaryContainer} />
          <Text style={styles.guestPhone}>{reservation.guest?.phone ?? 'Non renseigné'}</Text>
        </Card>

        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Icon name="delete_outline" size={20} color={AmkouyColors.error} />
          <Text style={styles.deleteButtonText}>Supprimer cette réservation</Text>
        </Pressable>
      </View>

      <ReservationForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          propertyId: reservation.property?.id ?? '',
          channelId: reservation.channel?.id ?? '',
          guestName: reservation.guest?.full_name ?? '',
          guestPhone: reservation.guest?.phone ?? '',
          checkInDate: reservation.check_in_date,
          checkOutDate: reservation.check_out_date,
          nightlyRate: reservation.nightly_rate,
          cleaningFeeAmount: reservation.cleaning_fee_amount,
          adults: reservation.adults,
          children: reservation.children,
          status: reservation.status,
          specialRequests: reservation.special_requests ?? '',
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updateReservation.isPending}
      />

      <ReservationServiceForm
        visible={showServiceForm}
        mode={editingService ? 'edit' : 'create'}
        initialValues={
          editingService
            ? {
                serviceId: editingService.service_id ?? '',
                providerId: editingService.provider_id,
                quantity: editingService.quantity,
                unitPrice: editingService.unit_price,
                costAmount: editingService.cost_amount,
                status: editingService.status,
                scheduledDate: editingService.scheduled_date ?? '',
                scheduledTime: editingService.scheduled_time ?? '',
                notes: editingService.notes ?? '',
              }
            : undefined
        }
        onClose={() => setShowServiceForm(false)}
        onSubmit={handleServiceSubmit}
        submitting={createService.isPending || updateService.isPending}
      />

      <AssignServiceProviderForm
        visible={showAssignProvider}
        onClose={() => setShowAssignProvider(false)}
        onSubmit={handleAssignProviderSubmit}
        submitting={assignProvider.isPending}
      />

      <ScheduleServiceForm
        visible={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSubmit={handleScheduleSubmit}
        submitting={scheduleService.isPending}
      />

      <PaymentForm
        visible={showPaymentForm}
        maxAmount={paymentSummary?.outstanding ?? 0}
        onClose={() => setShowPaymentForm(false)}
        onSubmit={handleRecordPayment}
        submitting={createPayment.isPending}
      />
      <RefundForm
        visible={showRefundForm}
        maxRefundable={paymentSummary?.netCollected ?? 0}
        onClose={() => setShowRefundForm(false)}
        onSubmit={handleRefund}
        submitting={refundPayment.isPending}
      />
    </Screen>
  );
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Non payé',
  deposit_paid: 'Acompte payé',
  partially_paid: 'Partiellement payé',
  paid: 'Payé',
  refunded: 'Remboursé',
  overdue: 'En retard',
};
const PAYMENT_STATUS_COLOR: Record<PaymentStatus, { bg: string; text: string }> = {
  unpaid: { bg: '#EEF0F4', text: '#5A5E66' },
  deposit_paid: { bg: '#E3E9F4', text: '#1E3A6E' },
  partially_paid: { bg: '#FDEBC8', text: '#B45309' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  refunded: { bg: '#EEEAFB', text: '#6D4FC9' },
  overdue: { bg: '#FAD9D9', text: '#B91C1C' },
};
const PAYMENT_HISTORY_LABEL: Record<string, string> = {
  charge: 'Solde encaissé',
  deposit_hold: 'Acompte encaissé',
  deposit_release: "Libération d'acompte",
  refund: 'Remboursement',
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const colors = PAYMENT_STATUS_COLOR[status];
  return <Badge label={PAYMENT_STATUS_LABEL[status]} bg={colors.bg} color={colors.text} />;
}

function ServiceCard({
  service,
  onEdit,
  onRemove,
  onConfirm,
  onAssignProvider,
  onSchedule,
  onStart,
  onComplete,
  onCancel,
  onRefund,
}: {
  service: ReservationServiceWithRelations;
  onEdit: () => void;
  onRemove: () => void;
  onConfirm: () => void;
  onAssignProvider: () => void;
  onSchedule: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onRefund: () => void;
}) {
  const serviceStatusColors = SERVICE_STATUS_COLOR[service.status];
  const isTerminal = service.status === 'cancelled' || service.status === 'refunded';

  return (
    <Card style={styles.serviceCard}>
      <View style={styles.serviceTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceName}>{service.service?.name ?? '—'}</Text>
          <Text style={styles.serviceQty}>
            {service.request_number} · {service.quantity} × {formatMAD(service.unit_price)} = {formatMAD(service.total_price ?? 0)}
          </Text>
          <Text style={styles.serviceProvider}>{service.provider?.name ?? 'Aucun prestataire'}</Text>
        </View>
        <Badge
          label={SERVICE_STATUS_LABEL[service.status] ?? service.status}
          bg={serviceStatusColors.bg}
          color={serviceStatusColors.text}
        />
      </View>

      <View style={styles.serviceFinanceRow}>
        <Text style={styles.serviceFinanceText}>Coût {formatMAD(service.cost_amount ?? 0)}</Text>
        <Text style={[styles.serviceFinanceText, { color: (service.profit ?? 0) >= 0 ? AmkouyColors.success : AmkouyColors.error }]}>
          Profit {formatMAD(service.profit ?? 0)}
        </Text>
      </View>

      {!!service.notes && <Text style={styles.serviceNotes}>{service.notes}</Text>}

      <View style={styles.serviceActionsRow}>
        {service.status === 'offered' && <IconActionButton icon="thumb_up" onPress={onConfirm} />}
        {(service.status === 'offered' || service.status === 'accepted') && (
          <IconActionButton icon="person_add" onPress={onAssignProvider} />
        )}
        {(service.status === 'accepted' || service.status === 'scheduled') && (
          <IconActionButton icon="event" onPress={onSchedule} />
        )}
        {(service.status === 'accepted' || service.status === 'scheduled') && (
          <IconActionButton icon="play_circle" onPress={onStart} />
        )}
        {service.status === 'in_progress' && <IconActionButton icon="check_circle" onPress={onComplete} />}
        {service.status === 'delivered' && <IconActionButton icon="replay" onPress={onRefund} />}
        <IconActionButton icon="edit" onPress={onEdit} />
        {!isTerminal && (
          <IconActionButton icon="cancel" color={AmkouyColors.error} onPress={onCancel} />
        )}
        <IconActionButton icon="delete_outline" color={AmkouyColors.error} onPress={onRemove} />
      </View>
    </Card>
  );
}

function FinanceRow({
  label,
  value,
  border,
  bold,
}: {
  label: string;
  value: string;
  border?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={[styles.financeRow, border && styles.financeRowBorder]}>
      <Text style={[styles.financeLabel, bold && styles.financeLabelBold]}>{label}</Text>
      <Text style={bold ? styles.financeValueBold : styles.financeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  guestName: {
    ...robotoText(700, 21, { color: '#fff' }),
  },
  propertyName: {
    ...robotoText(400, 12.5, { color: AmkouyColors.onPrimaryMuted, marginTop: 2 }),
  },
  badgeRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonText: {
    ...robotoText(600, 12, { color: '#fff' }),
  },
  content: {
    padding: 22,
    paddingTop: 18,
  },
  revenueRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  revenueCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  revenueAccommodation: {
    backgroundColor: AmkouyColors.primary,
  },
  revenueUpsell: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  revenueTotal: {
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
  conciergeFinanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  conciergeFinanceBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 12,
    padding: 11,
  },
  conciergeFinanceLabel: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint }),
  },
  conciergeFinanceValue: {
    ...robotoText(700, 14, { marginTop: 2 }),
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    ...robotoText(700, 13, { color: AmkouyColors.text }),
  },
  statLabel: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  addServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AmkouyColors.secondaryContainer,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addServiceButtonText: {
    ...robotoText(700, 12, { color: AmkouyColors.primary }),
  },
  serviceList: {
    gap: 10,
  },
  serviceCard: {
    padding: 14,
  },
  serviceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  serviceName: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  serviceQty: {
    ...robotoText(400, 12, { color: AmkouyColors.textMuted, marginTop: 2 }),
  },
  serviceProvider: {
    ...robotoText(500, 11.5, { color: AmkouyColors.primaryContainer, marginTop: 3 }),
  },
  serviceFinanceRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  serviceFinanceText: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted }),
  },
  serviceNotes: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint, marginTop: 8 }),
  },
  serviceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
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
  financeCard: {
    paddingHorizontal: 16,
  },
  paymentActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  financeReadOnlyHint: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 10, fontStyle: 'italic' }),
  },
  paymentActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: AmkouyColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  refundActionButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
  },
  paymentActionText: {
    ...robotoText(700, 12.5, { color: '#fff' }),
  },
  paymentHistoryList: {
    marginTop: 10,
    gap: 6,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  paymentHistoryLabel: {
    flex: 1,
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint }),
  },
  paymentHistoryAmount: {
    ...robotoText(600, 12, { color: AmkouyColors.text }),
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  financeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  financeLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  financeLabelBold: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  financeValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  financeValueBold: {
    ...robotoText(900, 16, { color: AmkouyColors.secondary }),
  },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  guestPhone: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  deleteButton: {
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
  deleteButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
  },
});
