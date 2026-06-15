# Groovebox

A browser-based generative groovebox built with React 18, Vite, TypeScript, and the Web Audio API.  
Three synchronized lanes — a Plaits synthesizer sequenced by Marbles, three Plaits drum voices driven by a probabilistic rhythm generator, and a live granular sampler that captures the synth output in real time.

---

## Platform Support

| Platform           | Status                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Chrome 110+        | ✅ Supported                                                                                                                |
| Firefox 120+       | ✅ Supported                                                                                                                |
| Electron (desktop) | 🔜 Planned wrapper                                                                                                          |
| Tauri (desktop)    | 🔜 Planned wrapper                                                                                                          |
| **iOS**            | ❌ **Not supported** — Electron does not run on iOS; AudioWorklet + WASM constraints make iOS a non-target for this project |

---

## Features

- **Lane A — Synth**: Marbles-inspired generative pitch sequencer driving a Plaits WASM synthesizer voice; t-section controls timing/rhythm, x-section controls pitch/scale with root note and scale mode
- **Lane B — Drums**: Marbles-inspired probabilistic rhythm generator driving three Plaits drum voices:
  - **Kick** — engine 13; Tune, Snap, Decay
  - **Snare** — engine 14; Snap (noise/body balance), Tone (body+noise frequency), Body (resonance), Decay
  - **Hi-Hat** — engine 15; Open, Tone
- **Lane C — Granular Sampler** (Ableton Granulator II–inspired): samples Lane A synth output live into a 4-second stereo circular buffer via a custom `AudioWorkletProcessor` (loaded as Blob URL); triggered by an independent Marbles T clock
  - **Triggered mode** (`◈ TRIG`): each Marbles clock event spawns a burst of 1–12 simultaneous grains; Density controls count per burst
  - **Continuous mode** (`~ CONT`): self-clocked grain stream at 1–16 grains/sec (exponential curve via Density); suitable for drones and sustained textures
  - **Grain controls**: Position (read head offset from write head), Size (20–400 ms), Density, Pitch (snapped to 13 musical intervals: -2oct, -Oct, -P5, -P4, -M3, -m3, P1, m3, M3, P4, P5, Oct, +2oct), Spray (position scatter), Detune (±2 st per grain), Width (stereo spread), Level
  - **Wander**: slow bounded random walk (±0.5 position range, ~20 s full traverse at max) that drifts the effective read position over time — timbre evolves without touching anything
  - **REC / FRZ toggle**: `● REC` records synth audio into the circular buffer continuously; `■ FRZ` freezes the write head so grains loop over a captured snapshot
  - **Capture-input oscilloscope**: shows the synth signal entering the buffer in real time; dims to 35% opacity when frozen
  - Per-voice Dly/Rvb send knobs, mute LED, ⚄ randomize
- **Effects (Lane C strip)**: Send-based delay (BPM-sync or free, feedback-capped at 0.85, tone-filtered 400 Hz–6 kHz) and convolution reverb with algorithmically generated impulse response; per-voice Dly/Rvb send knobs on every voice card; global Delay and Reverb controls in a compact strip
- **Voice mute toggles**: LED-style enable/bypass button on each voice (Synth, Kick, Snare, Hi-Hat, Granular); mutes audio and effects sends without stopping the pattern
- **Shared master clock**: `AudioContext.currentTime`-based lookahead scheduler (100 ms window, 25 ms interval)
- **Generative sequencing**: Independent t (timing) and x (pitch) generators with `deja_vu` loop control; t and x loop separately — a key musical feature of the original Marbles module
- **Randomize system** — ⚄ buttons at every level:
  - Per-section: t-generator, x-generator (incl. root + scale), rhythm generator, Delay, Reverb, Granular (grain + t)
  - Per-voice: Synth (incl. engine), Kick, Snare, Hi-Hat, Granular
  - Global (transport ⚄): all of the above at once
- **Preset system**: Save/load all parameters as JSON via `localStorage`

---

## WASM Research & Decisions

### Candidates evaluated

