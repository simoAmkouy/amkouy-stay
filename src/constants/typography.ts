import { TextStyle } from 'react-native';

/**
 * The design references Roboto weights 400/500/600/700/900. Static Google Fonts
 * only ship 400/500/700/900 as distinct font families (no 600), so 600 is mapped
 * to the closest available weight (Bold) here — a single source of truth instead
 * of approximating per-screen.
 */
const ROBOTO_FAMILY: Record<number, string> = {
  400: 'Roboto_400Regular',
  500: 'Roboto_500Medium',
  600: 'Roboto_700Bold',
  700: 'Roboto_700Bold',
  900: 'Roboto_900Black',
};

export function robotoWeight(weight: 400 | 500 | 600 | 700 | 900): string {
  return ROBOTO_FAMILY[weight] ?? ROBOTO_FAMILY[400];
}

export function robotoText(weight: 400 | 500 | 600 | 700 | 900, size: number, extra?: TextStyle): TextStyle {
  return {
    fontFamily: robotoWeight(weight),
    fontSize: size,
    ...extra,
  };
}
