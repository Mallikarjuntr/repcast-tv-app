import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** A scannable QR code drawn as one SVG path, with the standard quiet zone. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col},${row}h1v1h-1z`;
      }
    }
    return { count: n, path: d };
  }, [value]);

  const quiet = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`} accessibilityLabel="QR code to pair your phone">
      <Rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill={colors.text} />
      <Path d={path} fill={colors.bg} />
    </Svg>
  );
}
