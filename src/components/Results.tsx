import { accuracy, grade, median, type Stats } from '../game/judge';
import { ChordChip } from './ChordChip';
import { Stars } from './Stars';

type Props = {
  stats: Stats; learn: boolean; newBest: boolean; calibrated: boolean; usedMic: boolean;
  onRetry: () => void; onMenu: () => void; onPlayMode: () => void;
};

/** After a song in learn mode: what went right at the first attempt, and which chords need work. */
function LearnResults({ stats, onRetry, onMenu, onPlayMode }: Pick<Props, 'stats' | 'onRetry' | 'onMenu' | 'onPlayMode'>) {
  const total = stats.perfect + stats.good;
  const share = total ? stats.firstTry / total : 0;
  const hard = Object.entries(stats.retryChords).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="results">
      <h2 className="done">You played the whole song</h2>
      <dl className="tally">
        <div><dt>Right first time</dt><dd className="perfect">{stats.firstTry}/{total}</dd></div>
        <div><dt>Second tries</dt><dd>{stats.retries}</dd></div>
        {stats.holds > 0 && <div><dt>Rang out</dt><dd>{stats.holdsDone}/{stats.holds}</dd></div>}
        {stats.chops > 0 && <div><dt>Clean chops</dt><dd>{stats.chopsOk}/{stats.chops}</dd></div>}
      </dl>
      {hard.length > 0 && (
        <div className="practise">
          <p className="advice">These needed the most second tries. Click one to see how to play it:</p>
          <div className="chips">
            {hard.map(([chord, n]) => (chord === 'muted strum'
              ? <span key={chord} className="chip">muted strum ×{n}</span>
              : <span key={chord} className="counted-chip"><ChordChip chord={chord} /> ×{n}</span>))}
          </div>
        </div>
      )}
      <p className="advice">
        {share >= 0.9 ? 'Nearly every strum was right at the first attempt. You are ready to try this song in Play mode, where the song keeps going. Start with a slow tempo.'
          : share >= 0.6 ? 'Good progress. Play it again until the chord changes come without stopping to think.'
          : 'This one is still new to your hands, and that is normal. Play it again, or pick a song with fewer chords.'}
      </p>
      <div className="actions">
        <button className="btn go" onClick={onRetry}>Play it again</button>
        {share >= 0.9 && <button className="btn quiet" onClick={onPlayMode}>Try it in Play mode</button>}
        <button className="btn quiet" onClick={onMenu}>Change song</button>
      </div>
    </div>
  );
}

export function Results(props: Props) {
  const { stats, learn, newBest, calibrated, usedMic, onRetry, onMenu } = props;
  const acc = accuracy(stats);
  const g = grade(acc);
  const lean = Math.round(median(stats.offsets) * 1000);
  const tip =
    usedMic && !calibrated ? 'Timing was judged with a guessed delay. Measure the delay in Settings to get a fair timing score.'
    : stats.offsets.length < 4 ? 'Not enough hits to read your timing yet.'
    : Math.abs(lean) < 15 ? 'Your timing sits right on the beat.'
    : lean > 0 ? `You tend to strum ${lean} ms late. Try moving a touch earlier.`
    : `You tend to strum ${-lean} ms early. Relax and let the beat come to you.`;

  if (learn) return <LearnResults {...props} />;

  return (
    <div className="results">
      <Stars grade={g} big />
      {newBest && <p className="new-best">Your best on this song so far</p>}
      <div className="final-score">{stats.score.toLocaleString()}</div>
      <p className="lede">{Math.round(acc * 100)}% accurate, longest streak {stats.maxCombo}</p>
      <dl className="tally">
        <div><dt>Perfect</dt><dd className="perfect">{stats.perfect}</dd></div>
        <div><dt>Good</dt><dd>{stats.good}</dd></div>
        <div><dt>Wrong chord</dt><dd className="bad">{stats.wrong}</dd></div>
        <div><dt>Missed</dt><dd className="bad">{stats.miss}</dd></div>
        {stats.extra > 0 && <div><dt>Extra strums</dt><dd className="bad">{stats.extra}</dd></div>}
        {stats.holds > 0 && <div><dt>Rang out</dt><dd>{stats.holdsDone}/{stats.holds}</dd></div>}
        {stats.chops > 0 && <div><dt>Clean chops</dt><dd>{stats.chopsOk}/{stats.chops}</dd></div>}
      </dl>
      <p className="advice">{tip}</p>
      {stats.extra >= 4 && stats.extra > stats.miss && (
        <p className="advice dim">Extra strums cost you: strum only where the song has a note.</p>
      )}
      {stats.wrong > stats.miss && stats.wrong >= 3 && (
        <p className="advice dim">Most points went to wrong chords. Slow the tempo down and watch the next chord's shape so your hand moves early. If the chords were right, check your tuning.</p>
      )}
      <div className="actions">
        <button className="btn go" onClick={onRetry}>Play again</button>
        <button className="btn quiet" onClick={onMenu}>Change song</button>
      </div>
    </div>
  );
}
