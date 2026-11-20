import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesChord } from '../audio/chords';
import type { AudioEngine } from '../audio/engine';
import { BEATS_PER_BAR, PROGRESSIONS, buildChart, chordForBar, rootFreq, type Note } from '../game/chart';
import {
  confirmChord, emptyStats, holdTick, judgeStrum, multiplier, rejectChord, sweepMisses, type Stats,
} from '../game/judge';
import type { AppSettings } from '../settings';
import { ChordDiagram } from './ChordDiagram';

type Props = { engine: AudioEngine; settings: AppSettings; onFinish: (s: Stats) => void; onQuit: () => void };

type Popup = { text: string; sub?: string; color: string; born: number };

const LOOKAHEAD = 2.4; // seconds of notes visible above the hit line
const COLORS = {
  down: '#ffae42', up: '#6fd1bf', mute: '#a89c92',
  perfect: '#ffd27a', good: '#d9cbb3', miss: '#f0645a', wrong: '#f0645a', hold: '#ffae42',
};
/** A chuck counts as muted if the sound fell below this fraction of its peak within 150 ms. */
const MUTED_RATIO = 0.3;

export function Game({ engine, settings, onFinish, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notes = useMemo<Note[]>(() => buildChart(settings), [settings]);
  const prog = PROGRESSIONS.find((p) => p.id === settings.progressionId) ?? PROGRESSIONS[0];
  const [hud, setHud] = useState({ score: 0, combo: 0, bar: -1, progress: 0 });
  const [heard, setHeard] = useState<{ name: string; ok: boolean } | null>(null);

  const finishRef = useRef(onFinish);
  const quitRef = useRef(onQuit);
  useEffect(() => { finishRef.current = onFinish; quitRef.current = onQuit; });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    const ctx = engine.ctx;
    const spb = 60 / settings.bpm;
    const latency = settings.latencyMs / 1000;
    const chopAt = Math.min(0.25, spb * 0.45); // when we check that a chop was cut short
    const stats = emptyStats();
    const popups: Popup[] = [];
    let done = false;
    const pop = (text: string, color: string, sub?: string) => popups.push({ text, sub, color, born: performance.now() });

    // --- schedule audio -------------------------------------------------
    engine.beginSession();
    const start = ctx.currentTime + 0.6 + BEATS_PER_BAR * spb; // song time 0
    const totalBeats = settings.bars * BEATS_PER_BAR;
    for (let b = -BEATS_PER_BAR; b < totalBeats; b++) {
      const t = start + b * spb;
      if (settings.metronome || b < 0) engine.click(t, b % BEATS_PER_BAR === 0);
      if (settings.bassLine && b >= 0 && b % 2 === 0) {
        engine.bass(t, rootFreq(chordForBar(prog, Math.floor(b / BEATS_PER_BAR))), spb * 1.8);
      }
    }
    const end = totalBeats * spb + 0.8;
    const songNow = () => engine.now - start;

    // --- long notes -----------------------------------------------------
    const finishHold = (n: Note) => {
      holdTick(n, n.endTime!, spb, stats);
      n.hold = 'done';
      stats.holdsDone++;
      pop('Rang out', COLORS.hold, `+${n.holdPoints}`);
      burst(COLORS.down, 0.6);
    };
    const breakHold = (n: Note, why: string) => {
      // forgive letting go in the last moment of the note
      if (songNow() > n.endTime! - spb * 0.35) { finishHold(n); return; }
      n.hold = 'broken';
      pop('Let it ring', COLORS.miss, why);
    };

    // --- input ----------------------------------------------------------
    // strums waiting for the chord check, keyed by onset time
    const pending = new Map<number, Note>();
    const off = engine.onOnset((o) => {
      if (done) return;
      const t = o.time - start - (o.source === 'mic' ? latency : 0);
      burst(COLORS.mute, 0.35);
      // strumming again cuts off a chord you were supposed to let ring
      for (const n of notes) {
        if (n.hold === 'holding' && o.time - (n.onsetCtx ?? 0) > 0.12) breakHold(n, 'strummed again');
      }
      const check = settings.checkChords && o.source === 'mic';
      const hit = judgeStrum(notes, t, stats, check);
      if (!hit) return;
      hit.onsetCtx = o.time;
      hit.source = o.source;
      if (hit.chop) stats.chops++;
      if (check) pending.set(o.time, hit);
      const color = COLORS[hit.result as 'perfect' | 'good'];
      pop(hit.result === 'perfect' ? 'Perfect' : 'Good', color);
      burst(hit.stroke === 'mute' ? COLORS.mute : COLORS[hit.stroke], hit.stroke === 'mute' ? 0.25 : 1);
    });

    const offChord = engine.onChord(({ onsetTime, result }) => {
      if (done) return;
      const note = pending.get(onsetTime);
      pending.delete(onsetTime);
      const heardName = result.clarity < 0.55 ? '✕' : result.best.name;
      if (!note) { setHeard({ name: heardName, ok: false }); return; }
      if (note.stroke === 'mute') {
        // a chuck should be a dead "chk": no clear chord, or the sound dies right away
        const ratio = engine.history.decayRatio(onsetTime, onsetTime + 0.15);
        const ok = result.clarity < 0.55 || (ratio !== null && ratio < MUTED_RATIO);
        setHeard({ name: ok ? '✕' : heardName, ok });
        if (ok) confirmChord(note, stats);
        else { rejectChord(note, stats); pop('Mute it', COLORS.wrong, 'a chuck is dead strings, no chord'); }
        return;
      }
      const ok = matchesChord(result, note.chord);
      setHeard({ name: ok ? note.chord : heardName, ok });
      if (ok) confirmChord(note, stats);
      else { rejectChord(note, stats); pop('Wrong chord', COLORS.wrong, `heard ${heardName}, needed ${note.chord}`); }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) engine.tap(); }
      if (e.code === 'Escape') { done = true; quitRef.current(); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') engine.release(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    // --- layout: a guitar neck in perspective ---------------------------
    // u = position across the board (-0.5..0.5), d = seconds ahead of the strum line
    let W = 0, H = 0, cx = 0, baseY = 0, vanishY = 0, baseW = 0;
    const K = (1 / 0.32 - 1) / LOOKAHEAD; // far end of the board is 32% of near width
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      baseY = H * 0.84;
      vanishY = H * 0.84 - Math.min(H * 0.84, 1.55 * Math.min(W * 0.62, 520));
      baseW = Math.min(W * 0.62, 520);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const sc = (d: number) => 1 / (1 + Math.max(-0.2, d) * K);
    const py = (d: number) => vanishY + (baseY - vanishY) * sc(d);
    const px = (u: number, d: number) => cx + u * baseW * sc(d);

    // string vibration: amplitude per strum, decays unless a long note is ringing
    let strumAmp = 0, strumPhase = 0, glow = 0, glowColor = COLORS.down;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
    function burst(color: string, strength: number) {
      strumAmp = Math.max(strumAmp, strength * motion);
      glow = 1;
      glowColor = color;
    }

    // --- per-frame rules for holds and chops ---------------------------
    function updateNotes(now: number) {
      const ctxNow = ctx.currentTime;
      for (const n of notes) {
        if (n.time > now) break;
        if ((n.result !== 'perfect' && n.result !== 'good') || n.awaitingChord) continue;

        if (n.len && !n.hold) { n.hold = 'holding'; stats.holds++; }
        if (n.hold === 'holding') {
          if (now >= n.endTime!) finishHold(n);
          else if (n.source === 'key' ? !engine.keyHeld : engine.history.suddenDrop(n.onsetCtx!)) {
            breakHold(n, n.source === 'key' ? 'released too early' : 'chord was cut off');
          } else holdTick(n, now, spb, stats);
        }

        if (n.chop && !n.chopState && ctxNow > n.onsetCtx! + chopAt + 0.03) {
          let ok: boolean | null;
          if (n.source === 'key') ok = engine.keyReleasedAt > n.onsetCtx! && engine.keyReleasedAt - n.onsetCtx! <= chopAt + 0.02;
          else {
            const r = engine.history.decayRatio(n.onsetCtx!, n.onsetCtx! + chopAt);
            ok = r === null ? null : r < MUTED_RATIO;
          }
          if (ok === null) continue; // level readings not in yet
          n.chopState = ok ? 'ok' : 'rang';
          if (ok) { stats.chopsOk++; stats.score += 50 * multiplier(stats.combo); pop('Chop', COLORS.perfect); }
          else pop('Cut it shorter', COLORS.good, 'mute right after the strum');
        }
      }
    }

    // --- render loop ----------------------------------------------------
    let raf = 0;
    let lastHud = '';
    const frame = () => {
      const now = songNow();
      // safety net: if a chord check never came back, give the player the benefit of the doubt
      for (const [onsetTime, n] of pending) {
        if (ctx.currentTime - onsetTime > 0.6) { confirmChord(n, stats); pending.delete(onsetTime); }
      }
      const missed = sweepMisses(notes, now, stats);
      if (missed.length) pop('Miss', COLORS.miss);
      updateNotes(now);

      draw(now);

      const bar = Math.floor(now / spb / BEATS_PER_BAR);
      const nextHud = { score: stats.score, combo: stats.combo, bar, progress: Math.max(0, Math.min(1, now / (totalBeats * spb))) };
      const key = `${nextHud.score}|${nextHud.combo}|${bar}|${Math.round(nextHud.progress * 200)}`;
      if (key !== lastHud) { lastHud = key; setHud(nextHud); }

      if (now > end && !done) { done = true; finishRef.current(stats); return; }
      if (!done) raf = requestAnimationFrame(frame);
    };

    const STRINGS = [-0.4, -0.24, -0.08, 0.08, 0.24, 0.4]; // high e … low E (low E nearest the thumb, drawn right)
    const STRING_W = [1, 1.2, 1.5, 2.1, 2.6, 3.1];

    function trap(u0: number, u1: number, d0: number, d1: number) {
      g.beginPath();
      g.moveTo(px(u0, d0), py(d0)); g.lineTo(px(u1, d0), py(d0));
      g.lineTo(px(u1, d1), py(d1)); g.lineTo(px(u0, d1), py(d1));
      g.closePath();
    }

    function drawBoard(now: number) {
      // rosewood board
      const top = py(LOOKAHEAD), bottom = py(-0.2);
      const wood = g.createLinearGradient(0, top, 0, bottom);
      wood.addColorStop(0, 'rgba(58,36,26,0)');
      wood.addColorStop(0.25, '#3a241a');
      wood.addColorStop(1, '#4a2e21');
      g.fillStyle = wood;
      trap(-0.5, 0.5, -0.2, LOOKAHEAD);
      g.fill();
      // grain
      g.save();
      trap(-0.5, 0.5, -0.2, LOOKAHEAD); g.clip();
      g.strokeStyle = 'rgba(20,10,6,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const u = -0.5 + (i + 0.5) / 22 + Math.sin(i * 12.9) * 0.01;
        g.beginPath(); g.moveTo(px(u, -0.2), py(-0.2)); g.lineTo(px(u, LOOKAHEAD), py(LOOKAHEAD)); g.stroke();
      }
      g.restore();
      // binding
      g.strokeStyle = 'rgba(236,228,212,0.55)';
      g.lineWidth = 2;
      for (const u of [-0.5, 0.5]) { g.beginPath(); g.moveTo(px(u, -0.2), py(-0.2)); g.lineTo(px(u, LOOKAHEAD), py(LOOKAHEAD)); g.stroke(); }

      // frets = beats, inlays = bars
      const firstBeat = Math.floor((now - 0.2) / spb);
      const lastBeat = Math.ceil((now + LOOKAHEAD) / spb);
      for (let b = Math.max(-BEATS_PER_BAR, firstBeat); b <= Math.min(totalBeats, lastBeat); b++) {
        const d = b * spb - now;
        if (d < -0.2 || d > LOOKAHEAD) continue;
        const isBar = b % BEATS_PER_BAR === 0;
        const y = py(d), s = sc(d);
        const fade = Math.min(1, (LOOKAHEAD - d) / 0.6);
        g.globalAlpha = fade;
        g.fillStyle = isBar ? '#d9dde0' : 'rgba(185,190,196,0.55)';
        g.fillRect(px(-0.5, d), y - (isBar ? 2.5 : 1.5) * s, baseW * s, (isBar ? 5 : 3) * s);
        // pearl inlay halfway into each bar
        if (b % BEATS_PER_BAR === 2 && b > 0) {
          const bar = Math.floor(b / BEATS_PER_BAR);
          g.fillStyle = 'rgba(239,233,223,0.8)';
          const r = 7 * s;
          const dots = (bar + 1) % 4 === 0 ? [-0.14, 0.14] : [0];
          for (const u of dots) { g.beginPath(); g.ellipse(px(u, d), y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
        }
        if (isBar && b >= 0 && b < totalBeats) {
          g.fillStyle = 'rgba(236,228,212,0.45)';
          g.font = `600 ${Math.round(13 * s + 4)}px "Big Shoulders Display", sans-serif`;
          g.textAlign = 'left';
          g.fillText(String(b / BEATS_PER_BAR + 1), px(0.5, d) + 10 * s, y + 5 * s);
        }
        g.globalAlpha = 1;
      }
    }

    function drawStrings(now: number, ringing: boolean) {
      strumPhase += 0.9;
      if (!ringing) strumAmp *= 0.93;
      else strumAmp = Math.max(strumAmp, 0.45 * motion);
      const nearD = -0.2, farD = LOOKAHEAD;
      STRINGS.forEach((u, i) => {
        g.strokeStyle = i < 2 ? '#e3e6e8' : '#d4a964';
        g.globalAlpha = 0.85;
        g.lineWidth = STRING_W[i];
        g.beginPath();
        const N = 40;
        for (let k = 0; k <= N; k++) {
          const d = nearD + (farD - nearD) * (k / N);
          // standing wave, strongest near the strum line
          const env = Math.sin(Math.PI * Math.min(1, (k + 2) / (N * 0.55)));
          const off = strumAmp * 4.5 * env * Math.sin(strumPhase * (1 + i * 0.13) + k * 0.35) * sc(d);
          const x = px(u, d) + off, y = py(d);
          if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      });
      g.globalAlpha = 1;
      void now;
    }

    function drawTail(n: Note, now: number) {
      if (n.hold === 'done') return;
      const holding = n.hold === 'holding' || !!(n.awaitingChord && n.len);
      const dead = n.hold === 'broken' || n.result === 'miss' || n.result === 'wrong';
      const d0 = holding ? 0 : n.time - now;
      const d1 = Math.min(LOOKAHEAD, n.endTime! - now);
      if (d1 <= Math.max(-0.2, d0)) return;
      g.save();
      const grad = g.createLinearGradient(0, py(d0), 0, py(d1));
      const c = dead ? '120,110,100' : '255,174,66';
      grad.addColorStop(0, `rgba(${c},${holding ? 0.55 : 0.32})`);
      grad.addColorStop(1, `rgba(${c},${holding ? 0.25 : 0.12})`);
      g.fillStyle = grad;
      trap(-0.44, 0.44, Math.max(-0.2, d0), d1);
      g.fill();
      // end of the note: a bone-coloured line
      if (n.endTime! - now < LOOKAHEAD) {
        g.fillStyle = dead ? 'rgba(120,110,100,0.6)' : 'rgba(255,174,66,0.9)';
        g.fillRect(px(-0.44, d1), py(d1) - 1.5, baseW * 0.88 * sc(d1), 3);
      }
      g.restore();
    }

    function drawNote(n: Note, now: number) {
      const d = n.time - now;
      const s = sc(d), y = py(d);
      const missed = n.result === 'miss';
      const half = n.chop ? 0.26 : 0.46;
      const h = Math.max(4, 20 * s);
      const x0 = px(-half, d), w = (px(half, d) - x0);
      const color = missed ? '#5a4c44' : COLORS[n.stroke];
      g.save();
      g.globalAlpha = Math.min(1, (LOOKAHEAD - d) / 0.5) * (missed ? 0.6 : 1);
      // body
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(x0, y - h / 2, w, h, h / 2);
      g.fill();
      // top highlight
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.roundRect(x0 + h * 0.4, y - h / 2 + h * 0.14, w - h * 0.8, h * 0.22, h * 0.11); g.fill();
      // engraving: direction / mute / chop
      g.fillStyle = 'rgba(31,20,16,0.85)';
      g.strokeStyle = 'rgba(31,20,16,0.85)';
      const a = h * 0.32;
      if (n.stroke === 'mute') {
        g.lineWidth = Math.max(1.5, 2.5 * s);
        for (const u of [-0.3, -0.1, 0.1, 0.3]) {
          const xx = px(u, d);
          g.beginPath(); g.moveTo(xx - a, y - a); g.lineTo(xx + a, y + a); g.moveTo(xx + a, y - a); g.lineTo(xx - a, y + a); g.stroke();
        }
      } else {
        const xx = cx;
        g.beginPath();
        if (n.stroke === 'down') { g.moveTo(xx - a * 1.4, y - a); g.lineTo(xx + a * 1.4, y - a); g.lineTo(xx, y + a); }
        else { g.moveTo(xx - a * 1.4, y + a); g.lineTo(xx + a * 1.4, y + a); g.lineTo(xx, y - a); }
        g.fill();
      }
      if (n.chop && !missed) {
        g.beginPath(); g.arc(px(half, d) + h * 0.55, y, h * 0.2, 0, Math.PI * 2);
        g.fillStyle = color; g.fill();
      }
      g.restore();
      // chord name beside the note where the chord changes
      if (n.chordChange && !missed) {
        g.fillStyle = 'rgba(236,228,212,0.95)';
        g.font = `800 ${Math.round(30 * s + 8)}px "Big Shoulders Display", sans-serif`;
        g.textAlign = 'right';
        g.fillText(n.chord, px(-0.5, d) - 14 * s, y + 10 * s);
      }
    }

    function drawBridge() {
      // the strum line: a bone saddle across the strings
      glow *= 0.9;
      const y = py(0), w = baseW * 1.04;
      if (glow > 0.02) {
        const r = g.createRadialGradient(cx, y, 0, cx, y, w * 0.6);
        r.addColorStop(0, glowColor + Math.round(glow * 90).toString(16).padStart(2, '0'));
        r.addColorStop(1, glowColor + '00');
        g.fillStyle = r;
        g.fillRect(cx - w * 0.6, y - w * 0.3, w * 1.2, w * 0.6);
      }
      g.fillStyle = '#ece4d4';
      g.beginPath(); g.roundRect(cx - w / 2, y - 4, w, 8, 4); g.fill();
      g.fillStyle = 'rgba(31,20,16,0.25)';
      g.fillRect(cx - w / 2 + 4, y + 1, w - 8, 2);
    }

    function draw(now: number) {
      g.clearRect(0, 0, W, H);
      drawBoard(now);

      let ringing = false;
      for (const n of notes) {
        if (n.time - now > LOOKAHEAD) break;
        if (n.len) { drawTail(n, now); if (n.hold === 'holding') ringing = true; }
      }
      drawStrings(now, ringing);
      // fade the far end of the neck into the dark
      g.save();
      g.globalCompositeOperation = 'destination-out';
      const fadeTop = py(LOOKAHEAD) - 2, fadeBottom = py(LOOKAHEAD * 0.62);
      const fade = g.createLinearGradient(0, fadeTop, 0, fadeBottom);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fade;
      g.fillRect(0, fadeTop, W, fadeBottom - fadeTop);
      g.restore();
      drawBridge();

      // draw far notes first so near ones overlap them
      const visible: Note[] = [];
      for (const n of notes) {
        const d = n.time - now;
        if (d > LOOKAHEAD) break;
        if (d < -0.25 || n.result === 'perfect' || n.result === 'good' || n.result === 'wrong') continue;
        visible.push(n);
      }
      for (let i = visible.length - 1; i >= 0; i--) drawNote(visible[i], now);

      // count-in
      if (now < 0) {
        const left = Math.ceil(-now / spb);
        const f = 1 - ((-now / spb) % 1);
        g.fillStyle = `rgba(236,228,212,${0.9 - f * 0.6})`;
        g.font = `800 ${Math.round(120 + f * 30)}px "Big Shoulders Display", sans-serif`;
        g.textAlign = 'center';
        g.fillText(String(left), cx, py(LOOKAHEAD * 0.45));
      }

      // judgement words, newest at the bottom
      const t = performance.now();
      while (popups.length > 3) popups.shift();
      popups.forEach((p, i) => {
        const age = (t - p.born) / 700;
        if (age >= 1) return;
        const lift = (popups.length - 1 - i) * 40 + age * 18;
        const y = py(0) - 48 - lift;
        g.globalAlpha = Math.min(1, (1 - age) * 1.6);
        g.fillStyle = p.color;
        g.font = '800 34px "Big Shoulders Display", sans-serif';
        g.textAlign = 'center';
        g.fillText(p.text, cx, y);
        if (p.sub) {
          g.font = '600 14px "Instrument Sans", sans-serif';
          g.fillStyle = 'rgba(236,228,212,0.85)';
          g.fillText(p.sub, cx, y + 20);
        }
      });
      g.globalAlpha = 1;
    }

    raf = requestAnimationFrame(frame);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      off();
      offChord();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      engine.stopSession();
    };
  }, [engine, notes, prog, settings]);

  const current = chordForBar(prog, Math.max(0, hud.bar));
  const next = chordForBar(prog, Math.max(0, hud.bar) + 1);
  const mult = multiplier(hud.combo);

  return (
    <div className="game">
      <canvas ref={canvasRef} className="highway" />
      <div className="hud-score">
        <div className="score-num">{hud.score.toLocaleString()}</div>
        <div className="combo">
          {hud.combo > 1 ? <>{hud.combo} in a row</> : <span className="dim">Build a streak</span>}
          {mult > 1 && <span className="mult">×{mult}</span>}
        </div>
      </div>
      <div className="hud-chord">
        <div className="chord-now">{current}</div>
        <ChordDiagram chord={current} size={92} />
        <div className="chord-next">then {next}</div>
        {settings.checkChords && heard && (
          <div className={`chord-heard ${heard.ok ? 'ok' : 'bad'}`}>You played {heard.name}</div>
        )}
      </div>
      <div className="hud-bottom">
        <div className="progress"><div style={{ width: `${hud.progress * 100}%` }} /></div>
        <button className="btn quiet small" onClick={onQuit}>Stop</button>
      </div>
    </div>
  );
}
