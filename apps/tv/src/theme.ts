import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/** The Training Notebook palette: paper, ink, the coach's red pen and a highlighter for focus. */
export const colors = {
  paper: '#EFE8DA',
  paperDeep: '#E4DAC6',
  paperBright: '#FBF8F1',
  ink: '#1D1B17',
  inkSoft: '#3A362F',
  pencil: '#5E584C',
  faint: '#9A9283',
  pen: '#C0321B',
  highlighter: '#F5D547',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',
  displayBold: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  displayBoldItalic: 'Fraunces_600SemiBold_Italic',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansBold: 'InstrumentSans_600SemiBold',
  hand: 'Kalam_400Regular',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
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
