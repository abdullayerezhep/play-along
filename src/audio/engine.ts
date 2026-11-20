import { chromaFromSpectrum, classify, type ChordResult } from './chords';
import { LevelHistory } from './decay';
import { CLICK_HZ, onsetWorkletUrl } from './onsetWorklet';

export type Onset = { time: number; level: number; source: 'mic' | 'key' };
type OnsetListener = (o: Onset) => void;
/** `result` is what the strum added to the sound; `plain` is everything sounding after it. */
export type ChordHeard = { onsetTime: number; result: ChordResult; plain: ChordResult };
type ChordListener = (c: ChordHeard) => void;

/** How long after a strum to look at the spectrum: long enough that the window is mostly the new chord. */
const CHORD_DELAY = 0.16;

/**
 * The metronome click: a soft-edged tone at one exact, high pitch. The smooth edges
 * keep all of its energy at that pitch, where the strum detector has a notch, so the
 * mic can hear the click without the game mistaking it for the guitar.
 */
export const CLICK = { freq: CLICK_HZ, sigma: 0.004, length: 0.024 };
const CLICK_CURVE = Float32Array.from({ length: 64 }, (_, i) => {
  const t = (i / 63) * CLICK.length - CLICK.length / 2;
  return Math.exp(-(t * t) / (2 * CLICK.sigma * CLICK.sigma));
});

/**
 * Owns the AudioContext, the microphone, the strum detector and the
 * metronome / bass sounds. All times are AudioContext seconds.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  level = 0;
  micReady = false;
  /** Recent mic loudness, for telling ringing chords from muted ones. */
  readonly history = new LevelHistory();
  /** Space bar strum is held down (keyboard stand-in for "let it ring"). */
  keyHeld = false;
  keyReleasedAt = -Infinity;
  private node?: AudioWorkletNode;
  private stream?: MediaStream;
  private listeners = new Set<OnsetListener>();
  private chordListeners = new Set<ChordListener>();
  private analyser?: AnalyserNode;
  private session?: GainNode;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
  }

  async startMic(): Promise<void> {
    if (this.micReady) return;
    await this.ctx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await this.ctx.audioWorklet.addModule(onsetWorkletUrl());
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'onset-detector');
    const mute = this.ctx.createGain();
    mute.gain.value = 0; // keep the worklet pulled without hearing the mic
    src.connect(this.node).connect(mute).connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser).connect(mute);
    this.node.port.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'level') { this.level = d.value; this.history.push(d.time, d.value); }
      else if (d.type === 'onset') {
        this.emit({ time: d.time, level: d.level, source: 'mic' });
        this.listenForChord(d.time);
      }
    };
    this.micReady = true;
  }

  setSensitivity(v: number) {
    this.node?.port.postMessage({ type: 'sensitivity', value: v });
  }

  /** Keyboard / tap fallback so the game can be tried without a guitar. */
  tap() {
    this.keyHeld = true;
    this.emit({ time: this.ctx.currentTime, level: 1, source: 'key' });
  }

  release() {
    this.keyHeld = false;
    this.keyReleasedAt = this.ctx.currentTime;
  }

  /**
   * Snapshot the spectrum now (mostly the previous chord still ringing), and again
   * a moment later; the difference is what this strum added.
   */
  private listenForChord(onsetTime: number) {
    const an = this.analyser;
    if (!an || !this.chordListeners.size) return;
    const before = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(before);
    const wait = Math.max(0, CHORD_DELAY - (this.ctx.currentTime - onsetTime));
    setTimeout(() => {
      const after = new Float32Array(an.frequencyBinCount);
      an.getFloatFrequencyData(after);
      const result = classify(chromaFromSpectrum(after, this.ctx.sampleRate, before));
      const plain = classify(chromaFromSpectrum(after, this.ctx.sampleRate));
      this.chordListeners.forEach((fn) => fn({ onsetTime, result, plain }));
    }, wait * 1000);
  }

  onChord(fn: ChordListener): () => void {
    this.chordListeners.add(fn);
    return () => this.chordListeners.delete(fn);
  }

  onOnset(fn: OnsetListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(o: Onset) {
    this.listeners.forEach((fn) => fn(o));
  }

  /** Starts a fresh output bus; everything scheduled after this can be cancelled with stopSession(). */
  beginSession() {
    this.stopSession();
    this.session = this.ctx.createGain();
    this.session.connect(this.ctx.destination);
  }

  stopSession() {
    if (!this.session) return;
    const g = this.session;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    setTimeout(() => g.disconnect(), 100);
    this.session = undefined;
  }

  /** A tick whose loudest point lands exactly on `time`. Bar starts are louder. */
  click(time: number, accent: boolean, volume = 0.6) {
    const out = this.session ?? this.ctx.destination;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const start = Math.max(this.ctx.currentTime, time - CLICK.length / 2);
    const peak = volume * (accent ? 1 : 0.5);
    osc.type = 'sine';
    osc.frequency.value = CLICK.freq;
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(CLICK_CURVE.map((v) => v * peak), start, CLICK.length);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + CLICK.length + 0.005);
  }

  bass(time: number, freq: number, dur: number, volume = 0.3) {
    const out = this.session ?? this.ctx.destination;
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(volume, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(lp).connect(g).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  /** Copy of the latest mic waveform (for the tuner). Returns false if the mic is off. */
  readWaveform(buf: Float32Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getFloatTimeDomainData(buf);
    return true;
  }

  /** Rough mic+speaker delay from what the browser reports, used until the player measures it. */
  estimatedLatencyMs(): number {
    const out = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.round((out + 0.02) * 1000);
  }

  /** Visual clock: what the player is hearing right now. */
  get now(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || 0);
  }
}
