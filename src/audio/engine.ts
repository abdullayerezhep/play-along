import { chromaFromSpectrum, classify, type ChordResult } from './chords';
import { onsetWorkletUrl } from './onsetWorklet';

export type Onset = { time: number; level: number; source: 'mic' | 'key' };
type OnsetListener = (o: Onset) => void;
export type ChordHeard = { onsetTime: number; result: ChordResult };
type ChordListener = (c: ChordHeard) => void;

/** How long after a strum to look at the spectrum: long enough that the window is mostly the new chord. */
const CHORD_DELAY = 0.16;

/**
 * Owns the AudioContext, the microphone, the strum detector and the
 * metronome / bass sounds. All times are AudioContext seconds.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  level = 0;
  micReady = false;
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
      if (d.type === 'level') this.level = d.value;
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
    this.emit({ time: this.ctx.currentTime, level: 1, source: 'key' });
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
      this.chordListeners.forEach((fn) => fn({ onsetTime, result }));
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

  click(time: number, accent: boolean, volume = 0.35) {
    const out = this.session ?? this.ctx.destination;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(volume * (accent ? 1 : 0.6), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(g).connect(out);
    osc.start(time);
    osc.stop(time + 0.06);
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

  /** Visual clock: what the player is hearing right now. */
  get now(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || 0);
  }
}
