# 🎸 Play Along

A rhythm game for a **real guitar**. Notes scroll down the highway like in the old
button-mashing rhythm games, but instead of pressing buttons you strum your guitar on
the beat. The mic hears each strum and scores it **PERFECT / GOOD / MISS**.

## Run it

```bash
npm install
npm run dev
```

Open the page, click **Enable microphone**, and strum. The STRUM lamp should light once per strum,
and the box next to it shows the chord it heard.

> Mic access needs `localhost` or HTTPS. To play from a phone on your Wi-Fi, run
> `npm run dev -- --host` and use an HTTPS tunnel, or deploy the `dist/` build to any static host.

## How to play

1. **Sensitivity**: adjust until every strum lights the lamp exactly once.
2. **Calibrate** (recommended): strum along to 12 clicks. This measures your
   mic/speaker delay so "on the beat" really means on the beat.
3. Pick **chords**, a **strum pattern**, **tempo** and **length**, then hit **START**.
4. Orange ▼ gems are downstrokes and cyan ▲ gems are upstrokes. The chord name appears at
   each chord change, and the current chord shape is shown top-right.
5. At the end you get a grade plus a hint on whether you rush or drag the beat.

No guitar nearby? Press **Space** to strum. **Esc** quits.

Headphones help: they stop the metronome click from leaking into the mic.

## How it works

| Piece | File |
|---|---|
| Strum detector: AudioWorklet that watches the mic and fires when energy jumps above its recent peak (raw + transient bands, so soft strums over ringing chords still count) | `src/audio/onsetWorklet.ts` |
| Audio engine: mic, metronome click and bass line, all on the AudioContext clock | `src/audio/engine.ts` |
| Song charts: strum patterns, chord progressions, chord shapes | `src/game/chart.ts` |
| Chord check: about 160 ms after each strum, the spectrum is folded into 12 note names (a chromagram) and matched against major/minor/7th templates. The spectrum captured right *at* the strum (the previous chord still ringing) is subtracted first, so leftover notes don't confuse it | `src/audio/chords.ts` |
| Timing windows and scoring (±60 ms perfect, ±130 ms good, combo multiplier up to ×4) | `src/game/judge.ts` |
| Canvas highway, HUD, setup, calibration, results | `src/components/` |

Adding a progression or strum pattern is one line in `src/game/chart.ts`.

### Testing chord detection

`npm run bench:chords` strums every chord shape on a simulated guitar (overtones, slight
detuning, previous chord ringing, noise) and reports how many were recognised and how
many wrong chords slipped through. Env flags: `SAME=1` (re-strum the same chord),
`AMP=0.05` (soft strums), `DELAY=0.12` (look sooner after the strum), `BEFORE=0` (no subtraction).

Uncheck **Check chords** in the menu to practise rhythm only.

## Ideas for next steps

- Load a song's chord chart / tempo from a file
- Practice mode that speeds up after each clean run
