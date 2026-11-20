import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesChord } from '../audio/chords';
import type { AudioEngine } from '../audio/engine';
import { BEATS_PER_BAR, PROGRESSIONS, buildChart, chordForBar, rootFreq, type Note } from '../game/chart';
import { confirmChord, emptyStats, judgeStrum, multiplier, rejectChord, sweepMisses, type Stats } from '../game/judge';
import type { AppSettings } from '../settings';
import { ChordDiagram } from './ChordDiagram';

type Props = { engine: AudioEngine; settings: AppSettings; onFinish: (s: Stats) => void; onQuit: () => void };

type Popup = { text: string; sub?: string; color: string; born: number };
type Spark = { x: number; y: number; vx: number; vy: number; born: number; color: string };

const LOOKAHEAD = 2.2; // seconds of notes visible above the hit line
const COLORS = { down: '#ff9f43', up: '#3de0ff', perfect: '#7CFF6B', good: '#ffe066', miss: '#ff4d6d', wrong: '#ff4d6d' };

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
    const stats = emptyStats();
    const popups: Popup[] = [];
    const sparks: Spark[] = [];
    let pulse = 0; // hit-line glow from any strum
    let done = false;

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

    // --- input ----------------------------------------------------------
    // strums waiting for the chord check, keyed by onset time
    const pending = new Map<number, Note>();
    const off = engine.onOnset((o) => {
      if (done) return;
      const t = o.time - start - (o.source === 'mic' ? latency : 0);
      pulse = 1;
      const check = settings.checkChords && o.source === 'mic';
      const hit = judgeStrum(notes, t, stats, check);
      if (hit && check) pending.set(o.time, hit);
      if (hit) {
        const color = COLORS[hit.result as 'perfect' | 'good'];
        popups.push({ text: hit.result === 'perfect' ? 'PERFECT' : 'GOOD', color, born: performance.now() });
        burst(color, hit.result === 'perfect' ? 22 : 12);
      }
    });
    const offChord = engine.onChord(({ onsetTime, result }) => {
      if (done) return;
      const note = pending.get(onsetTime);
      pending.delete(onsetTime);
      const heardName = result.clarity < 0.55 ? '?' : result.best.name;
      if (!note) { setHeard({ name: heardName, ok: false }); return; }
      const ok = matchesChord(result, note.chord);
      setHeard({ name: ok ? note.chord : heardName, ok });
      if (ok) confirmChord(note, stats);
      else {
        rejectChord(note, stats);
        popups.push({ text: 'WRONG CHORD', sub: `heard ${heardName}, needed ${note.chord}`, color: COLORS.wrong, born: performance.now() });
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) engine.tap(); }
      if (e.code === 'Escape') { done = true; quitRef.current(); }
    };
    window.addEventListener('keydown', onKey);

    // --- layout ---------------------------------------------------------
    let W = 0, H = 0, laneW = 0, laneX = 0, hitY = 0, pps = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      laneW = Math.min(300, W * 0.55);
      laneX = (W - laneW) / 2;
      hitY = H * 0.8;
      pps = (hitY - 30) / LOOKAHEAD;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function burst(color: string, n: number) {
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const a = Math.PI + Math.random() * Math.PI;
        const v = 2 + Math.random() * 5;
        sparks.push({ x: W / 2 + (Math.random() - 0.5) * laneW * 0.6, y: hitY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now, color });
      }
    }

    // --- render loop ----------------------------------------------------
    let raf = 0;
    let lastHud = '';
    const frame = () => {
      const now = engine.now - start;
      // safety net: if a chord check never came back, give the player the benefit of the doubt
      for (const [onsetTime, n] of pending) {
        if (ctx.currentTime - onsetTime > 0.6) { confirmChord(n, stats); pending.delete(onsetTime); }
      }
      const missed = sweepMisses(notes, now, stats);
      if (missed.length) popups.push({ text: 'MISS', color: COLORS.miss, born: performance.now() });

      draw(now);

      const bar = Math.floor(now / spb / BEATS_PER_BAR);
      const nextHud = { score: stats.score, combo: stats.combo, bar, progress: Math.max(0, Math.min(1, now / (totalBeats * spb))) };
      const key = `${nextHud.score}|${nextHud.combo}|${bar}|${Math.round(nextHud.progress * 200)}`;
      if (key !== lastHud) { lastHud = key; setHud(nextHud); }

      if (now > end && !done) { done = true; finishRef.current(stats); return; }
      if (!done) raf = requestAnimationFrame(frame);
    };

    const yFor = (t: number, now: number) => hitY - (t - now) * pps;

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    function draw(now: number) {
      g.clearRect(0, 0, W, H);

      // lane
      const lane = g.createLinearGradient(0, 0, 0, H);
      lane.addColorStop(0, 'rgba(60,40,120,0)');
      lane.addColorStop(0.7, 'rgba(60,40,120,0.35)');
      lane.addColorStop(1, 'rgba(60,40,120,0.15)');
      g.fillStyle = lane;
      g.fillRect(laneX, 0, laneW, H);
      g.strokeStyle = 'rgba(160,140,255,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(laneX, 0); g.lineTo(laneX, H);
      g.moveTo(laneX + laneW, 0); g.lineTo(laneX + laneW, H);
      g.stroke();

      // beat & bar lines
      const firstBeat = Math.floor(now / spb) - 2;
      const lastBeat = Math.ceil((now + LOOKAHEAD) / spb);
      for (let b = Math.max(-BEATS_PER_BAR, firstBeat); b <= Math.min(totalBeats, lastBeat); b++) {
        const y = yFor(b * spb, now);
        const isBar = b % BEATS_PER_BAR === 0;
        g.strokeStyle = isBar ? 'rgba(200,190,255,0.55)' : 'rgba(200,190,255,0.15)';
        g.lineWidth = isBar ? 2 : 1;
        g.beginPath(); g.moveTo(laneX, y); g.lineTo(laneX + laneW, y); g.stroke();
        if (isBar && b >= 0 && b < totalBeats) {
          g.fillStyle = 'rgba(200,190,255,0.5)';
          g.font = '10px "Press Start 2P", monospace';
          g.textAlign = 'left';
          g.fillText(String(b / BEATS_PER_BAR + 1), laneX + laneW + 8, y + 4);
        }
      }

      // hit line
      pulse *= 0.9;
      g.save();
      g.shadowColor = '#b18cff';
      g.shadowBlur = 12 + pulse * 30;
      g.fillStyle = `rgba(210,190,255,${0.6 + pulse * 0.4})`;
      g.fillRect(laneX - 10, hitY - 3, laneW + 20, 6);
      g.restore();

      // notes
      const gemW = laneW * 0.78, gemH = 24;
      for (const n of notes) {
        const y = yFor(n.time, now);
        if (y < -40) break;
        if (y > H + 40 || n.result === 'perfect' || n.result === 'good' || n.result === 'wrong') continue;
        const x = (W - gemW) / 2;
        const missed = n.result === 'miss';
        const color = COLORS[n.stroke];
        g.save();
        g.globalAlpha = missed ? 0.25 : 1;
        if (!missed) { g.shadowColor = color; g.shadowBlur = 14; }
        g.fillStyle = missed ? '#666' : color;
        roundRect(x, y - gemH / 2, gemW, gemH, 8);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(x + 4, y - gemH / 2 + 3, gemW - 8, 6, 3);
        g.fill();
        // stroke arrow
        g.fillStyle = '#1a1033';
        g.beginPath();
        const ax = W / 2, s = 7;
        if (n.stroke === 'down') { g.moveTo(ax - s, y - 4); g.lineTo(ax + s, y - 4); g.lineTo(ax, y + 6); }
        else { g.moveTo(ax - s, y + 4); g.lineTo(ax + s, y + 4); g.lineTo(ax, y - 6); }
        g.fill();
        g.restore();
        if (n.chordChange && !missed) {
          g.fillStyle = '#fff';
          g.font = '14px "Press Start 2P", monospace';
          g.textAlign = 'right';
          g.fillText(n.chord, laneX - 14, y + 6);
        }
      }

      // count-in
      if (now < 0) {
        const left = Math.ceil(-now / spb);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.font = '48px "Press Start 2P", monospace';
        g.textAlign = 'center';
        g.fillText(String(left), W / 2, H * 0.42);
      }

      // sparks
      const t = performance.now();
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        const age = (t - p.born) / 500;
        if (age >= 1) { sparks.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += 0.25;
        g.globalAlpha = 1 - age;
        g.fillStyle = p.color;
        g.fillRect(p.x, p.y, 4, 4);
      }
      g.globalAlpha = 1;

      // judgement popups
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        const age = (t - p.born) / 600;
        if (age >= 1 || i < popups.length - 2) { popups.splice(i, 1); continue; }
        g.globalAlpha = 1 - age;
        g.fillStyle = p.color;
        g.font = '18px "Press Start 2P", monospace';
        g.textAlign = 'center';
        g.fillText(p.text, W / 2, hitY - 50 - age * 30);
        if (p.sub) {
          g.font = '10px "Press Start 2P", monospace';
          g.fillText(p.sub, W / 2, hitY - 28 - age * 30);
        }
      }
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
      engine.stopSession();
    };
  }, [engine, notes, prog, settings]);

  const current = chordForBar(prog, Math.max(0, hud.bar));
  const next = chordForBar(prog, Math.max(0, hud.bar) + 1);
  const mult = multiplier(hud.combo);

  return (
    <div className="game">
      <canvas ref={canvasRef} className="highway" />
      <div className="hud-left">
        <div className="hud-label">SCORE</div>
        <div className="hud-score">{hud.score.toLocaleString()}</div>
        <div className="hud-label">COMBO</div>
        <div className="hud-combo">{hud.combo}</div>
        <div className={`hud-mult m${mult}`}>×{mult}</div>
      </div>
      <div className="hud-right">
        <div className="hud-label">NOW</div>
        <div className="hud-chord">{current}</div>
        <ChordDiagram chord={current} size={86} />
        <div className="hud-label">NEXT · {next}</div>
        {settings.checkChords && heard && (
          <div className={`hud-heard ${heard.ok ? 'ok' : 'bad'}`}>heard {heard.name}</div>
        )}
      </div>
      <div className="hud-bottom">
        <div className="progress"><div style={{ width: `${hud.progress * 100}%` }} /></div>
        <button className="btn ghost small" onClick={onQuit}>Quit (Esc)</button>
      </div>
    </div>
  );
}
