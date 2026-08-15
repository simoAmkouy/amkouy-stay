import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { PropertyIntelligencePanel } from '@/components/intelligence/PropertyIntelligencePanel';
import { useProperty } from '@/hooks/use-properties';

export default function PropertyIntelligenceScreen() {
  return (
    <AccessGuard resource="intelligence">
      <PropertyIntelligenceContent />
    </AccessGuard>
  );
}

function PropertyIntelligenceContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: property, isLoading, isError } = useProperty(id);

  if (isLoading) return <LoadingState />;
  if (isError || !property) return <ErrorState onRetry={() => {}} />;

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader
          title="Profil Intelligence"
          subtitle={property.name}
          showBack
          fallbackHref="/properties"
        />
      </View>
      <PropertyIntelligencePanel
        propertyId={property.id}
        propertyName={property.name}
        baseNightlyRate={property.base_nightly_rate ?? null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
  },
});
