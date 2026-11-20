import { accuracy, grade, median, type Stats } from '../game/judge';

type Props = { stats: Stats; onRetry: () => void; onMenu: () => void };

export function Results({ stats, onRetry, onMenu }: Props) {
  const acc = accuracy(stats);
  const g = grade(acc);
  const lean = Math.round(median(stats.offsets) * 1000);
  const tip =
    stats.offsets.length < 4 ? 'Not enough hits to read your timing yet.'
    : Math.abs(lean) < 15 ? 'Your timing is centred on the beat. Nice.'
    : lean > 0 ? `You tend to strum ${lean} ms late. Try anticipating the beat a little.`
    : `You tend to strum ${-lean} ms early. Relax and let the beat come to you.`;

  return (
    <div className="setup">
      <section className="panel center results">
        <div className={`grade grade-${g}`}>{g}</div>
        <div className="big-score">{stats.score.toLocaleString()}</div>
        <p className="muted">{Math.round(acc * 100)}% accuracy · max combo {stats.maxCombo}</p>
        <div className="tally">
          <div><span className="perfect">PERFECT</span><strong>{stats.perfect}</strong></div>
          <div><span className="good">GOOD</span><strong>{stats.good}</strong></div>
          <div><span className="miss">MISS</span><strong>{stats.miss}</strong></div>
        </div>
        <p className="small">{tip}</p>
        <div className="row">
          <button className="btn" onClick={onRetry}>↻ Retry</button>
          <button className="btn ghost" onClick={onMenu}>Menu</button>
        </div>
      </section>
    </div>
  );
}
