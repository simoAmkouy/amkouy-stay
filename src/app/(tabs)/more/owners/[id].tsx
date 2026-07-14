import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { HeroHeader } from '@/components/amkouy/hero-header';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { OwnerForm } from '@/components/forms/owner-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useDeleteOwner, useOwner, useOwnerProperties, useUpdateOwner } from '@/hooks/use-owners';
import { OWNER_STATUS_OPTIONS, OwnerFormValues } from '@/lib/validation/owner';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD, getInitials } from '@/utils/format';
import { goBackOrReplace } from '@/utils/navigation';

const STATUS_LABEL = Object.fromEntries(OWNER_STATUS_OPTIONS.map((o) => [o.value, o.label]));

export default function OwnerDetailScreen() {
  return (
    <AccessGuard resource="owners">
      <OwnerDetailContent />
    </AccessGuard>
  );
}

function OwnerDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: owner, isLoading, isError, refetch } = useOwner(id);
  const { data: properties } = useOwnerProperties(id);
  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();
  const [showEdit, setShowEdit] = useState(false);

  const handleUpdate = (values: OwnerFormValues) => {
    updateOwner.mutate(
      {
        id: id as string,
        input: {
          full_name: values.fullName,
          company_name: values.companyName || null,
          email: values.email || null,
          phone: values.phone || null,
          status: values.status,
          bank_name: values.bankName || null,
          bank_iban: values.bankIban || null,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Propriétaire modifié', 'Les changements ont été enregistrés.');
        },
        onError: (error) => {
          notify('Erreur', getErrorMessage(error, 'Impossible de modifier le propriétaire.'));
        },
      }
    );
  };

  const handleDelete = () => {
    if (!owner) return;
    confirmDestructive(
      'Supprimer ce propriétaire ?',
      `"${owner.full_name}" sera retiré de vos listes.`,
      () => {
        deleteOwner.mutate(owner.id, {
          onSuccess: () => goBackOrReplace('/more/owners'),
          onError: (error) => notify('Erreur', getErrorMessage(error, 'Suppression impossible.')),
        });
      }
    );
  };

  if (isLoading) return <LoadingState label="Chargement du propriétaire…" />;
  if (isError || !owner)
    return <ErrorState message="Propriétaire introuvable ou erreur de chargement." onRetry={refetch} />;

  return (
    <Screen contentPadding={false}>
      <HeroHeader showBack fallbackHref="/more/owners">
        <View style={styles.identityRow}>
          <Avatar
            initials={getInitials(owner.full_name)}
            size={58}
            bg={AmkouyColors.secondary}
            color={AmkouyColors.primary}
          />
          <View>
            <Text style={styles.name}>{owner.full_name}</Text>
            <Text style={styles.sub}>{owner.company_name || owner.email || owner.phone || '—'}</Text>
          </View>
        </View>
        <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
          <Icon name="edit" size={18} color={AmkouyColors.primary} />
          <Text style={styles.editButtonText}>Modifier</Text>
        </Pressable>
      </HeroHeader>

      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <InfoRow label="Statut" value={STATUS_LABEL[owner.status] ?? owner.status} border />
          <InfoRow label="Téléphone" value={owner.phone ?? '—'} border />
          <InfoRow label="E-mail" value={owner.email ?? '—'} border />
          <InfoRow label="Banque" value={owner.bank_name ?? '—'} border />
          <InfoRow label="RIB / IBAN" value={owner.bank_iban ?? '—'} />
        </Card>

        <Text style={styles.sectionTitle}>Propriétés</Text>
        {properties && properties.length > 0 ? (
          <View style={styles.propList}>
            {properties.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/properties/${p.id}`)}>
                <Card style={styles.propRow}>
                  <View style={styles.propThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.propName}>{p.name}</Text>
                    <Text style={styles.propCity}>{p.city}</Text>
                  </View>
                  {p.base_nightly_rate != null && (
                    <Text style={styles.propRevenue}>{formatMAD(p.base_nightly_rate)}</Text>
                  )}
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aucun bien assigné à ce propriétaire.</Text>
        )}

        {!!owner.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{owner.notes}</Text>
            </View>
          </>
        )}

        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Icon name="delete_outline" size={20} color={AmkouyColors.error} />
          <Text style={styles.deleteButtonText}>Supprimer ce propriétaire</Text>
        </Pressable>
      </View>

      <OwnerForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          fullName: owner.full_name,
          companyName: owner.company_name ?? '',
          email: owner.email ?? '',
          phone: owner.phone ?? '',
          status: owner.status,
          bankName: owner.bank_name ?? '',
          bankIban: owner.bank_iban ?? '',
          notes: owner.notes ?? '',
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updateOwner.isPending}
      />
    </Screen>
  );
}

function InfoRow({
  label,
  value,
  border,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <View style={[styles.infoRow, border && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  name: {
    ...robotoText(700, 22, { color: '#fff' }),
  },
  sub: {
    ...robotoText(400, 12.5, { color: AmkouyColors.onPrimaryMuted, marginTop: 2 }),
  },
  editButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,.12)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editButtonText: {
    ...robotoText(600, 12.5, { color: '#fff' }),
  },
  content: {
    padding: 22,
    paddingTop: 18,
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
  emptyText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  propList: {
    gap: 8,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    paddingHorizontal: 14,
  },
  propThumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: AmkouyColors.hairline,
  },
  propName: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  propCity: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  propRevenue: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
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
