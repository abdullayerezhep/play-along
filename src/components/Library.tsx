import { PATTERNS } from '../game/chart';
import { CHORD_GROUPS, chordGuide } from '../game/chordGuide';
import { ChordDiagram } from './ChordDiagram';
import { useChordHelp } from './chordHelp';
import { slotsFromHits } from '../game/slots';
import { StrumStrip } from './StrumStrip';

/** The guide: how to read a chord box, every chord with its fingering, and every strum pattern. */
export function Library() {
  const showHelp = useChordHelp();
  return (
    <div className="library">
      <header className="page-head"><h1>Chords and strumming</h1></header>

      <section className="lib-reading">
        <ChordDiagram chord="C" size={170} fingers />
        <div>
          <h2>How to read a chord box</h2>
          <p>It is the neck of the guitar standing upright, seen from the front.</p>
          <ul>
            <li>The six lines going down are the <b>strings</b>. The thickest one (low E) is on the left.</li>
            <li>The lines going across are the <b>frets</b>. The thick bar at the top is the nut, where the neck begins.</li>
            <li>A <b>dot</b> is a fingertip. Press just behind the fret, not on top of it. The number says which finger: 1 index, 2 middle, 3 ring, 4 little.</li>
            <li><b>○</b> above a string: play it open, with no finger on it.</li>
            <li><b>×</b> above a string: leave it out of the strum.</li>
          </ul>
          <p>This one is C: three fingers, two open strings, and the low E string left out.</p>
        </div>
      </section>

      {CHORD_GROUPS.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <p className="lede">{group.about}</p>
          <div className="chord-grid">
            {group.chords.map((chord) => {
              const g = chordGuide(chord)!;
              return (
                <button key={chord} className="chord-tile" onClick={() => showHelp(chord)} aria-label={`${g.fullName}: how to play it`}>
                  <ChordDiagram chord={chord} size={118} fingers />
                  <span className="tile-name">{chord}</span>
                  <span className="tile-full">{g.fullName}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2>Strumming</h2>
        <p className="lede">
          A <b>downstrum</b> (▼) moves from the thick strings towards the floor and hits all the strings of the chord.
          An <b>upstrum</b> (▲) comes back up and only needs to catch the thinnest three or four.
          Count each bar "1 and 2 and 3 and 4 and": your hand goes down on the numbers and up on the "ands", all the time,
          like a pendulum. A pattern is just a choice of which swings touch the strings.
        </p>
        <div className="pattern-list">
          {PATTERNS.map((p) => (
            <article key={p.id} className="pattern-card">
              <h3>{p.name}<small>{p.level}</small></h3>
              <StrumStrip slots={slotsFromHits(p.hits)} count />
              <p className="say">{p.say}</p>
              <p>{p.about}</p>
            </article>
          ))}
        </div>
        <p className="note">The game hears when you strum and which chord it is. It cannot hear whether a strum went down or up, so the arrows are there to teach the pattern, not to be judged.</p>
      </section>
    </div>
  );
}
