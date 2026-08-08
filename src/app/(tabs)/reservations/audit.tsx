import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { HeroHeader } from '@/components/amkouy/hero-header';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SearchBar } from '@/components/amkouy/search-bar';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useReservationAuditTrail } from '@/hooks/use-activity-log';
import { useAuth } from '@/hooks/use-auth';
import {
  AUDIT_ACTIONS,
  ChangedFieldValue,
  ChangedFields,
  ReservationAuditEntry,
  ReservationAuditSnapshot,
} from '@/lib/queries/reservation-audit';
import { formatMAD } from '@/utils/format';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  'reservation.created': 'Créée',
  'reservation.updated': 'Modifiée',
  'reservation.status_changed': 'Statut changé',
  'reservation.price_changed': 'Prix modifié',
  'reservation.dates_changed': 'Dates modifiées',
  'reservation.guest_changed': 'Client modifié',
  'reservation.property_changed': 'Bien modifié',
  'reservation.channel_changed': 'Canal modifié',
  'reservation.deleted': 'Supprimée',
  'reservation.bulk_deleted': 'Suppression groupée',
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  'reservation.created': { bg: '#DEF7E6', text: '#15803D' },
  'reservation.updated': { bg: '#FDEBC8', text: '#B45309' },
  'reservation.status_changed': { bg: '#E3E9F4', text: '#1E3A6E' },
  'reservation.price_changed': { bg: '#FDEBC8', text: '#B45309' },
  'reservation.dates_changed': { bg: '#EEEAFB', text: '#6D4FC9' },
  'reservation.guest_changed': { bg: '#EEEAFB', text: '#6D4FC9' },
  'reservation.property_changed': { bg: '#FEF3C7', text: '#92400E' },
  'reservation.channel_changed': { bg: '#FEF3C7', text: '#92400E' },
  'reservation.deleted': { bg: '#FAD9D9', text: '#B91C1C' },
  'reservation.bulk_deleted': { bg: '#FAD9D9', text: '#B91C1C' },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Comptable',
  cleaner: 'Ménage',
  technician: 'Technicien',
  owner: 'Propriétaire',
  commercial_agent: 'Agent',
};

const DELETION_REASON_LABELS: Record<string, string> = {
  duplicate: 'Réservation dupliquée',
  client_cancelled: 'Annulation client',
  test: 'Réservation test',
  created_by_mistake: 'Créée par erreur',
  other: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  checked_in: 'Arrivée',
  checked_out: 'Départ',
  completed: 'Terminée',
  cancelled: 'Annulée',
  no_show: 'No-show',
};

const CHANGED_FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  total_amount: 'Prix total',
  nightly_rate: 'Tarif nuit',
  cleaning_fee_amount: 'Frais ménage',
  check_in_date: 'Arrivée',
  check_out_date: 'Départ',
  nights: 'Nuits',
  property_name: 'Bien',
  guest_name: 'Client',
  guest_phone: 'Téléphone',
  channel_name: 'Canal',
  adults: 'Adultes',
  children: 'Enfants',
  notes: 'Notes',
  cancellation_reason: 'Raison annulation',
};

function formatChangedValue(field: string, value: ChangedFieldValue): string {
  if (value === null || value === undefined) return '—';
  if (field === 'status') return STATUS_LABELS[String(value)] ?? String(value);
  if (field === 'total_amount' || field === 'nightly_rate' || field === 'cleaning_fee_amount') {
    return formatMAD(Number(value));
  }
  return String(value);
}

type ActionFilter = 'all' | (typeof AUDIT_ACTIONS)[number];
const ACTION_FILTER_OPTIONS: ActionFilter[] = ['all', ...AUDIT_ACTIONS];

