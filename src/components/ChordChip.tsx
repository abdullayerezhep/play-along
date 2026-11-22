import { ChordDiagram } from './ChordDiagram';
import { useChordHelp } from './chordHelp';

/**
 * A chord name you can point at or click: hovering (or focusing) shows its shape,
 * clicking opens the full explanation.
 */
export function ChordChip({ chord }: { chord: string }) {
  const showHelp = useChordHelp();
  return (
    <button type="button" className="chip chord-chip" aria-label={`${chord}: how to play it`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); showHelp(chord); }}>
      {chord}
      <span className="chip-pop" aria-hidden><ChordDiagram chord={chord} size={96} fingers /></span>
    </button>
  );
}
