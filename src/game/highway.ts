import { BEATS_PER_BAR, type Note } from './chart';

/** Seconds of notes visible ahead of the strum line. */
export const LOOKAHEAD = 2.4;

export const COLORS = {
  down: '#ffae42', up: '#6fd1bf', mute: '#a89c92',
  perfect: '#ffd27a', good: '#d9cbb3', miss: '#f0645a', hold: '#ffae42',
};

type Popup = { text: string; sub?: string; color: string; born: number };

const STRINGS = [-0.4, -0.24, -0.08, 0.08, 0.24, 0.4];
const STRING_W = [1, 1.2, 1.5, 2.1, 2.6, 3.1];
const FAR_SCALE = 0.32; // the far end of the board is this fraction of its near width
const K = (1 / FAR_SCALE - 1) / LOOKAHEAD;

/**
 * Draws the game: a guitar neck in perspective with the notes travelling down it.
 * Frets fall on the beats, the strum line is the saddle. Pure drawing, no rules.
 *
 * Board coordinates: u = position across the board (-0.5..0.5),
 * d = seconds ahead of the strum line.
 */
export class Highway {
  private g: CanvasRenderingContext2D;
  private W = 0; private H = 0; private cx = 0; private baseY = 0; private vanishY = 0; private baseW = 0;
  private narrow = false;
  private popups: Popup[] = [];
  private strumAmp = 0; private strumPhase = 0; private glow = 0; private glowColor = COLORS.down;

  constructor(
    private canvas: HTMLCanvasElement,
    private o: { spb: number; totalBeats: number; motion: number },
  ) {
    this.g = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.narrow = this.W < 700;
    this.cx = this.W / 2;
    this.baseW = Math.min(this.W * (this.narrow ? 0.9 : 0.62), 520);
    this.baseY = this.H * 0.84;
    this.vanishY = this.baseY - Math.min(this.baseY - (this.narrow ? 150 : 0), 1.55 * this.baseW);
  }

  /** Shake the strings and light the strum line. */
  strum(color: string, strength: number) {
    this.strumAmp = Math.max(this.strumAmp, strength * this.o.motion);
    this.glow = 1;
    this.glowColor = color;
  }

  /** Show a judgement word above the strum line. */
  pop(text: string, color: string, sub?: string) {
    this.popups.push({ text, sub, color, born: performance.now() });
    while (this.popups.length > 3) this.popups.shift();
  }

  private sc(d: number) { return 1 / (1 + Math.max(-0.2, d) * K); }
  private py(d: number) { return this.vanishY + (this.baseY - this.vanishY) * this.sc(d); }
  private px(u: number, d: number) { return this.cx + u * this.baseW * this.sc(d); }

  private trap(u0: number, u1: number, d0: number, d1: number) {
    const g = this.g;
    g.beginPath();
    g.moveTo(this.px(u0, d0), this.py(d0)); g.lineTo(this.px(u1, d0), this.py(d0));
    g.lineTo(this.px(u1, d1), this.py(d1)); g.lineTo(this.px(u0, d1), this.py(d1));
    g.closePath();
  }

  /** `now` is the song clock in seconds (negative during the count-in). `frozen` stops the string motion. */
  draw(now: number, notes: Note[], frozen = false) {
    const g = this.g;
    g.clearRect(0, 0, this.W, this.H);
    this.drawBoard(now);

    let ringing = false;
    for (const n of notes) {
      if (n.time - now > LOOKAHEAD) break;
      if (n.len) { this.drawTail(n, now); if (n.hold === 'holding') ringing = true; }
    }
    this.drawStrings(ringing, frozen);

    // fade the far end of the neck into the dark
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const fadeTop = this.py(LOOKAHEAD) - 2, fadeBottom = this.py(LOOKAHEAD * 0.62);
    const fade = g.createLinearGradient(0, fadeTop, 0, fadeBottom);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade;
    g.fillRect(0, fadeTop, this.W, fadeBottom - fadeTop);
    g.restore();
    this.drawSaddle(frozen);

    // far notes first so near ones overlap them
    const visible: Note[] = [];
    for (const n of notes) {
      const d = n.time - now;
      if (d > LOOKAHEAD) break;
      if (d < -0.25 || n.result === 'perfect' || n.result === 'good' || n.result === 'wrong') continue;
      visible.push(n);
    }
    for (let i = visible.length - 1; i >= 0; i--) this.drawNote(visible[i], now);

    if (now < 0) this.drawCountIn(now);
    this.drawPopups();
  }

