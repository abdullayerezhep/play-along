import { GRADES, type Grade } from '../game/judge';

/**
 * A result as one to five stars. (Letter grades would collide with chord names:
 * an "A" or a "C" next to a song looks like a chord.)
 */
export function Stars({ grade, big }: { grade: Grade; big?: boolean }) {
  const n = GRADES.length - GRADES.indexOf(grade);
  return (
    <span className={`stars${big ? ' big' : ''}`} role="img" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => <span key={i} className={i < n ? 'on' : ''}>★</span>)}
    </span>
  );
}
