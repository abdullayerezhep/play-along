# Play Along

A rhythm game for a real guitar. Notes travel down a guitar neck, like in the old
button rhythm games, but you play them by strumming. The microphone checks **when**
you strummed and **which chord** you played.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints and turn on the microphone. The sound never leaves your device.

On a phone the mic only works on an `https` address. This repo publishes itself to
GitHub Pages on every push to `main` (one-time setup: Settings → Pages → Source:
"GitHub Actions"), which gives you `https://<your-name>.github.io/play-along/`.

## How to play

1. **Turn on the microphone** and strum once. The light should blink once and show your chord.
2. **Tune** with the built-in tuner. Chords are checked by pitch, so an out-of-tune guitar gets marked wrong.
3. Say whether you hear the game through **speakers or headphones**. Through speakers the
   bass line stays off, because the mic would hear it as your guitar. The click is fine either way.
4. Before your first song the game **measures the delay** of your mic and speakers
   (strum along to 12 ticks). Without it every strum looks late.
5. Pick a **song**, or type your own chords:
   - `G D Em C` is one chord per bar
   - `| G | D | Em C |` puts two chords in the last bar
   - major, minor and 7th chords work, with sharps and flats (`F#m`, `Bb`, `B7`)
6. Pick a **strum pattern** and a tempo, then start.

### Reading the notes

| Note | What to do |
|---|---|
| amber bar, ▼ | strum (down is suggested) |
| green bar, ▲ | strum (up is suggested) |
| bar with a glowing tail | strum and **let it ring** until the tail ends; muting or strumming again breaks it |
| grey bar with ✕ | **chuck**: strum muted strings for a dead "chk" |
| short bar with a dot | **chop**: strum, then mute right away (bonus points) |

The arrows are advice only: the game can't hear which way you strum.

Beside the strum line you see the chord to hold now and the shape of the **next** chord,
which lights up two beats before the change. Strumming where the song has no note ends
your streak and counts against your grade. **Esc** pauses.

No guitar nearby? **Space** strums: hold it for long notes, tap it for chops.

## How it works

| Part | File |
|---|---|
| **Strum detector.** Listens in three bands and reports a strum when loudness jumps above the held peak of a moment ago. The bright band is what catches a soft upstroke over a chord that is still ringing. A steep low-pass and a notch remove the game's own click, so speakers can't trigger it. | `src/audio/onsetWorklet.ts` |
| **Chord check.** 160 ms after a strum the spectrum is folded into 12 note names and matched against major, minor and 7th templates. On a chord change, the spectrum from the instant of the strum (the old chord still ringing) is subtracted first. When the same chord is strummed again, a match on the whole sound counts too. | `src/audio/chords.ts` |
| **Ringing or muted.** A guitar fades gradually; a mute falls off a cliff. That breaks long notes and confirms chucks and chops. | `src/audio/decay.ts` |
| **Tuner.** Pitch of a single string by autocorrelation. | `src/audio/pitch.ts` |
| **Audio engine.** Mic, click, bass, all on the audio clock. | `src/audio/engine.ts` |
| **Songs.** Patterns, chord loops, your own chords, chord shapes (open or barre) for any chord. | `src/game/chart.ts` |
| **Rules.** Which strum hits which note, extra strums, long notes, chops, scoring. No audio or drawing in here. | `src/game/session.ts`, `src/game/judge.ts` |
| **Drawing.** The neck, strings and notes. | `src/game/highway.ts` |
| **Screens.** Menu, game, delay measurement, tuner, results. | `src/components/` |

## Tests

```bash
npm test          # 38 tests, about 30 seconds
npm run lint
npm run typecheck
```

There is no real guitar in the tests. `test/sim.ts` is a simulated one: strings with
decaying, slightly out-of-tune harmonics, raked 3 ms apart, where a re-struck string
stops its old note. The real detector and chord code run on that signal, including the
metronome click as the game produces it. The numbers the tests guard:

- soft strums over a ringing chord: at least 13 of 14 caught, none extra
- down-up eighths with soft upstrokes at 80 bpm: at least 14 of 16 at the default sensitivity
- the click through speakers, even at full volume: 0 false strums
- chord changes recognised: at least 40 of 42, at most 8 false accepts in 534 chances

A simulation is not your guitar, mic and room. If something is off in real play, the
readouts ("You played …", the strum light) show what the game heard.

## Known limits

- Up and down strums can't be told apart by ear, so direction isn't judged.
- Fast, soft upstrokes (eighths above about 120 bpm) need a higher sensitivity.
- Only major, minor and 7th chords are recognised. `Am` and `C`, or `G` and `Em`, share two notes and are the easiest to confuse.
- Distorted electric guitar and Bluetooth microphones are untested.
