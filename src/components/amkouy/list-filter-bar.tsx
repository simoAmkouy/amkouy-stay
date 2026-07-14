import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { SearchBar } from '@/components/amkouy/search-bar';
import { SortOption, SortSelector } from '@/components/amkouy/sort-selector';
import { AmkouyColors } from '@/constants/amkouy-theme';

/**
 * The one reusable search + sort + refresh row for list screens (Global Sorting & Filtering,
 * Phase 9). Status/date filters vary too much per screen to fold in here — screens compose
 * StatusFilter and/or a date filter as their own row(s) directly below this one.
 */
export function ListFilterBar<T extends string>({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  sortOptions,
  sortValue,
  onSortChange,
  sortLabel,
  onRefresh,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sortOptions: readonly SortOption<T>[];
  sortValue: T;
  onSortChange: (value: T) => void;
  sortLabel?: string;
  onRefresh?: () => void;
}) {
  return (
    <View style={styles.row}>
      <SearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={searchPlaceholder}
        style={styles.search}
      />
      <SortSelector options={sortOptions} value={sortValue} onChange={onSortChange} label={sortLabel} />
      {onRefresh && (
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={20} color={AmkouyColors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
  },
  search: {
    flex: 1,
    marginHorizontal: 0,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
