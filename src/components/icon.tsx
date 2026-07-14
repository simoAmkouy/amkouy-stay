import { MaterialIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Renders one of the design's Material Symbols (e.g. "calendar_month") using
 * @expo/vector-icons' MaterialIcons font. Every icon name referenced by the
 * design maps 1:1 to a MaterialIcons glyph via snake_case -> kebab-case.
 */
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color: string;
}) {
  const iconName = name.replace(/_/g, '-') as MaterialIconName;
  return <MaterialIcons name={iconName} size={size} color={color} />;
}