function getActionFilterLabel(v: ActionFilter): string {
  if (v === 'all') return 'Toutes';
  return ACTION_LABELS[v] ?? v;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAuditTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function snapField(value: string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

// ---------------------------------------------------------------------------
// Changed fields
// ---------------------------------------------------------------------------

function ChangedFieldsList({
  changedFields,
  limit,
}: {
  changedFields: ChangedFields;
  limit?: number;
}) {
  const entries = Object.entries(changedFields);
  const visible = limit ? entries.slice(0, limit) : entries;
  const hidden = limit ? entries.length - visible.length : 0;
  return (
    <View style={styles.changedFieldsBlock}>
      {visible.map(([field, diff]) => (
        <View key={field} style={styles.changedFieldRow}>
          <Text style={styles.changedFieldLabel}>
            {CHANGED_FIELD_LABELS[field] ?? field}
          </Text>
          <View style={styles.changedFieldDiff}>
            <Text style={styles.changedFieldBefore}>
              {formatChangedValue(field, diff.before)}
            </Text>
            <Text style={styles.changedFieldArrow}> → </Text>
            <Text style={styles.changedFieldAfter}>
              {formatChangedValue(field, diff.after)}
            </Text>
          </View>
        </View>
      ))}
      {hidden > 0 && (
        <Text style={styles.changedFieldMore}>+{hidden} autre(s) modification(s)</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

function SnapshotSection({
  title,
  snap,
}: {
  title: string;
  snap: ReservationAuditSnapshot | null;
}) {
  if (!snap) {
    return (
      <View style={styles.snapshotSection}>
        <Text style={styles.snapshotTitle}>{title}</Text>
        <Text style={styles.noData}>Non disponible</Text>
      </View>
    );
  }
  const rows: [string, string][] = [
    ['N° réservation', snapField(snap.reservation_code)],
    ['Client', snapField(snap.guest_name)],
    ['Téléphone', snapField(snap.guest_phone)],
    ['Bien', snapField(snap.property_name)],
    ['Canal', snapField(snap.channel_name)],
    ['Arrivée', snapField(snap.check_in_date)],
    ['Départ', snapField(snap.check_out_date)],
    ['Nuits', snapField(snap.nights)],
    ['Adultes / Enfants', `${snap.adults} / ${snap.children}`],
    ['Statut', STATUS_LABELS[snap.status] ?? snapField(snap.status)],
    ['Tarif nuit', formatMAD(snap.nightly_rate ?? 0)],
    ['Sous-total séjour', formatMAD(snap.subtotal_amount ?? 0)],
    ['Frais de ménage', formatMAD(snap.cleaning_fee_amount ?? 0)],
    ['Montant total', formatMAD(snap.total_amount)],
    ['Payé', formatMAD(snap.amount_paid)],
    ['Reste dû', formatMAD(snap.remaining)],
    ['Notes client', snapField(snap.notes)],
    ['Raison annulation', snapField(snap.cancellation_reason)],
    ['Créée le', snap.created_at ? new Date(snap.created_at).toLocaleString('fr-FR') : '—'],
    ['Modifiée le', snap.updated_at ? new Date(snap.updated_at).toLocaleString('fr-FR') : '—'],
  ];
  if (snap.is_deleted) {
    rows.push(['Supprimée', 'Oui']);
    rows.push(['Supprimée le', snap.deleted_at ? new Date(snap.deleted_at).toLocaleString('fr-FR') : '—']);
    rows.push(['Supprimée par (ID)', snapField(snap.deleted_by)]);
  }
  return (
    <View style={styles.snapshotSection}>
      <Text style={styles.snapshotTitle}>{title}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.snapRow}>
          <Text style={styles.snapLabel}>{label}</Text>
          <Text style={styles.snapValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailModal({
  entry,
  onClose,
}: {
  entry: ReservationAuditEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;
  const actionColor = ACTION_COLORS[entry.action] ?? { bg: '#EEF0F4', text: '#5A5E66' };
  const snap = entry.snapshot_after ?? entry.snapshot_before;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.detailRoot}>
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>Détail de l'action</Text>
            <Text style={styles.detailSubtitle}>
              {snapField(snap?.reservation_code ?? null, 'Réservation inconnue')}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Icon name="close" size={22} color={AmkouyColors.textMuted} />
          </Pressable>
        </View>

        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Action</Text>
              <Badge
                label={ACTION_LABELS[entry.action] ?? entry.action}
                bg={actionColor.bg}
                color={actionColor.text}
              />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date & Heure</Text>
              <Text style={styles.metaValue}>{formatAuditTime(entry.created_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Auteur</Text>
              <Text style={styles.metaValue}>{entry.actor_name ?? '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rôle</Text>
              <Text style={styles.metaValue}>
                {entry.actor_role ? (ROLE_LABELS[entry.actor_role] ?? entry.actor_role) : '—'}
              </Text>
            </View>
            {!!entry.bulk_operation_id && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Opération groupée</Text>
                <Text style={[styles.metaValue, styles.bulkId]}>{entry.bulk_operation_id}</Text>
              </View>
            )}
            {!!entry.reason && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Raison</Text>
                <Text style={styles.metaValue}>{DELETION_REASON_LABELS[entry.reason] ?? entry.reason}</Text>
              </View>
            )}
          </View>

          {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
            <View style={styles.detailChangesCard}>
              <Text style={styles.detailChangesTitle}>Modifications</Text>
              <View style={styles.detailChangesContent}>
                <ChangedFieldsList changedFields={entry.changed_fields} />
              </View>
            </View>
          )}

          <SnapshotSection title="Avant" snap={entry.snapshot_before} />
          <SnapshotSection title="Après" snap={entry.snapshot_after} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Audit row
// ---------------------------------------------------------------------------

function AuditRow({
  entry,
  onView,
}: {
  entry: ReservationAuditEntry;
  onView: () => void;
}) {
  const snap = entry.snapshot_after ?? entry.snapshot_before;
  const actionColor = ACTION_COLORS[entry.action] ?? { bg: '#EEF0F4', text: '#5A5E66' };
  return (
    <Card style={styles.auditCard}>
      <View style={styles.auditTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.auditTime}>{formatAuditTime(entry.created_at)}</Text>
          <Text style={styles.auditActor}>
            {entry.actor_name ?? '—'}
            {entry.actor_role ? ` · ${ROLE_LABELS[entry.actor_role] ?? entry.actor_role}` : ''}
          </Text>
        </View>
        <Badge
          label={ACTION_LABELS[entry.action] ?? entry.action}
          bg={actionColor.bg}
          color={actionColor.text}
        />
      </View>

      {snap && (
        <View style={styles.auditInfoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.auditCode}>{snap.reservation_code}</Text>
            <Text style={styles.auditGuest}>{snap.guest_name ?? '—'}</Text>
            <Text style={styles.auditProperty}>{snap.property_name ?? '—'}</Text>
          </View>
          <View style={styles.auditRight}>
            <Text style={styles.auditAmount}>{formatMAD(snap.total_amount)}</Text>
            <Text style={styles.auditStatus}>{STATUS_LABELS[snap.status] ?? snap.status}</Text>
          </View>
        </View>
      )}

      {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
        <ChangedFieldsList changedFields={entry.changed_fields} limit={3} />
      )}

      {!!entry.bulk_operation_id && (
        <Text style={styles.bulkBadge}>{entry.bulk_operation_id}</Text>
      )}

      <Pressable onPress={onView} style={styles.viewButton}>
        <Icon name="visibility" size={15} color={AmkouyColors.primaryContainer} />
        <Text style={styles.viewButtonText}>Voir détails</Text>
      </Pressable>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ReservationAuditScreen() {
  return (
    <AccessGuard resource={['reservations', 'finance']}>
      <ReservationAuditContent />
    </AccessGuard>
  );
}

function ReservationAuditContent() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<ReservationAuditEntry | null>(null);

  const { data: entries, isLoading, isError, refetch } = useReservationAuditTrail({
    currentUserRole: profile?.role ?? 'manager',
    currentUserId: profile?.id ?? '',
  });

  const filtered = useMemo(() => {
    let list = entries ?? [];
    if (actionFilter !== 'all') {
      list = list.filter((e) => e.action === actionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const snap = e.snapshot_after ?? e.snapshot_before;
        return (
          snap?.reservation_code?.toLowerCase().includes(q) ||
          snap?.guest_name?.toLowerCase().includes(q) ||
          snap?.property_name?.toLowerCase().includes(q) ||
          e.actor_name?.toLowerCase().includes(q) ||
          e.bulk_operation_id?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [entries, actionFilter, search]);

  return (
    <Screen contentPadding={false}>
      <HeroHeader showBack fallbackHref="/reservations">
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Historique des réservations</Text>
          <Text style={styles.heroSubtitle}>
            {entries ? `${filtered.length} entrée(s)` : 'Chargement…'}
          </Text>
        </View>
      </HeroHeader>

      <View style={styles.filterSection}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="N° réservation, client, bien, opération…"
          style={styles.searchBar}
        />
        <View style={styles.chipRow}>
          <FilterChipRow
            options={ACTION_FILTER_OPTIONS}
            active={actionFilter}
            onChange={setActionFilter}
            getLabel={getActionFilterLabel}
          />
        </View>
      </View>

      {isLoading && <LoadingState label="Chargement de l'historique…" />}
      {isError && (
        <ErrorState message="Impossible de charger l'historique." onRetry={refetch} />
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="history" message="Aucune entrée ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <View style={styles.list}>
          {filtered.map((entry) => (
            <AuditRow key={entry.id} entry={entry} onView={() => setSelectedEntry(entry)} />
          ))}
        </View>
      )}

      <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  heroContent: {
    paddingTop: 8,
  },
  heroTitle: {
    ...robotoText(700, 22, { color: '#fff', letterSpacing: -0.3 }),
  },
  heroSubtitle: {
    ...robotoText(400, 12.5, { color: AmkouyColors.onPrimaryMuted, marginTop: 4 }),
  },
  filterSection: {
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  searchBar: {
    marginHorizontal: 22,
  },
  chipRow: {
    paddingTop: 4,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 10,
  },
  auditCard: {
    padding: 14,
    gap: 10,
  },
  auditTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  auditTime: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  auditActor: {
    ...robotoText(600, 13, { color: AmkouyColors.text, marginTop: 2 }),
  },
  auditInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  auditCode: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
  },
  auditGuest: {
    ...robotoText(500, 12, { color: AmkouyColors.text, marginTop: 2 }),
  },
  auditProperty: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  auditRight: {
    alignItems: 'flex-end',
  },
  auditAmount: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
  },
  auditStatus: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  bulkBadge: {
    ...robotoText(500, 10.5, {
      color: AmkouyColors.primaryContainer,
      backgroundColor: '#E3E9F4',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      alignSelf: 'flex-start',
    }),
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  viewButtonText: {
    ...robotoText(600, 12, { color: AmkouyColors.primaryContainer }),
  },
  // Detail modal
  detailRoot: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
    backgroundColor: '#fff',
  },
  detailTitle: {
    ...robotoText(700, 17, { color: AmkouyColors.primary }),
  },
  detailSubtitle: {
    ...robotoText(500, 13, { color: AmkouyColors.textMuted, marginTop: 2 }),
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    padding: 22,
    paddingBottom: 40,
    gap: 18,
  },
  metaCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    paddingHorizontal: 16,
    gap: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  metaLabel: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textMuted }),
  },
  metaValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  bulkId: {
    ...robotoText(500, 11.5, { color: AmkouyColors.primaryContainer }),
  },
  snapshotSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  snapshotTitle: {
    ...robotoText(700, 13, {
      color: '#fff',
      backgroundColor: AmkouyColors.primaryContainer,
      paddingHorizontal: 16,
      paddingVertical: 9,
    }),
  },
  noData: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, padding: 16 }),
  },
  snapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
    gap: 12,
  },
  snapLabel: {
    ...robotoText(400, 12, { color: AmkouyColors.textMuted, flexShrink: 0 }),
  },
  snapValue: {
    ...robotoText(600, 12.5, { color: AmkouyColors.text, textAlign: 'right', flex: 1 }),
  },
  // Changed fields — list row (compact, max 3)
  changedFieldsBlock: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    gap: 6,
  },
  changedFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  changedFieldLabel: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted, flexShrink: 0 }),
  },
  changedFieldDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  changedFieldBefore: {
    ...robotoText(400, 11.5, { color: AmkouyColors.error, textDecorationLine: 'line-through' }),
  },
  changedFieldArrow: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint }),
  },
  changedFieldAfter: {
    ...robotoText(600, 11.5, { color: AmkouyColors.success }),
  },
  changedFieldMore: {
    ...robotoText(400, 11, { color: AmkouyColors.textFainter, fontStyle: 'italic' }),
  },
  // Changed fields — detail modal (full list)
  detailChangesCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  detailChangesTitle: {
    ...robotoText(700, 13, {
      color: '#fff',
      backgroundColor: AmkouyColors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
    }),
  },
  detailChangesContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
