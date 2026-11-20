import { CHORD_SHAPES } from '../game/chart';

/** Small chord box: six strings, four frets, dots where the fingers go. */
export function ChordDiagram({ chord, size = 90 }: { chord: string; size?: number }) {
  const shape = CHORD_SHAPES[chord];
  if (!shape) return null;
  const w = size, h = size * 1.15;
  const padX = w * 0.14, top = h * 0.2, frets = 4;
  const gap = (w - padX * 2) / 5;
  const fretH = (h - top - h * 0.06) / frets;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="chord-diagram" role="img" aria-label={`${chord} chord shape`}>
      <rect x={padX - 1} y={top - 4} width={gap * 5 + 2} height={4} rx={1} fill="#ece4d4" />
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padX} x2={padX + gap * 5} y1={top + i * fretH} y2={top + i * fretH} stroke="#b9bec4" strokeOpacity={0.6} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={padX + s * gap} x2={padX + s * gap} y1={top} y2={top + frets * fretH} stroke="#d4a964" strokeWidth={1.6 - s * 0.15} />
      ))}
      {shape.split('').map((c, s) => {
        const x = padX + s * gap;
        if (c === 'x') return <text key={s} x={x} y={top - 9} textAnchor="middle" fontSize={gap * 0.85} fill="#a89c92">×</text>;
        const f = Number(c);
        if (f === 0) return <circle key={s} cx={x} cy={top - 12} r={gap * 0.2} fill="none" stroke="#ece4d4" strokeWidth={1.4} />;
        return <circle key={s} cx={x} cy={top + (f - 0.5) * fretH} r={gap * 0.33} fill="#ffae42" />;
      })}
    </svg>
  );
}
