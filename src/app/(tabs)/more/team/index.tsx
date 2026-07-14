import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SortOption } from '@/components/amkouy/sort-selector';
import { UserForm } from '@/components/forms/user-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useAllUsers, useCreateUser, useTeamAlerts } from '@/hooks/use-team';
import { computeInactivityAlert } from '@/lib/queries/team';
import { UserRole, UserRow } from '@/lib/queries/users';
import { UserFormValues } from '@/lib/validation/user';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatRelativeDay, getInitials } from '@/utils/format';
import { toDateOnlyString } from '@/utils/date-range';

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super administrateur',
  admin: 'Administrateur',
  manager: "Responsable d'exploitation",
  accountant: 'Comptable',
  commercial_agent: 'Agent commercial',
  cleaner: 'Agent de ménage',
  technician: 'Technicien',
  owner: 'Propriétaire',
};
const ROLE_BADGE_COLOR: Record<UserRole, { bg: string; text: string }> = {
  super_admin: { bg: '#E3E9F4', text: '#1E3A6E' },
  admin: { bg: '#E3E9F4', text: '#1E3A6E' },
  manager: { bg: '#DDEEFB', text: '#0C5C8A' },
  accountant: { bg: '#F8EFD4', text: '#8a6d1c' },
  commercial_agent: { bg: '#FCEFD0', text: '#8a6d1c' },
  cleaner: { bg: '#E3F0FF', text: '#1E3A6E' },
  technician: { bg: '#FDEBEB', text: '#B45309' },
  owner: { bg: '#EEEAFB', text: '#6D4FC9' },
};
const ROLE_FILTER_OPTIONS: (UserRole | 'all')[] = ['all', 'manager', 'accountant', 'commercial_agent', 'cleaner', 'technician', 'owner'];
const STATUS_FILTER_OPTIONS: ('all' | 'active' | 'inactive')[] = ['all', 'active', 'inactive'];

type SortValue = 'created_desc' | 'created_asc' | 'active_desc' | 'active_asc' | 'name_asc' | 'role_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents (ajout)', value: 'created_desc' },
  { label: 'Plus anciens (ajout)', value: 'created_asc' },
  { label: 'Actif récemment', value: 'active_desc' },
  { label: 'Dernière connexion (plus ancienne)', value: 'active_asc' },
  { label: 'Nom A-Z', value: 'name_asc' },
  { label: 'Rôle', value: 'role_asc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}

export default function TeamScreen() {
  return (
    <AccessGuard resource="team_management">
      <TeamContent />
    </AccessGuard>
  );
}

function TeamContent() {
  const { profile } = useAuth();
  const canAdminister = profile?.role === 'admin' || profile?.role === 'super_admin';
  const { data: users, isLoading, isError, refetch } = useAllUsers();
  const todayStr = toDateOnlyString(new Date());
  const { data: workAlerts } = useTeamAlerts(users, todayStr);
  const inactivityAlerts = useMemo(
    () => (users ?? []).map((u) => computeInactivityAlert(u.id, u.full_name, u.last_login_at, null)).filter((a): a is NonNullable<typeof a> => !!a),
    [users]
  );
  const alerts = [...(workAlerts ?? []), ...inactivityAlerts];
  const createUser = useCreateUser();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortValue>('created_desc');

  const overview = useMemo(() => {
    const all = users ?? [];
    const byRole: Partial<Record<UserRole, number>> = {};
    for (const u of all) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    return {
      total: all.length,
      active: all.filter((u) => u.is_active).length,
      inactive: all.filter((u) => !u.is_active).length,
      byRole,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (users ?? []).filter((u) => {
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? '').toLowerCase().includes(q);
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'created_desc':
          return compareStrings(b.created_at, a.created_at);
        case 'created_asc':
          return compareStrings(a.created_at, b.created_at);
        case 'active_desc':
          return compareStrings(b.last_login_at ?? '', a.last_login_at ?? '');
        case 'active_asc':
          return compareStrings(a.last_login_at ?? '', b.last_login_at ?? '');
        case 'name_asc':
          return compareStrings(a.full_name, b.full_name);
        case 'role_asc':
          return compareStrings(a.role, b.role);
        default:
          return 0;
      }
    });
    return sorted;
  }, [users, search, statusFilter, roleFilter, sortBy]);

  const handleCreate = (values: UserFormValues) => {
    createUser.mutate(
      { fullName: values.fullName, email: values.email, phone: values.phone || null, role: values.role },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Membre créé', `Un e-mail de configuration du mot de passe a été envoyé à ${values.email}.`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer ce compte.')),
      }
    );
  };

  if (isLoading) return <LoadingState label="Chargement de l'équipe…" />;
  if (isError) return <ErrorState message="Impossible de charger l'équipe." onRetry={refetch} />;

  return (
    <Screen>
      <ScreenHeader
        title="Équipe & rôles"
        subtitle={`${overview.total} membres`}
        showBack
        fallbackHref="/more/settings"
        trailing={
          canAdminister ? (
            <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
              <Icon name="add" size={22} color="#fff" />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.kpiGrid}>
        <KpiTile label="Total" value={overview.total} />
        <KpiTile label="Actifs" value={overview.active} color={AmkouyColors.success} />
        <KpiTile label="Inactifs" value={overview.inactive} color={AmkouyColors.error} />
        <KpiTile label="Responsables" value={overview.byRole.manager ?? 0} />
        <KpiTile label="Comptables" value={overview.byRole.accountant ?? 0} />
        <KpiTile label="Agents commerciaux" value={overview.byRole.commercial_agent ?? 0} />
        <KpiTile label="Agents de ménage" value={overview.byRole.cleaner ?? 0} />
        <KpiTile label="Techniciens" value={overview.byRole.technician ?? 0} />
        <KpiTile label="Propriétaires" value={overview.byRole.owner ?? 0} />
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertSection}>
          <Text style={styles.alertSectionTitle}>Alertes équipe</Text>
          <View style={{ gap: 8 }}>
            {alerts.map((alert, index) => (
              <Pressable key={`${alert.userId}-${index}`} onPress={() => router.push(`/more/team/${alert.userId}`)}>
                <View style={[styles.alertRow, alert.severity === 'urgent' && styles.alertRowUrgent]}>
                  <Icon name={alert.severity === 'urgent' ? 'error' : 'warning'} size={19} color={alert.severity === 'urgent' ? '#B91C1C' : '#B45309'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertName}>{alert.userName}</Text>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <ListFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Nom, e-mail ou téléphone…"
          sortOptions={SORT_OPTIONS}
          sortValue={sortBy}
          onSortChange={setSortBy}
          onRefresh={refetch}
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <FilterChipRow
          options={STATUS_FILTER_OPTIONS}
          active={statusFilter}
          onChange={setStatusFilter}
          getLabel={(v) => (v === 'all' ? 'Tous' : v === 'active' ? 'Actifs' : 'Inactifs')}
        />
      </View>
      <View style={{ marginTop: 6 }}>
        <FilterChipRow options={ROLE_FILTER_OPTIONS} active={roleFilter} onChange={setRoleFilter} getLabel={(v) => (v === 'all' ? 'Tous les rôles' : ROLE_LABEL[v])} />
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="group" message="Aucun membre ne correspond à cette recherche." />
      ) : (
        <View style={styles.list}>
          {filtered.map((user) => (
            <TeamRow key={user.id} user={user} />
          ))}
        </View>
      )}

      <UserForm visible={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} submitting={createUser.isPending} />
    </Screen>
  );
}

function KpiTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function TeamRow({ user }: { user: UserRow }) {
  const roleColors = ROLE_BADGE_COLOR[user.role];
  return (
    <Pressable onPress={() => router.push(`/more/team/${user.id}`)}>
      <Card style={styles.row}>
        <Avatar initials={getInitials(user.full_name)} size={48} bg="#E3E9F4" color={AmkouyColors.primaryContainer} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.full_name}</Text>
          <View style={styles.badgeRow}>
            <Badge label={ROLE_LABEL[user.role]} bg={roleColors.bg} color={roleColors.text} size="sm" />
            <Badge label={user.is_active ? 'Actif' : 'Inactif'} bg={user.is_active ? '#DEF7E6' : '#EEF0F4'} color={user.is_active ? '#15803D' : AmkouyColors.textMuted} size="sm" />
          </View>
          <Text style={styles.lastLogin}>Dernière connexion : {formatRelativeDay(user.last_login_at)}</Text>
        </View>
        <Icon name="chevron_right" size={22} color="#c2c7cf" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: AmkouyColors.primary, alignItems: 'center', justifyContent: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 22, marginTop: 4 },
  kpiTile: { flexGrow: 0, flexBasis: '31%', width: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, padding: 12 },
  kpiValue: { ...robotoText(700, 17, { color: AmkouyColors.text }) },
  kpiLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 3 }) },
  alertSection: { marginTop: 18, paddingHorizontal: 22 },
  alertSectionTitle: { ...robotoText(700, 14, { color: '#B91C1C', marginBottom: 8 }) },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#F3E2C6',
  },
  alertRowUrgent: { backgroundColor: '#FDEBEB', borderColor: '#f7caca' },
  alertName: { ...robotoText(600, 12.5, { color: AmkouyColors.text }) },
  alertMessage: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }) },
  list: { paddingHorizontal: 22, gap: 10, marginTop: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  name: { ...robotoText(600, 14.5, { color: AmkouyColors.text }) },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  lastLogin: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 5 }) },
});
