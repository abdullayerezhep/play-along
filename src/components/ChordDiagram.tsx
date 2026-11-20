import { CHORD_SHAPES } from '../game/chart';

export function ChordDiagram({ chord, size = 90 }: { chord: string; size?: number }) {
  const shape = CHORD_SHAPES[chord];
  if (!shape) return null;
  const w = size, h = size * 1.15;
  const padX = w * 0.14, top = h * 0.2, frets = 4;
  const gap = (w - padX * 2) / 5;
  const fretH = (h - top - h * 0.06) / frets;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="chord-diagram" aria-label={`${chord} chord shape`}>
      <rect x={padX} y={top - 3} width={gap * 5} height={3} fill="currentColor" />
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padX} x2={padX + gap * 5} y1={top + i * fretH} y2={top + i * fretH} stroke="currentColor" strokeOpacity={0.5} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={padX + s * gap} x2={padX + s * gap} y1={top} y2={top + frets * fretH} stroke="currentColor" strokeOpacity={0.7} />
      ))}
      {shape.split('').map((c, s) => {
        const x = padX + s * gap;
        if (c === 'x') return <text key={s} x={x} y={top - 8} textAnchor="middle" fontSize={gap * 0.9} fill="currentColor" opacity={0.6}>×</text>;
        const f = Number(c);
        if (f === 0) return <circle key={s} cx={x} cy={top - 11} r={gap * 0.22} fill="none" stroke="currentColor" />;
        return <circle key={s} cx={x} cy={top + (f - 0.5) * fretH} r={gap * 0.32} fill="var(--accent)" />;
      })}
    </svg>
  );
}
