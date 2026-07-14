import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ReservationLeadForm } from '@/components/forms/reservation-lead-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCreateReservationLead, useReservationLeads } from '@/hooks/use-reservation-leads';
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

export default function ReservationLeadsScreen() {
  return (
    <AccessGuard resource="reservation_leads">
      <ReservationLeadsContent />
    </AccessGuard>
  );
}

function ReservationLeadsContent() {
  const { data: leads, isLoading, isError, refetch } = useReservationLeads();
  const createLead = useCreateReservationLead();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = (values: ReservationLeadFormValues) => {
    createLead.mutate(values, {
      onSuccess: () => {
        setShowCreate(false);
        notify('Lead créé', `${values.guestName} a été ajouté au pipeline.`);
      },
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le lead.')),
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Leads réservations"
        subtitle={leads ? `${leads.length} leads` : 'Chargement…'}
        showBack
        fallbackHref="/more/commercial"
        trailing={
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      {isLoading && <LoadingState label="Chargement des leads…" />}
      {isError && <ErrorState message="Impossible de charger les leads." onRetry={refetch} />}
      {!isLoading && !isError && (leads?.length ?? 0) === 0 && <EmptyState icon="event_available" message="Aucun lead pour le moment." />}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {leads?.map((lead) => {
            const colors = STATUS_COLOR[lead.status];
            return (
              <Pressable key={lead.id} onPress={() => router.push(`/more/commercial/reservation-leads/${lead.id}`)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{lead.guest_name}</Text>
                    <Text style={styles.sub}>
                      {lead.lead_number} · {lead.property?.name ?? 'Bien non décidé'} · {lead.check_in ?? '—'}
                    </Text>
                  </View>
                  <Badge label={STATUS_LABEL[lead.status] ?? lead.status} bg={colors.bg} color={colors.text} />
                  <Icon name="chevron_right" size={20} color="#c2c7cf" />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <ReservationLeadForm visible={showCreate} mode="create" onClose={() => setShowCreate(false)} onSubmit={handleCreate} submitting={createLead.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: AmkouyColors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 22, gap: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  name: { ...robotoText(600, 14, { color: AmkouyColors.text }) },
  sub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
});
