import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { CommercialLeadForm } from '@/components/forms/commercial-lead-form';
import { ReassignAgentForm } from '@/components/forms/reassign-agent-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  useCommercialLead,
  useConvertLeadToOwner,
  useReassignCommercialLeadAgent,
  useUpdateCommercialLead,
  useUpdateLeadStatus,
} from '@/hooks/use-commercial-leads';
import { LeadStatus } from '@/lib/queries/commercial-leads';
import { CommercialLeadFormValues, LEAD_STATUS_OPTIONS } from '@/lib/validation/commercial-lead';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  new: { bg: '#E3E9F4', text: '#1E3A6E' },
  contacted: { bg: '#EEEAFB', text: '#6D4FC9' },
  visit_scheduled: { bg: '#FDEBC8', text: '#B45309' },
  proposal_sent: { bg: '#F8EFD4', text: '#8a6d1c' },
  negotiation: { bg: '#FDEBC8', text: '#B45309' },
  won: { bg: '#DEF7E6', text: '#15803D' },
  lost: { bg: '#FAD9D9', text: '#B91C1C' },
};

const NEXT_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  new: 'contacted',
  contacted: 'visit_scheduled',
  visit_scheduled: 'proposal_sent',
  proposal_sent: 'negotiation',
  negotiation: 'won',
};

export default function CommercialLeadDetailScreen() {
  return (
    <AccessGuard resource="commercial_leads">
      <CommercialLeadDetailContent />
    </AccessGuard>
  );
}

function CommercialLeadDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: lead, isLoading, isError, refetch } = useCommercialLead(id);
  const updateLead = useUpdateCommercialLead();
  const updateStatus = useUpdateLeadStatus();
  const convertLead = useConvertLeadToOwner();
  const reassignAgent = useReassignCommercialLeadAgent();
  const [showEdit, setShowEdit] = useState(false);
  const [showReassign, setShowReassign] = useState(false);

  if (isLoading) return <LoadingState label="Chargement du lead…" />;
  if (isError || !lead) return <ErrorState message="Lead introuvable." onRetry={refetch} />;

  const colors = STATUS_COLOR[lead.status];
  const nextStatus = NEXT_STATUS[lead.status];

  const handleAdvance = () => {
    if (!nextStatus) return;
    updateStatus.mutate(
      { id: lead.id, status: nextStatus },
      { onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de mettre à jour le statut.')) }
    );
  };

  const handleLost = () => {
    updateStatus.mutate(
      { id: lead.id, status: 'lost' },
      { onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de marquer ce lead comme perdu.')) }
    );
  };

  const handleConvert = () => {
    convertLead.mutate(lead.id, {
      onSuccess: () => notify('Converti', 'Propriétaire, bien et contrat créés avec succès.'),
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Conversion impossible.')),
    });
  };

  const handleReassign = (newAgentId: string) => {
    reassignAgent.mutate(
      { id: lead.id, newAgentId },
      {
        onSuccess: () => {
          setShowReassign(false);
          notify('Lead transféré', 'Le lead a été réassigné avec succès.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de réassigner ce lead.')),
      }
    );
  };

  const handleEdit = (values: CommercialLeadFormValues) => {
    updateLead.mutate(
      { id: lead.id, input: values },
      {
        onSuccess: () => setShowEdit(false),
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Mise à jour impossible.')),
      }
    );
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {lead.status !== 'won' && lead.status !== 'lost' && (
            <>
              {nextStatus && <FooterButton label={STATUS_LABEL[nextStatus]} icon="arrow_forward" onPress={handleAdvance} tone="primary" />}
              <FooterButton label="Perdu" icon="cancel" onPress={handleLost} tone="secondary" />
            </>
          )}
          {lead.status === 'won' && !lead.converted_property_id && (
            <FooterButton label="Convertir en propriétaire" icon="verified" onPress={handleConvert} tone="success" />
          )}
        </View>
      }>
      <ScreenHeader title={lead.owner_name} subtitle={lead.lead_number} showBack fallbackHref="/more/commercial/leads" />

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge label={STATUS_LABEL[lead.status] ?? lead.status} bg={colors.bg} color={colors.text} />
          {lead.converted_property_id && <Badge label="Converti" bg="#DEF7E6" color="#15803D" />}
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Téléphone" value={lead.phone ?? '—'} border />
          <InfoRow label="Email" value={lead.email ?? '—'} border />
          <InfoRow label="Source" value={lead.source ?? '—'} border />
          <InfoRow label="Ville" value={lead.city ?? '—'} border />
          <InfoRow label="Type de bien" value={lead.property_type ?? '—'} border />
          <InfoRow label="Unités estimées" value={lead.estimated_units != null ? String(lead.estimated_units) : '—'} border />
          <InfoRow label="Agent assigné" value={lead.assignedAgent?.full_name ?? 'Non assigné'} />
        </Card>

        {!!lead.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{lead.notes}</Text>
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
          <Pressable onPress={() => setShowEdit(true)} style={[styles.editButton, { flex: 1, marginTop: 0 }]}>
            <Icon name="edit" size={18} color={AmkouyColors.primary} />
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>
          <Pressable onPress={() => setShowReassign(true)} style={[styles.editButton, { flex: 1, marginTop: 0 }]}>
            <Icon name="swap_horiz" size={18} color={AmkouyColors.primary} />
            <Text style={styles.editButtonText}>Réassigner l&apos;agent</Text>
          </Pressable>
        </View>
      </View>

      <CommercialLeadForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          ownerName: lead.owner_name,
          phone: lead.phone ?? '',
          email: lead.email ?? '',
          source: lead.source ?? '',
          propertyType: lead.property_type,
          city: lead.city ?? '',
          estimatedUnits: lead.estimated_units,
          notes: lead.notes ?? '',
          assignedTo: lead.assigned_to,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleEdit}
        submitting={updateLead.isPending}
      />

      <ReassignAgentForm
        visible={showReassign}
        currentAgentId={lead.assigned_to}
        onClose={() => setShowReassign(false)}
        onSubmit={handleReassign}
        submitting={reassignAgent.isPending}
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

function FooterButton({ label, icon, onPress, tone }: { label: string; icon: string; onPress: () => void; tone: 'primary' | 'success' | 'secondary' }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.footerButton, tone === 'success' ? styles.footerButtonSuccess : tone === 'secondary' ? styles.footerButtonSecondary : styles.footerButtonPrimary]}>
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
  footerButtonPrimary: { backgroundColor: AmkouyColors.primary },
  footerButtonSuccess: { backgroundColor: AmkouyColors.success },
  footerButtonSecondary: { backgroundColor: AmkouyColors.secondaryContainer },
  footerButtonText: { ...robotoText(700, 13, { color: '#fff' }) },
});
