import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { robotoText } from '@/constants/typography';
import { Resource } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';

const HUB_RESOURCES: Resource[] = ['commercial_leads', 'reservation_leads', 'commercial_dashboard', 'commercial_management'];

const ITEMS: { label: string; sub: string; icon: string; bg: string; color: string; href: Href; resource: Resource }[] = [
  { label: 'Leads propriétaires', sub: "Pipeline d'acquisition", icon: 'person_add', bg: '#FCEFD0', color: '#8a6d1c', href: '/more/commercial/leads', resource: 'commercial_leads' },
  { label: 'Leads réservations', sub: 'Pipeline de réservation', icon: 'event_available', bg: '#E3E9F4', color: '#1E3A6E', href: '/more/commercial/reservation-leads', resource: 'reservation_leads' },
  { label: 'Mon tableau de bord', sub: 'KPIs & performance', icon: 'insights', bg: '#DEF7E6', color: '#15803D', href: '/more/commercial/dashboard', resource: 'commercial_dashboard' },
  { label: 'Mon calendrier', sub: 'Mes réservations', icon: 'calendar_month', bg: '#EEEAFB', color: '#6D4FC9', href: '/more/commercial/calendar', resource: 'commercial_dashboard' },
  { label: 'Classement', sub: 'Performance des agents', icon: 'leaderboard', bg: '#FDEBC8', color: '#B45309', href: '/more/commercial/leaderboard', resource: 'commercial_management' },
];

export default function CommercialHubScreen() {
  return (
    <AccessGuard resource={HUB_RESOURCES}>
      <CommercialHubContent />
    </AccessGuard>
  );
}

function CommercialHubContent() {
  const { can } = usePermissions();
  const visible = ITEMS.filter((item) => can(item.resource));

  return (
    <Screen>
      <ScreenHeader title="Commercial" subtitle="Acquisition & performance" showBack fallbackHref="/more" />
      <View style={styles.list}>
        {visible.map((item) => (
          <Pressable key={item.label} onPress={() => router.push(item.href)}>
            <Card style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Icon name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.sub}>{item.sub}</Text>
              </View>
              <Icon name="chevron_right" size={22} color="#c2c7cf" />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 22, gap: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  iconBox: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { ...robotoText(600, 14) },
  sub: { ...robotoText(400, 11.5, { marginTop: 2 }) },
});
