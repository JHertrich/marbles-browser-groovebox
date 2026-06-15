# Groovebox

A browser-based generative groovebox built with React 18, Vite, TypeScript, and the Web Audio API.  
Two synchronized lanes — a Plaits synthesizer sequenced by a Marbles-inspired generative engine,
and three Plaits drum voices driven by a probabilistic rhythm generator.

---

## Platform Support

| Platform | Status |
|----------|--------|
| Chrome 110+ | ✅ Supported |
| Firefox 120+ | ✅ Supported |
| Electron (desktop) | 🔜 Planned wrapper |
| Tauri (desktop) | 🔜 Planned wrapper |
| **iOS** | ❌ **Not supported** — Electron does not run on iOS; AudioWorklet + WASM constraints make iOS a non-target for this project |

---

## Features

- **Lane A — Synth**: Marbles-inspired generative pitch sequencer (TypeScript) driving a Plaits WASM synthesizer voice
- **Lane B — Drums**: Marbles-inspired probabilistic rhythm generator driving three Plaits drum voices (Kick, Snare, Hi-Hat)
- **Shared master clock**: `AudioContext.currentTime`-based lookahead scheduler (100 ms window, 25 ms interval)
- **Generative sequencing**: Independent t (timing) and x (pitch) generators with `deja_vu` loop control
- **Preset system**: Save/load all parameters as JSON via `localStorage` *(planned)*

---

## WASM Research & Decisions

### Candidates evaluated

Before writing any synthesis code, all available npm packages and GitHub repositories for
WebAssembly ports of Mutable Instruments modules were surveyed.

| Package | Plaits engines | Marbles | AudioWorklet-ready | Last updated |
|---------|---------------|---------|-------------------|--------------|
| **`@vectorsize/woscillators`** | ✅ All 16 (0–15) | ❌ Plaits only | ✅ Yes | Nov 2025 (active) |
| `@vectorsize/weaves-oscillators` | ✅ Partial | ❌ | ✅ | Apr 2022 (unmaintained) |
| `mi-plaits-wasm` | — | — | — | **Does not exist** on npm |
| `mutable-instruments-wasm` | — | — | — | **Does not exist** on npm |
| `plaits-wasm` | — | — | — | **Does not exist** on npm |

**No Marbles WASM port exists** on npm or GitHub.

### Decision: `@vectorsize/woscillators@2.0.1`

`@vectorsize/woscillators` is the only actively maintained browser-ready Plaits WASM port.
It exposes all 16 Plaits synthesis engines via an `AudioWorkletNode` whose DSP runs fully
off the main thread.

Engine mapping used in this project:

| Engine index | Name | Used for |
|-------------|------|---------|
| 0 | Virtual Analog | Lane A melodic option |
| 1 | Waveshaping | Lane A melodic option |
| 2 | FM | Lane A default |
| 4 | Additive | Lane A melodic option |
| 6 | Chord | Lane A melodic option |
| 13 | Bass drum | Lane B Kick |
| 14 | Snare drum | Lane B Snare |
| 15 | Hi-hat | Lane B Hi-Hat |

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
        │     └── MarblesT / MarblesX (TypeScript, main thread)
        │           └── audioEngine.triggerSynth / triggerKick / triggerSnare / triggerHat(when)
        │
        └── AudioParam setters (linearRampToValueAtTime for click-free knob changes)
              └── AudioWorkletNode (@vectorsize/woscillators)
                    └── Plaits WASM (render() per audio block, off main thread)
```

State is split strictly:

- **UI state**: `useReducer` + React Context — JSON-serializable, persisted as presets
- **Audio state**: `AudioEngine` singleton (plain TS class) — never stored in React state

---

## Project Structure

```
src/
├── audio/
│   ├── AudioEngine.ts    # Singleton: owns AudioContext + 4 Plaits voice nodes
│   └── types.ts          # TypeScript interface for WoscNode + param types
├── sequencer/
│   ├── LogisticMap.ts    # Chaotic RNG (logistic map) for Marbles
│   ├── scales.ts         # Scale definitions + pitch quantizer
│   ├── MarblesT.ts       # t-section: timing/trigger generator with deja_vu
│   ├── MarblesX.ts       # x-section: pitch voltage generator with deja_vu
│   ├── MasterClock.ts    # AudioContext lookahead scheduler
│   └── LaneA.ts          # Wires t + x → Plaits synth voice
├── components/           # (Phase 5) React UI components
├── state/                # (Phase 5) useReducer + Context
├── styles/
│   └── global.css        # Design tokens (from groovebox-mockup.html)
└── main.tsx
```

---

## Implementation Phases

- [x] **Phase 1** — Vite + React + TypeScript scaffold
- [x] **Phase 2** — Plaits WASM audio engine: 4 voices (synth + kick + snare + hat), Vite ESM fix
- [x] **Phase 3** — Marbles sequencer: logistic map, t-generator, x-generator, Lane A wired end-to-end
- [x] **Phase 4** — Lane B drums: second Marbles instance, 3 independent trigger streams
- [x] **Phase 5** — Full UI: SVG Knob component, Transport bar, LaneA/LaneB panels, oscilloscope, peak meters, reactive step grids, scale/mode selectors, preset save/load via localStorage, useReducer + Context state management
- [ ] **Phase 6** — Polish: parameter smoothing, global randomize, Electron/Tauri wrapper

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
