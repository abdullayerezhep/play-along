import { useEffect, useRef, useState } from 'react';
import { matchesChord } from '../audio/chords';
import type { AudioEngine } from '../audio/engine';
import { chordGuide } from '../game/chordGuide';
import { ChordDiagram } from './ChordDiagram';

type Props = { chord: string; engine: AudioEngine; onClose: () => void };

/** What the mic made of the last strum, compared with the chord on the card. */
function useChordCheck(engine: AudioEngine, chord: string) {
  const [heard, setHeard] = useState<{ name: string; ok: boolean; n: number } | null>(null);
  useEffect(() => {
    return engine.onChord(({ result, plain }) => {
      const ok = matchesChord(result, chord) || matchesChord(plain, chord);
      const name = result.clarity < 0.55 ? 'muted strings' : result.best.name;
      setHeard((h) => ({ name: ok ? chord : name, ok, n: (h?.n ?? 0) + 1 }));
    });
  }, [engine, chord]);
  return heard;
}

/** The full explanation of one chord: big diagram with finger numbers, steps, a tip, and a listening check. */
export function ChordCard({ chord, engine, onClose }: Props) {
  const guide = chordGuide(chord);
  const heard = useChordCheck(engine, chord);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listening = engine.micReady && engine.ctx.state === 'running';

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!guide) return null;
  return (
    <div className="card-backdrop" onClick={onClose}>
      <div className="chord-help" role="dialog" aria-modal="true" aria-label={`How to play ${guide.fullName}`} onClick={(e) => e.stopPropagation()}>
        <div className="chord-help-figure">
          <ChordDiagram chord={chord} size={200} fingers />
          <p className="fig-note">Thickest string on the left. Numbers are fingers: 1 index, 2 middle, 3 ring, 4 little.</p>
        </div>
        <div className="chord-help-text">
          <h2>{guide.name}<small>{guide.fullName}{guide.barre ? ', a barre chord' : ''}</small></h2>
          <ol>{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="tip">{guide.tip}</p>
          <p className="made-of">Notes in it: {guide.notes.join(', ')}.{guide.songs.length > 0 && <> Used in {guide.songs.join(', ')}.</>}</p>
          <div className={`try${heard ? (heard.ok ? ' ok' : ' bad') : ''}`} aria-live="polite">
            {!listening ? 'Turn on the microphone in Settings and this card will tell you whether your chord sounds right.'
              : !heard ? 'Try it: strum the chord and I will listen.'
              : heard.ok ? `That sounds like ${chord}.`
              : `I heard ${heard.name}, not ${chord}. Check each finger, then pick the strings one at a time to find the one that is off.`}
          </div>
          <button ref={closeRef} className="btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
