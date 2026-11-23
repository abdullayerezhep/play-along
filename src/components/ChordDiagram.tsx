import { chordGuide } from '../game/chordGuide';

type Props = {
  chord: string;
  size?: number;
  /** Write the finger numbers on the dots (needs a diagram of about 120 px or more to be readable). */
  fingers?: boolean;
};

/**
 * A chord box as guitar books draw it: six strings (thickest on the left), four frets,
 * a dot where each finger goes, ○ for a string that rings open and × for one to leave out.
 */
export function ChordDiagram({ chord, size = 90, fingers = false }: Props) {
  const guide = chordGuide(chord);
  if (!guide) return null;
  const { shape } = guide;
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  const top4 = Math.max(0, ...fretted) <= 4;
  const base = top4 ? 1 : Math.min(...fretted); // first fret shown
  const w = size, h = size * 1.15;
  const padX = w * 0.16, top = h * 0.2, frets = 4;
  const gap = (w - padX * 2) / 5;
  const fretH = (h - top - h * 0.06) / frets;
  const r = gap * (fingers ? 0.4 : 0.33);
  const x = (s: number) => padX + s * gap;
  const y = (fret: number) => top + (fret - base + 0.5) * fretH;

  // a finger lying across several strings is drawn as a bar
  const bars = [1, 2, 3, 4].map((finger) => {
    const on = guide.fingers.map((f, s) => (f === finger ? s : -1)).filter((s) => s >= 0);
    return on.length > 1 ? { finger, from: on[0], to: on[on.length - 1], fret: shape[on[0]] as number } : null;
  }).filter((b) => b !== null);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="chord-diagram" role="img" aria-label={`${chord} chord shape`}>
      {top4
        ? <rect x={padX - 1} y={top - 4} width={gap * 5 + 2} height={4} rx={1} fill="#ece4d4" />
        : <text x={padX - r - 3} y={y(base) + gap * 0.28} textAnchor="end" fontSize={gap * 0.8} fill="#a89c92">{base}</text>}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padX} x2={padX + gap * 5} y1={top + i * fretH} y2={top + i * fretH} stroke="#b9bec4" strokeOpacity={0.6} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + frets * fretH} stroke="#d4a964" strokeWidth={1.6 - s * 0.15} />
      ))}
      {bars.map((b) => (
        <rect key={`b${b.finger}`} x={x(b.from) - r} y={y(b.fret) - r} width={x(b.to) - x(b.from) + r * 2} height={r * 2} rx={r} fill="#ffae42" />
      ))}
      {shape.map((f, s) => {
        if (f === null) return <text key={s} x={x(s)} y={top - 9} textAnchor="middle" fontSize={gap * 0.85} fill="#a89c92">×</text>;
        if (f === 0) return <circle key={s} cx={x(s)} cy={top - 12} r={gap * 0.2} fill="none" stroke="#ece4d4" strokeWidth={1.4} />;
        const barred = bars.some((b) => b.finger === guide.fingers[s]);
        return (
          <g key={s}>
            {!barred && <circle cx={x(s)} cy={y(f)} r={r} fill="#ffae42" />}
            {fingers && (!barred || s === bars.find((b) => b.finger === guide.fingers[s])!.from) && (
              <text x={x(s)} y={y(f) + r * 0.42} textAnchor="middle" fontSize={r * 1.25} fontWeight={700} fill="#2a1606">{guide.fingers[s]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