Before writing any synthesis code, all available npm packages and GitHub repositories for
WebAssembly ports of Mutable Instruments modules were surveyed.

| Package                          | Plaits engines   | Marbles        | AudioWorklet-ready | Last updated              |
| -------------------------------- | ---------------- | -------------- | ------------------ | ------------------------- |
| **`@vectorsize/woscillators`**   | ✅ All 16 (0–15) | ❌ Plaits only | ✅ Yes             | Nov 2025 (active)         |
| `@vectorsize/weaves-oscillators` | ✅ Partial       | ❌             | ✅                 | Apr 2022 (unmaintained)   |
| `mi-plaits-wasm`                 | —                | —              | —                  | **Does not exist** on npm |
| `mutable-instruments-wasm`       | —                | —              | —                  | **Does not exist** on npm |
| `plaits-wasm`                    | —                | —              | —                  | **Does not exist** on npm |

**No Marbles WASM port exists** on npm or GitHub.

### Decision: `@vectorsize/woscillators@2.0.1`

`@vectorsize/woscillators` is the only actively maintained browser-ready Plaits WASM port.
It exposes all 16 Plaits synthesis engines via an `AudioWorkletNode` whose DSP runs fully
off the main thread.

Engine mapping used in this project:

| Engine index | Name        | Used for              | Key parameter notes                                                                  |
| ------------ | ----------- | --------------------- | ------------------------------------------------------------------------------------ |
| 0            | VA Osc      | Lane A melodic option |                                                                                      |
| 1            | Waveshaping | Lane A melodic option |                                                                                      |
| 2            | FM          | Lane A default        |                                                                                      |
| 4            | Additive    | Lane A melodic option |                                                                                      |
| 6            | Chord       | Lane A melodic option |                                                                                      |
| 13           | Bass drum   | Lane B Kick           | timbre = click transient, decay = body length                                        |
| 14           | Snare drum  | Lane B Snare          | **timbre = snappiness** (noise/body balance), **harmonics = body+noise frequency**, **morph = body resonance** |
| 15           | Hi-hat      | Lane B Hi-Hat         | decay = open amount, timbre = tone/filter                                            |

> **Note on engine 14 parameter mapping**: woscillators defaults all parameters to 0.
> The snare voice is pre-initialized in `AudioEngine.init()` to avoid the first hit firing
> with no noise/body/resonance. The `morph` parameter (body resonance) must be set explicitly
> — at 0 the drum sounds like a dry rimshot with no ring.

### Vite integration workaround

The package ships as a bare IIFE bundle (`var woscillators = function(r){...}({})`) with no
`module.exports` and no `export` statements. Vite's esbuild pre-bundler cannot synthesize
named exports from this format. A custom Vite plugin (`woscillators-esm` in `vite.config.ts`)
intercepts the file in the `load` hook and appends ESM export statements:

```ts
load(id: string) {
  if (id.includes('@vectorsize/woscillators/dist/index.js')) {
    const code = readFileSync(id.split('?')[0], 'utf-8')
    return code + '\nexport const { wosc, params, oscillatorTypes } = woscillators;\n...'
  }
}
```

The package is excluded from Vite's `optimizeDeps` pre-bundling so this hook fires in dev mode.

### Marbles: TypeScript implementation

Since no Marbles WASM port exists, the Marbles algorithm is implemented in TypeScript on the
main thread. It is pure mathematics (no audio DSP), so TypeScript is appropriate.

