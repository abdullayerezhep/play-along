import type { Slot } from '../game/slots';

const COUNT = ['1', '&', '2', '&', '3', '&', '4', '&'];
const ARROW = { down: '▼', up: '▲', mute: '×' };

type Props = {
  slots: Slot[];
  /** Write "1 & 2 & 3 & 4 &" under the strums. */
  count?: boolean;
  /** Highlight this slot (0–7) as the one being played. */
  cursor?: number;
};

/**
 * A bar of strumming drawn the way guitar teachers write it: ▼ down, ▲ up,
 * × a muted strum, a long bar for "let it ring", and gaps where the hand passes
 * without touching the strings.
 */
export function StrumStrip({ slots, count, cursor }: Props) {
  const cells: JSX.Element[] = [];
  for (let i = 0; i < 8; i++) {
    const h = slots[i];
    const here = cursor === i ? ' now' : '';
    if (!h) { cells.push(<span key={i} className={`slot${here}`} style={{ gridColumn: i + 1 }} />); continue; }
    const span = h.len ? Math.min(8 - i, Math.round(h.len * 2)) : 1;
    const inSpan = cursor !== undefined && cursor >= i && cursor < i + span ? ' now' : '';
    cells.push(
      <span key={i} className={`slot hit ${h.s}${h.chop ? ' chop' : ''}${h.len ? ' long' : ''}${inSpan}`} style={{ gridColumn: `${i + 1} / span ${span}` }}>
        {ARROW[h.s]}
      </span>,
    );
    i += span - 1;
  }
  return (
    <span className={`strip${count ? ' counted' : ''}`} aria-hidden>
      {cells}
      {count && COUNT.map((c, i) => <span key={`c${i}`} className={`count${cursor === i ? ' now' : ''}`} style={{ gridColumn: i + 1 }}>{c}</span>)}
    </span>
  );
}