  private drawBoard(now: number) {
    const g = this.g, { spb, totalBeats } = this.o;
    const top = this.py(LOOKAHEAD), bottom = this.py(-0.2);
    const wood = g.createLinearGradient(0, top, 0, bottom);
    wood.addColorStop(0, 'rgba(58,36,26,0)');
    wood.addColorStop(0.25, '#3a241a');
    wood.addColorStop(1, '#4a2e21');
    g.fillStyle = wood;
    this.trap(-0.5, 0.5, -0.2, LOOKAHEAD);
    g.fill();
    // grain
    g.save();
    this.trap(-0.5, 0.5, -0.2, LOOKAHEAD); g.clip();
    g.strokeStyle = 'rgba(20,10,6,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const u = -0.5 + (i + 0.5) / 22 + Math.sin(i * 12.9) * 0.01;
      g.beginPath(); g.moveTo(this.px(u, -0.2), this.py(-0.2)); g.lineTo(this.px(u, LOOKAHEAD), this.py(LOOKAHEAD)); g.stroke();
    }
    g.restore();
    // binding
    g.strokeStyle = 'rgba(236,228,212,0.55)';
    g.lineWidth = 2;
    for (const u of [-0.5, 0.5]) {
      g.beginPath(); g.moveTo(this.px(u, -0.2), this.py(-0.2)); g.lineTo(this.px(u, LOOKAHEAD), this.py(LOOKAHEAD)); g.stroke();
    }

    // frets on the beats, a pearl inlay in the middle of each bar
    const firstBeat = Math.floor((now - 0.2) / spb);
    const lastBeat = Math.ceil((now + LOOKAHEAD) / spb);
    for (let b = Math.max(-BEATS_PER_BAR, firstBeat); b <= Math.min(totalBeats, lastBeat); b++) {
      const d = b * spb - now;
      if (d < -0.2 || d > LOOKAHEAD) continue;
      const isBar = b % BEATS_PER_BAR === 0;
      const y = this.py(d), s = this.sc(d);
      g.globalAlpha = Math.min(1, (LOOKAHEAD - d) / 0.6);
      g.fillStyle = isBar ? '#d9dde0' : 'rgba(185,190,196,0.55)';
      g.fillRect(this.px(-0.5, d), y - (isBar ? 2.5 : 1.5) * s, this.baseW * s, (isBar ? 5 : 3) * s);
      if (b % BEATS_PER_BAR === 2 && b > 0) {
        const bar = Math.floor(b / BEATS_PER_BAR);
        g.fillStyle = 'rgba(239,233,223,0.8)';
        const r = 7 * s;
        for (const u of (bar + 1) % 4 === 0 ? [-0.14, 0.14] : [0]) {
          g.beginPath(); g.ellipse(this.px(u, d), y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
        }
      }
      if (isBar && b >= 0 && b < totalBeats && !this.narrow) {
        g.fillStyle = 'rgba(236,228,212,0.45)';
        g.font = `600 ${Math.round(13 * s + 4)}px "Big Shoulders Display", sans-serif`;
        g.textAlign = 'left';
        g.fillText(String(b / BEATS_PER_BAR + 1), this.px(0.5, d) + 10 * s, y + 5 * s);
      }
      g.globalAlpha = 1;
    }
  }

