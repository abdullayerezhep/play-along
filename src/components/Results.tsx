import { accuracy, grade, median, type Stats } from '../game/judge';

type Props = { stats: Stats; calibrated: boolean; usedMic: boolean; onRetry: () => void; onMenu: () => void };

export function Results({ stats, calibrated, usedMic, onRetry, onMenu }: Props) {
  const acc = accuracy(stats);
  const g = grade(acc);
  const lean = Math.round(median(stats.offsets) * 1000);
  const tip =
    usedMic && !calibrated ? 'Timing was judged with a guessed delay. Measure the delay from the menu to get a fair timing score.'
    : stats.offsets.length < 4 ? 'Not enough hits to read your timing yet.'
    : Math.abs(lean) < 15 ? 'Your timing sits right on the beat.'
    : lean > 0 ? `You tend to strum ${lean} ms late. Try moving a touch earlier.`
    : `You tend to strum ${-lean} ms early. Relax and let the beat come to you.`;

  return (
    <div className="menu results">
      <div className={`grade grade-${g}`} aria-label={`Grade ${g}`}>{g}</div>
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
