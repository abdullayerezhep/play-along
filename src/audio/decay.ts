// Tracks recent loudness so we can tell a chord that's ringing from one that was muted.
// A guitar fades gradually; a mute (palm, fretting hand lifting, a chuck) drops off a cliff.

export class LevelHistory {
  private t: number[] = [];
  private v: number[] = [];

  push(time: number, level: number) {
    this.t.push(time);
    this.v.push(level);
    // keep ~4 s
    while (this.t.length && this.t[0] < time - 4) { this.t.shift(); this.v.shift(); }
  }

  get latestTime() { return this.t.length ? this.t[this.t.length - 1] : -Infinity; }

  private maxIn(t0: number, t1: number) {
    let m = 0;
    for (let i = 0; i < this.t.length; i++) if (this.t[i] >= t0 && this.t[i] <= t1 && this.v[i] > m) m = this.v[i];
    return m;
  }

  /**
   * Level at `at` relative to the strum's peak right after `onset` (0..1+).
   * ~0.6–0.9 for a chord ringing on, well under 0.2 for a chop or chuck.
   */
  decayRatio(onset: number, at: number): number | null {
    const peak = this.maxIn(onset - 0.005, onset + 0.08);
    const later = this.maxIn(at - 0.03, at + 0.01);
    if (!peak || this.latestTime < at) return null;
    return later / peak;
  }

  /**
   * Has the sound just been cut off? True when the last two readings are both far
   * below the level of a moment ago. Only looks past the strum's initial attack.
   */
  suddenDrop(onset: number): boolean {
    const n = this.t.length;
    if (n < 3) return false;
    const tLast = this.t[n - 1];
    const refFrom = Math.max(onset + 0.12, tLast - 0.25);
    const refTo = tLast - 0.07;
    if (refTo <= refFrom) return false;
    const ref = this.maxIn(refFrom, refTo);
    if (!ref) return false;
    return this.v[n - 1] < ref * 0.2 && this.v[n - 2] < ref * 0.2;
  }
}
