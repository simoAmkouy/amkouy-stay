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
import { ServiceProviderForm } from '@/components/forms/service-provider-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCreateServiceProvider, useServiceProviders } from '@/hooks/use-service-providers';
import { PROVIDER_STATUS_OPTIONS, ServiceProviderFormValues } from '@/lib/validation/service-provider';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(PROVIDER_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  active: { bg: '#DEF7E6', text: '#15803D' },
  inactive: { bg: '#EEF0F4', text: '#5A5E66' },
  suspended: { bg: '#FAD9D9', text: '#B91C1C' },
};

export default function ServiceProvidersScreen() {
  return (
    <AccessGuard resource="concierge">
      <ServiceProvidersContent />
    </AccessGuard>
  );
}

function ServiceProvidersContent() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: providers, isLoading, isError, refetch } = useServiceProviders();
  const createProvider = useCreateServiceProvider();

  const handleCreate = (values: ServiceProviderFormValues) => {
    createProvider.mutate(values, {
      onSuccess: () => {
        setShowCreate(false);
        notify('Prestataire créé', 'Le prestataire a été ajouté avec succès.');
      },
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le prestataire.')),
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Prestataires"
        subtitle={providers ? `${providers.length} prestataires` : 'Chargement…'}
        showBack
        fallbackHref="/more"
        trailing={
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      {isLoading && <LoadingState label="Chargement des prestataires…" />}
      {isError && <ErrorState message="Impossible de charger les prestataires." onRetry={refetch} />}
      {!isLoading && !isError && (providers?.length ?? 0) === 0 && (
        <EmptyState icon="groups" message="Aucun prestataire enregistré pour le moment." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {(providers ?? []).map((provider) => {
            const colors = STATUS_COLOR[provider.status];
            return (
              <Pressable key={provider.id} onPress={() => router.push(`/more/concierge/providers/${provider.id}`)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{provider.name}</Text>
                    <Text style={styles.meta}>{provider.company_name ?? provider.phone ?? 'Aucun contact'}</Text>
                  </View>
                  <Badge label={STATUS_LABEL[provider.status] ?? provider.status} bg={colors.bg} color={colors.text} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <ServiceProviderForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createProvider.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 22,
    gap: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  name: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  meta: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
});