  private drawStrings(ringing: boolean, frozen: boolean) {
    const g = this.g;
    if (!frozen) {
      this.strumPhase += 0.9;
      if (ringing) this.strumAmp = Math.max(this.strumAmp, 0.45 * this.o.motion);
      else this.strumAmp *= 0.93;
    }
    STRINGS.forEach((u, i) => {
      g.strokeStyle = i < 2 ? '#e3e6e8' : '#d4a964';
      g.globalAlpha = 0.85;
      g.lineWidth = STRING_W[i];
      g.beginPath();
      const N = 40;
      for (let k = 0; k <= N; k++) {
        const d = -0.2 + (LOOKAHEAD + 0.2) * (k / N);
        // a standing wave, strongest near the strum line
        const env = Math.sin(Math.PI * Math.min(1, (k + 2) / (N * 0.55)));
        const off = this.strumAmp * 4.5 * env * Math.sin(this.strumPhase * (1 + i * 0.13) + k * 0.35) * this.sc(d);
        if (k === 0) g.moveTo(this.px(u, d) + off, this.py(d)); else g.lineTo(this.px(u, d) + off, this.py(d));
      }
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  private drawTail(n: Note, now: number) {
    if (n.hold === 'done') return;
    const g = this.g;
    const holding = n.hold === 'holding' || !!(n.awaitingChord && n.len);
    const dead = n.hold === 'broken' || n.result === 'miss' || n.result === 'wrong';
    const d0 = holding ? 0 : n.time - now;
    const d1 = Math.min(LOOKAHEAD, n.endTime! - now);
    if (d1 <= Math.max(-0.2, d0)) return;
    const grad = g.createLinearGradient(0, this.py(d0), 0, this.py(d1));
    const c = dead ? '120,110,100' : '255,174,66';
    grad.addColorStop(0, `rgba(${c},${holding ? 0.55 : 0.32})`);
    grad.addColorStop(1, `rgba(${c},${holding ? 0.25 : 0.12})`);
    g.fillStyle = grad;
    this.trap(-0.44, 0.44, Math.max(-0.2, d0), d1);
    g.fill();
    if (n.endTime! - now < LOOKAHEAD) { // where the note ends
      g.fillStyle = dead ? 'rgba(120,110,100,0.6)' : 'rgba(255,174,66,0.9)';
      g.fillRect(this.px(-0.44, d1), this.py(d1) - 1.5, this.baseW * 0.88 * this.sc(d1), 3);
    }
  }

  private drawNote(n: Note, now: number) {
    const g = this.g;
    const d = n.time - now;
    const s = this.sc(d), y = this.py(d);
    const missed = n.result === 'miss';
    const half = n.chop ? 0.26 : 0.46;
    const h = Math.max(4, 20 * s);
    const x0 = this.px(-half, d), w = this.px(half, d) - x0;
    const color = missed ? '#5a4c44' : COLORS[n.stroke];
    g.save();
    g.globalAlpha = Math.min(1, (LOOKAHEAD - d) / 0.5) * (missed ? 0.6 : 1);
    g.fillStyle = color;
    g.beginPath(); g.roundRect(x0, y - h / 2, w, h, h / 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.roundRect(x0 + h * 0.4, y - h / 2 + h * 0.14, w - h * 0.8, h * 0.22, h * 0.11); g.fill();
    // engraving: suggested direction, or crosses for a muted chuck
    g.fillStyle = 'rgba(31,20,16,0.85)';
    g.strokeStyle = 'rgba(31,20,16,0.85)';
    const a = h * 0.32;
    if (n.stroke === 'mute') {
      g.lineWidth = Math.max(1.5, 2.5 * s);
      for (const u of [-0.3, -0.1, 0.1, 0.3]) {
        const xx = this.px(u, d);
        g.beginPath(); g.moveTo(xx - a, y - a); g.lineTo(xx + a, y + a); g.moveTo(xx + a, y - a); g.lineTo(xx - a, y + a); g.stroke();
      }
    } else {
      g.beginPath();
      if (n.stroke === 'down') { g.moveTo(this.cx - a * 1.4, y - a); g.lineTo(this.cx + a * 1.4, y - a); g.lineTo(this.cx, y + a); }
      else { g.moveTo(this.cx - a * 1.4, y + a); g.lineTo(this.cx + a * 1.4, y + a); g.lineTo(this.cx, y - a); }
      g.fill();
    }
    if (n.chop && !missed) { // a dot marks a chop, like staccato in sheet music
      g.beginPath(); g.arc(this.px(half, d) + h * 0.55, y, h * 0.2, 0, Math.PI * 2);
      g.fillStyle = color; g.fill();
    }
    g.restore();
    // the chord's name where it changes: beside the neck, or above the note on a narrow screen
    if (n.chordChange && !missed) {
      g.globalAlpha = Math.min(1, (LOOKAHEAD - d) / 0.5);
      g.fillStyle = 'rgba(236,228,212,0.95)';
      g.font = `800 ${Math.round(30 * s + 8)}px "Big Shoulders Display", sans-serif`;
      if (this.narrow) { g.textAlign = 'left'; g.fillText(n.chord, this.px(-0.46, d), y - h * 0.9); }
      else { g.textAlign = 'right'; g.fillText(n.chord, this.px(-0.5, d) - 14 * s, y + 10 * s); }
      g.globalAlpha = 1;
    }
  }

  /** The strum line: a bone saddle across the strings. */
  private drawSaddle(frozen: boolean) {
    const g = this.g;
    if (!frozen) this.glow *= 0.9;
    const y = this.py(0), w = Math.min(this.W - 8, this.baseW * 1.04);
    if (this.glow > 0.02) {
      const r = g.createRadialGradient(this.cx, y, 0, this.cx, y, w * 0.6);
      r.addColorStop(0, this.glowColor + Math.round(this.glow * 90).toString(16).padStart(2, '0'));
      r.addColorStop(1, this.glowColor + '00');
      g.fillStyle = r;
      g.fillRect(this.cx - w * 0.6, y - w * 0.3, w * 1.2, w * 0.6);
    }
    g.fillStyle = '#ece4d4';
    g.beginPath(); g.roundRect(this.cx - w / 2, y - 4, w, 8, 4); g.fill();
    g.fillStyle = 'rgba(31,20,16,0.25)';
    g.fillRect(this.cx - w / 2 + 4, y + 1, w - 8, 2);
  }

  private drawCountIn(now: number) {
    const g = this.g, { spb } = this.o;
    const left = Math.ceil(-now / spb);
    const f = 1 - ((-now / spb) % 1);
    g.fillStyle = `rgba(236,228,212,${0.9 - f * 0.6})`;
    g.font = `800 ${Math.round(120 + f * 30)}px "Big Shoulders Display", sans-serif`;
    g.textAlign = 'center';
    g.fillText(String(left), this.cx, this.py(LOOKAHEAD * 0.45));
  }

  /** Judgement words, newest at the bottom. */
  private drawPopups() {
    const g = this.g, t = performance.now();
    this.popups.forEach((p, i) => {
      const age = (t - p.born) / 700;
      if (age >= 1) return;
      const y = this.py(0) - 48 - (this.popups.length - 1 - i) * 40 - age * 18;
      g.globalAlpha = Math.min(1, (1 - age) * 1.6);
      g.fillStyle = p.color;
      g.font = '800 34px "Big Shoulders Display", sans-serif';
      g.textAlign = 'center';
      g.fillText(p.text, this.cx, y);
      if (p.sub) {
        g.font = '600 14px "Instrument Sans", sans-serif';
        g.fillStyle = 'rgba(236,228,212,0.85)';
        g.fillText(p.sub, this.cx, y + 20);
      }
    });
    g.globalAlpha = 1;
  }
}
