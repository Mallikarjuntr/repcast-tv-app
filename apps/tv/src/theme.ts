import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/** "Studio": a dark, warm room with cream type and one orange accent for what you can press. */
export const colors = {
  bg: '#15120F',
  /** Panels and cards. The trainer clips are rendered on exactly this colour (tools/trainer/style.py). */
  surface: '#221E1A',
  /** A focused card. */
  surfaceHigh: '#2A221C',
  /** Secondary buttons and chips. */
  raised: '#2B2621',
  /** Empty progress segments, rules, empty calendar days. */
  line: '#2E2823',
  text: '#F4EFE8',
  textSoft: '#CFC6BA',
  muted: '#B5ACA0',
  faint: '#8F867B',
  dim: '#6E665C',
  accent: '#FF7A3D',
  /** Text on the accent. */
  onAccent: '#15120F',
  /** The red dot on "LIVE". */
  live: '#FF4D3D',
  good: '#6FC3A8',
  /** A rep that didn't count, and the coach's marks over the video. */
  fault: '#FF6B5B',
  coach: '#F4EFE8',
  scrim: 'rgba(21,18,15,0.94)',
} as const;

/** Each person's avatar colour, in the order they were added. */
export const PROFILE_COLOURS = ['#C0321B', '#5B6B4E', '#3D5A80', '#8E5572', '#A8741A', '#4A7C74'] as const;

export const fonts = {
  /** Condensed, for headlines and big numbers. */
  display: 'ArchivoNarrow_700Bold',
  displaySemi: 'ArchivoNarrow_600SemiBold',
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_500Medium',
  sansSemi: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
  sansHeavy: 'Archivo_800ExtraBold',
} as const;

/** Screens are designed on a 1280x720 canvas; this scales any design value to the actual TV. */
const DESIGN_WIDTH = 1280;

export function useScale(): (designPx: number) => number {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const ratio = width / DESIGN_WIDTH;
    return (designPx: number) => Math.round(designPx * ratio * 10) / 10;
  }, [width]);
}
