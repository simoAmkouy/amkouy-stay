import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FormModal } from '@/components/amkouy/form-modal';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SelectField } from '@/components/amkouy/select-field';
import { Timeline } from '@/components/amkouy/timeline';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useCommercialAgentKpis } from '@/hooks/use-commercial-kpis';
import {
  useAccountantStats,
  useChangeUserRole,
  useCleanerStats,
  useManagerStats,
  useOwnerStats,
  useSetUserActive,
  useTechnicianStats,
  useUser,
  useUserActivity,
} from '@/hooks/use-team';
import {
  computeCleanerProductivityScore,
  computeCommercialProductivityScore,
  computeTechnicianProductivityScore,
} from '@/lib/queries/team';
import { UserRole } from '@/lib/queries/users';
import { ASSIGNABLE_ROLE_OPTIONS } from '@/lib/validation/user';
import { confirmDestructive, notify } from '@/utils/alert';
import { toDateOnlyString } from '@/utils/date-range';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD, formatRelativeDay, getInitials } from '@/utils/format';

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

// Wide, fixed lifetime window for the Commercial Agent card — this is a profile summary, not a
// date-filtered report (Module 8/10's reporting screens already cover period-based views).
const LIFETIME_START = '2020-01-01';

export default function TeamMemberScreen() {
  return (
    <AccessGuard resource="team_management">
      <TeamMemberContent />
    </AccessGuard>
  );
}

function TeamMemberContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const canAdminister = profile?.role === 'admin' || profile?.role === 'super_admin';
  const canSeeFinance = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'accountant';

  const { data: user, isLoading, isError, refetch } = useUser(id);
  const { data: activity } = useUserActivity(id);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const setActive = useSetUserActive();
  const changeRole = useChangeUserRole();

  if (isLoading || !user) return <LoadingState label="Chargement du membre…" />;
  if (isError) return <ErrorState message="Impossible de charger ce membre." onRetry={refetch} />;

  const handleToggleActive = () => {
    const nextActive = !user.is_active;
    const action = () =>
      setActive.mutate(
        { id: user.id, isActive: nextActive },
        {
          onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible de modifier l'accès.")),
        }
      );
    if (!nextActive) {
      confirmDestructive('Désactiver ce compte ?', `${user.full_name} ne pourra plus se connecter.`, action, 'Désactiver');
    } else {
      action();
    }
  };

  const handleResetPassword = () => {
    // Reuses the exact same Supabase password-recovery email as the public "mot de passe oublié"
    // flow — no custom password system, nothing generated/shown/stored here.
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.resetPasswordForEmail(user.email).then(({ error }) => {
        if (error) notify('Erreur', getErrorMessage(error, "Impossible d'envoyer l'e-mail."));
        else notify('E-mail envoyé', `Un lien de réinitialisation a été envoyé à ${user.email}.`);
      });
    });
  };

  const handleChangeRole = () => {
    if (!pendingRole || pendingRole === user.role) return setShowChangeRole(false);
    changeRole.mutate(
      { id: user.id, role: pendingRole },
      {
        onSuccess: () => {
          setShowChangeRole(false);
          notify('Rôle modifié', `${user.full_name} est maintenant ${ROLE_LABEL[pendingRole]}.`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le rôle.')),
      }
    );
  };

  return (
    <Screen>
      <ScreenHeader title={user.full_name} showBack fallbackHref="/more/team" />

      <Card style={styles.profileCard}>
        <Avatar initials={getInitials(user.full_name)} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.full_name}</Text>
          <View style={styles.badgeRow}>
            <Badge label={ROLE_LABEL[user.role]} bg="#E3E9F4" color={AmkouyColors.primaryContainer} size="sm" />
            <Badge label={user.is_active ? 'Actif' : 'Inactif'} bg={user.is_active ? '#DEF7E6' : '#EEF0F4'} color={user.is_active ? '#15803D' : AmkouyColors.textMuted} size="sm" />
          </View>
        </View>
      </Card>

      <View style={styles.infoCard}>
        <InfoRow icon="mail" label="E-mail" value={user.email} />
        <InfoRow icon="call" label="Téléphone" value={user.phone ?? '—'} />
        <InfoRow icon="event" label="Créé le" value={new Date(user.created_at).toLocaleDateString('fr-FR')} />
        <InfoRow icon="schedule" label="Dernière connexion" value={formatRelativeDay(user.last_login_at)} />
      </View>

      {canAdminister && (
        <View style={styles.adminSection}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.adminActions}>
            <AdminActionButton
              icon={user.is_active ? 'block' : 'check_circle'}
              label={user.is_active ? 'Désactiver' : 'Activer'}
              onPress={handleToggleActive}
              danger={user.is_active}
            />
            <AdminActionButton
              icon="swap_horiz"
              label="Changer le rôle"
              onPress={() => {
                setPendingRole(user.role);
                setShowChangeRole(true);
              }}
            />
            <AdminActionButton icon="lock_reset" label="Réinitialiser le mot de passe" onPress={handleResetPassword} />
          </View>
        </View>
      )}

      <AssignedWork userId={user.id} role={user.role} canSeeFinance={canSeeFinance} />

      <Text style={styles.sectionTitle}>Activité récente</Text>
      <View style={styles.timelineWrap}>
        {(activity ?? []).length === 0 ? (
          <EmptyState icon="history" message="Aucune activité récente pour ce membre." />
        ) : (
          <Timeline
            items={(activity ?? []).map((a) => ({
              dot: AmkouyColors.primaryContainer,
              ring: AmkouyColors.hairline,
              label: a.action,
              time: new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            }))}
          />
        )}
      </View>

      <FormModal
        visible={showChangeRole}
        title="Changer le rôle"
        onClose={() => setShowChangeRole(false)}
        onSubmit={handleChangeRole}
        submitting={changeRole.isPending}
        submitLabel="Confirmer">
        <SelectField label="Nouveau rôle" value={pendingRole} options={ASSIGNABLE_ROLE_OPTIONS} onChange={(v) => setPendingRole(v as UserRole)} />
      </FormModal>
    </Screen>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={19} color={AmkouyColors.textFaint} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AdminActionButton({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.adminButton, danger && styles.adminButtonDanger]}>
      <Icon name={icon} size={19} color={danger ? AmkouyColors.error : AmkouyColors.primary} />
      <Text style={[styles.adminButtonText, danger && { color: AmkouyColors.error }]}>{label}</Text>
    </Pressable>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? AmkouyColors.success : score >= 40 ? '#B45309' : AmkouyColors.error;
  return (
    <View>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Score de productivité</Text>
        <Text style={[styles.scoreValue, { color }]}>{score}/100</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function AssignedWork({ userId, role, canSeeFinance }: { userId: string; role: UserRole; canSeeFinance: boolean }) {
  const todayStr = toDateOnlyString(new Date());
  const cleaner = useCleanerStats(role === 'cleaner' ? userId : undefined, todayStr);
  const technician = useTechnicianStats(role === 'technician' ? userId : undefined);
  const manager = useManagerStats(todayStr, role === 'manager');
  const accountant = useAccountantStats(role === 'accountant' ? userId : undefined);
  const owner = useOwnerStats(role === 'owner' ? userId : undefined);
  const commercial = useCommercialAgentKpis(role === 'commercial_agent' ? userId : undefined, LIFETIME_START, toDateOnlyString(new Date()));

  if (role === 'admin' || role === 'super_admin') return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>Travail assigné</Text>

      {role === 'cleaner' && cleaner.data && (
        <>
          <View style={styles.kpiGrid}>
            <KpiTile label="Assignées" value={cleaner.data.assignedCount} />
            <KpiTile label="Terminées" value={cleaner.data.completedCount} color={AmkouyColors.success} />
            <KpiTile label="En cours" value={cleaner.data.pendingCount} />
            <KpiTile label="En retard" value={cleaner.data.overdueCount} color={AmkouyColors.error} />
            <KpiTile label="Taux de complétion" value={cleaner.data.completionRate != null ? `${cleaner.data.completionRate}%` : '—'} />
            <KpiTile label="Durée moyenne" value={cleaner.data.avgCompletionHours != null ? `${cleaner.data.avgCompletionHours.toFixed(1)}h` : '—'} />
          </View>
          <View style={styles.scoreCard}>
            <ScoreBar score={computeCleanerProductivityScore(cleaner.data)} />
          </View>
        </>
      )}

      {role === 'technician' && technician.data && (
        <>
          <View style={styles.kpiGrid}>
            <KpiTile label="Assignés" value={technician.data.assignedCount} />
            <KpiTile label="Ouverts" value={technician.data.openCount} />
            <KpiTile label="Terminés" value={technician.data.completedCount} color={AmkouyColors.success} />
            <KpiTile label="Urgents" value={technician.data.urgentCount} color={AmkouyColors.error} />
            <KpiTile label="Résolution moyenne" value={technician.data.avgResolutionHours != null ? `${technician.data.avgResolutionHours.toFixed(1)}h` : '—'} />
          </View>
          <View style={styles.scoreCard}>
            <ScoreBar score={computeTechnicianProductivityScore(technician.data)} />
          </View>
        </>
      )}

      {role === 'manager' && manager.data && (
        <>
          <Text style={styles.assignedNote}>
            Aucune propriété n&apos;est individuellement assignée aux responsables dans ce schéma — vue opérationnelle globale.
          </Text>
          <View style={styles.kpiGrid}>
            <KpiTile label="Propriétés gérées" value={manager.data.propertiesManaged} />
            <KpiTile label="Ménage en retard" value={manager.data.cleaningBacklog} color={manager.data.cleaningBacklog > 0 ? AmkouyColors.error : undefined} />
            <KpiTile label="Maintenance ouverte" value={manager.data.maintenanceBacklog} />
            <KpiTile label="Problèmes opérationnels" value={manager.data.operationalIssues} color={manager.data.operationalIssues > 0 ? AmkouyColors.error : undefined} />
          </View>
        </>
      )}

      {role === 'accountant' && accountant.data && (
        <View style={styles.kpiGrid}>
          <KpiTile label="Versements traités" value={accountant.data.ownerPaymentsProcessed} />
          <KpiTile label="Dépenses traitées" value={accountant.data.expensesProcessed} />
        </View>
      )}

      {role === 'commercial_agent' && commercial.data && (
        <>
          <View style={styles.kpiGrid}>
            <KpiTile label="Biens acquis" value={commercial.data.propertiesAcquired} />
            <KpiTile label="Biens activés" value={commercial.data.propertiesActivated} color={AmkouyColors.success} />
            <KpiTile label="Leads" value={commercial.data.leadsTotal} />
            <KpiTile label="Réservations générées" value={commercial.data.reservationsGenerated} />
            <KpiTile label="Revenu généré" value={formatMAD(commercial.data.revenueGenerated)} />
            <KpiTile label="Commissions" value={formatMAD(commercial.data.commissionsPaid + commercial.data.commissionsPending)} />
            <KpiTile label="Taux de conversion" value={`${commercial.data.conversionRate}%`} />
          </View>
          <View style={styles.scoreCard}>
            <ScoreBar score={computeCommercialProductivityScore(commercial.data)} />
          </View>
        </>
      )}

      {role === 'owner' && owner.data === null && <EmptyState icon="real_estate_agent" message="Aucun profil propriétaire lié à ce compte." />}
      {role === 'owner' && owner.data && (
        <View style={styles.kpiGrid}>
          <KpiTile label="Biens détenus" value={owner.data.propertiesOwned} />
          <KpiTile label="Contrats actifs" value={owner.data.activeContracts} />
          <KpiTile label="En onboarding" value={owner.data.propertiesOnboarding} />
          {canSeeFinance ? (
            <KpiTile label="Versements en attente" value={owner.data.pendingPayments} color={owner.data.pendingPayments > 0 ? '#B45309' : undefined} />
          ) : (
            <KpiTile label="Versements en attente" value="—" />
          )}
        </View>
      )}
    </View>
  );
}

function KpiTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { marginHorizontal: 22, marginBottom: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { ...robotoText(700, 16, { color: AmkouyColors.text }) },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  infoCard: { marginHorizontal: 22, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, paddingVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  infoLabel: { ...robotoText(400, 12, { color: AmkouyColors.textFaint, width: 100 }) },
  infoValue: { flex: 1, ...robotoText(500, 13, { color: AmkouyColors.text }) },
  adminSection: { marginTop: 8 },
  adminActions: { paddingHorizontal: 22, gap: 8 },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  adminButtonDanger: { borderColor: '#f7caca', backgroundColor: '#FFF8F8' },
  adminButtonText: { ...robotoText(600, 13.5, { color: AmkouyColors.primary }) },
  sectionTitle: { ...robotoText(700, 15, { color: AmkouyColors.primary, paddingHorizontal: 22, marginTop: 20, marginBottom: 10 }) },
  assignedNote: { ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, paddingHorizontal: 22, marginBottom: 10 }) },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 22 },
  kpiTile: { flexGrow: 0, flexBasis: '31%', width: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, padding: 12 },
  kpiValue: { ...robotoText(700, 15, { color: AmkouyColors.text }) },
  kpiLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 3 }) },
  scoreCard: { marginHorizontal: 22, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, padding: 14 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scoreLabel: { ...robotoText(500, 12, { color: AmkouyColors.textMuted }) },
  scoreValue: { ...robotoText(700, 13, {}) },
  scoreTrack: { height: 8, borderRadius: 4, backgroundColor: AmkouyColors.hairline, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4 },
  timelineWrap: { paddingHorizontal: 22, paddingBottom: 30 },
});
