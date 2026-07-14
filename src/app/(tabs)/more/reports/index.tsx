import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { robotoText } from '@/constants/typography';

const REPORT_ITEMS: { label: string; sub: string; icon: string; bg: string; color: string; href: Href }[] = [
  { label: 'Relevés propriétaires', sub: 'Statement mensuel, export PDF', icon: 'receipt_long', bg: '#E3E9F4', color: '#1E3A6E', href: '/more/reports/owner-statement' },
  { label: 'Performance & portefeuille', sub: 'Classement des biens, contrats', icon: 'insights', bg: '#DEF7E6', color: '#15803D', href: '/more/reports/portfolio' },
  { label: 'Tableau de bord reporting', sub: "Courbes d'évolution", icon: 'show_chart', bg: '#F8EFD4', color: '#8a6d1c', href: '/more/reports/dashboard' },
  { label: "Centre d'export", sub: 'PDF, Excel, CSV', icon: 'file_download', bg: '#EEEAFB', color: '#6D4FC9', href: '/more/reports/export' },
];

export default function ReportsHubScreen() {
  return (
    <AccessGuard resource="reports">
      <Screen>
        <ScreenHeader title="Rapports" subtitle="Reporting & export" showBack fallbackHref="/more" />
        <View style={styles.list}>
          {REPORT_ITEMS.map((item) => (
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
    </AccessGuard>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 22,
    gap: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...robotoText(600, 14),
  },
  sub: {
    ...robotoText(400, 11.5, { marginTop: 2 }),
  },
});