Reference: [pichenettes/eurorack — marbles/](https://github.com/pichenettes/eurorack)

Key design choices:

- **Logistic map** (`x_{n+1} = 3.9999 · x_n · (1 − x_n)`) for chaotic but deterministic randomness
- **Bernoulli process** for trigger decisions (`bias` = probability of firing)
- **deja_vu loop**: maintains a circular buffer of `length` steps; with probability `dejaVu`
  replays the stored value, otherwise generates fresh and writes back — the loop evolves
  gradually, frozen only at `dejaVu = 1`
- **t and x have independent `dejaVu` values** — timing and pitch loop separately,
  a key musical feature of the original Marbles module

---

## Architecture

```
React UI (main thread)
  └── useReducer + Context (JSON-serializable state)
        │
        ├── masterClock (setTimeout lookahead scheduler, 100 ms window)
        │     └── MarblesT / MarblesX / LaneD (TypeScript, main thread)
        │           └── audioEngine.triggerSynth / triggerKick / triggerSnare / triggerHat / triggerGranular(when)
        │
        ├── AudioParam setters (linearRampToValueAtTime for click-free knob changes)
        │     ├── AudioWorkletNode (@vectorsize/woscillators)
        │     │     └── Plaits WASM (render() per audio block, off main thread)
        │     └── AudioWorkletNode (granular-processor — Blob URL, custom)
        │           └── 4-second stereo circular buffer, up to 32 simultaneous grains
        │                 ├── Triggered mode: gate rising-edge spawns grain burst
        │                 └── Continuous mode: per-block phase counter self-clocks grain stream
        │
        └── Effects bus (delay + reverb)
              ├── Voice AnalyserNode → per-voice send GainNodes → DelayNode chain → masterGain
              └── Voice AnalyserNode → per-voice send GainNodes → ConvolverNode (synth IR) → masterGain
```

Granular audio graph:

```
synthVoice (WoscNode) → synthMuteGain → synthAnalyser ─┬─ masterGain
                                                        ├─ synthDelaySend → delayInput
                                                        ├─ synthReverbSend → reverbPreDelay
                                                        └─ granularNode (AudioWorkletNode)
                                                              └─ granMuteGain → granAnalyser ─┬─ masterGain
                                                                                              ├─ granDelaySend
                                                                                              └─ granReverbSend
```

> The granular node is tapped from `synthAnalyser` (a native `AnalyserNode`) rather than
> from `synthVoice` directly. The `WoscNode` wrapper's `connect()` does not reliably route
> audio into another `AudioWorkletNode`'s input buffer; using a native intermediate node
> as the fan-out point is the correct approach.

Send effects architecture:

- Each voice output (post-analyser) connects to two send `GainNode`s (delay send, reverb send)
- All delay sends merge into a shared `DelayNode → BiquadFilter (tone) → feedback GainNode` loop
- All reverb sends merge into a shared `DelayNode (pre-delay) → ConvolverNode → BiquadFilter (tone)`
- Reverb IR is generated algorithmically (stereo decaying noise, no audio file required)
- Both effects return to `masterGain` at independently adjustable return levels

State is split strictly:

- **UI state**: `useReducer` + React Context — JSON-serializable, persisted as presets
- **Audio state**: `AudioEngine` singleton (plain TS class) — never stored in React state

---

## Project Structure

```
src/
├── audio/
│   ├── AudioEngine.ts       # Singleton: Plaits voices + granular worklet + delay/reverb buses
│   └── types.ts             # WoscNode interface + param types incl. GranularParams, SnareParams
├── sequencer/
│   ├── LogisticMap.ts       # Chaotic RNG (logistic map) for Marbles
│   ├── scales.ts            # Scale definitions + pitch quantizer
│   ├── MarblesT.ts          # t-section: timing/trigger generator with deja_vu
│   ├── MarblesX.ts          # x-section: pitch voltage generator with deja_vu
│   ├── MasterClock.ts       # AudioContext lookahead scheduler
│   ├── LaneA.ts             # Wires t + x → Plaits synth voice
│   ├── LaneB.ts             # 3 independent MarblesT → Plaits drum voices
│   └── LaneD.ts             # Lane C granular: MarblesT → granular sampler trigger
├── components/
│   ├── Transport.tsx        # BPM, play/stop, global randomize, save/load
│   ├── LaneASection.tsx     # Marbles t + x controls, Plaits engine + knobs, mute LED
│   ├── LaneBSection.tsx     # Rhythm generator + 3 drum voice panels, mute LEDs
│   ├── LaneDSection.tsx     # Lane C: granular sampler (TRIG/CONT, REC/FRZ, Wander, capture oscilloscope)
│   ├── FxSection.tsx        # Compact Delay + Reverb global controls + send matrix
│   ├── Knob.tsx             # SVG rotary knob with pointer-capture drag
│   ├── StepGrid.tsx         # Reactive trigger-history display (read-only)
│   ├── Oscilloscope.tsx     # AnalyserNode time-domain canvas (label prop)
│   └── PeakMeter.tsx        # AnalyserNode frequency-domain bar
├── state/
│   ├── types.ts             # AppState, LaneAState, LaneBState, LaneCState (fx), LaneDState (gran)
│   ├── reducer.ts           # Pure reducer + all randomize helpers
│   └── AppContext.tsx       # Provider: syncs state → audio on every change
├── styles/
│   └── global.css           # Design tokens + all component styles
└── main.tsx
```

---

## Implementation Phases

- [x] **Phase 1** — Vite + React + TypeScript scaffold
- [x] **Phase 2** — Plaits WASM audio engine: 4 voices (synth + kick + snare + hat), Vite ESM fix
- [x] **Phase 3** — Marbles sequencer: logistic map, t-generator, x-generator, Lane A wired end-to-end
- [x] **Phase 4** — Lane B drums: second Marbles instance, 3 independent trigger streams
- [x] **Phase 5** — Full UI: SVG Knob, Transport bar, LaneA/LaneB panels, oscilloscope, peak meters, reactive step grids, scale/mode selectors, preset save/load, useReducer + Context
- [x] **Phase 6** — Effects (delay + reverb send buses, per-voice send knobs, FxSection); granular ⚄ randomize; delay anti-oscillation (Q=0.5, 400–6 kHz, 0.85 feedback cap); per-voice LED mute toggles (Synth, Kick, Snare, Hi-Hat); removed redundant footer
- [x] **Phase 7** — Lane C granular sampler: Ableton Granulator II–inspired custom `AudioWorkletProcessor` loaded via Blob URL (no build changes); 4-second stereo circular buffer sampling Lane A synth via `synthAnalyser` fan-out; Marbles T trigger clock; 8 grain controls; per-send FX knobs; mute toggle; ⚄ randomize; REC/FRZ buffer recording toggle; capture-input oscilloscope; pulsing REC button animation
- [x] **Phase 8** — Granular musical enhancement: TRIG/CONT mode toggle (continuous self-clocked grain stream at 1–16 grains/sec for drones); Wander knob (slow bounded position random walk, ~20 s full range at max); snare parameter mapping corrected (timbre=snappiness, harmonics=body+noise frequency, morph=body resonance); Body knob added to snare; pre-initialization of snare voice to avoid first-hit silence at param=0 defaults; granular Pitch snapped to 13 musical intervals (±2 oct in steps of unison/m3/M3/P4/P5/Oct) — worklet produces exact frequency ratios at semitone boundaries; randomize respects the same interval set
- [ ] **Phase 9** — Polish: parameter smoothing, Electron/Tauri wrapper

---

## Drone / Ambient Recipe

For sustained granular textures with evolving timbre:

1. Start Lane A (Synth) and let it play for a few seconds to fill the granular buffer
2. On the Lane C granular strip: enable `~ CONT` mode, set `Dens ≈ 0.4–0.6`, `Size ≈ 0.6+`, `Wander ≈ 0.3–0.6`
3. Hit `■ FRZ` to freeze the buffer at an interesting moment — grains now loop over the captured snapshot
4. Vary `Pos` and `Pitch` while Wander slowly drifts through the buffer for continuous timbre evolution
5. Adjust `Detune` and `Width` for harmonic spread and stereo field

---

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
```

---

## License note

The Plaits synthesis engine is copyright © Émilie Gillet (Mutable Instruments),
compiled to WASM via `@vectorsize/woscillators` (GPL-3.0).
The Marbles algorithm design is by Émilie Gillet; this TypeScript implementation
is an independent reimplementation for educational/creative use.
