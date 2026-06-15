import type { TParams } from '../sequencer/MarblesT'
import type { XParams } from '../sequencer/MarblesX'
import type { SynthParams, KickParams, SnareParams, HatParams, GranularParams, ModDest } from '../audio/AudioEngine'
import type { DrumVoiceConfig } from '../sequencer/LaneB'
import type { RootNote, ScaleMode } from '../sequencer/scales'

export type { TParams, XParams, SynthParams, KickParams, SnareParams, HatParams, GranularParams, DrumVoiceConfig, RootNote, ScaleMode, ModDest }

export type SyncDiv = '1/8' | '3/16' | '1/4' | '3/8' | '1/2'

// ── Modulation system ─────────────────────────────────────────────────────────
export type LFOWaveform = 'sine' | 'triangle' | 'square' | 'sample-hold'
export type LFOSyncDiv  = '4/1' | '2/1' | '1/1' | '1/2' | '1/4' | '1/8' | '1/16'

export interface LFOState {
  waveform: LFOWaveform
  rate:     number      // 0–1 normalized → 0.05–10 Hz (logarithmic) in free mode
  synced:   boolean
  syncDiv:  LFOSyncDiv
  depth:    number      // 0–1 master depth multiplier
}

export interface ModSlot {
  lfoIndex: 0 | 1 | 2 | 3
  dest:     ModDest
  amount:   number      // -1 to 1
}

export interface ModState {
  lfos:  [LFOState, LFOState, LFOState, LFOState]
  slots: ModSlot[]
}

const DEFAULT_LFO: LFOState = { waveform: 'sine', rate: 0.3, synced: false, syncDiv: '1/4', depth: 0.5 }

export interface DelayState {
  time: number        // 0–2.0 seconds (used when bpmSync = false)
  feedback: number    // 0–1
  tone: number        // 0–1 (lowpass cutoff: 300 Hz → 18 kHz)
  returnLevel: number // 0–1
  bpmSync: boolean
  syncDiv: SyncDiv
}

export interface ReverbState {
  size: number        // 0–1 → 0.5–6 s IR length
  decay: number       // 0–1 → RT60 steepness
  tone: number        // 0–1 (post-IR lowpass)
  preDelay: number    // 0–0.1 seconds
  returnLevel: number // 0–1
}

export interface SendLevels {
  delay: number
  reverb: number
}

export interface LaneCState {
  delay: DelayState
  reverb: ReverbState
  sends: {
    synth: SendLevels
    kick:  SendLevels
    snare: SendLevels
    hat:   SendLevels
    gran:  SendLevels
  }
}

export interface LaneDState {
  t: TParams
  grain: GranularParams
  granEnabled: boolean
  granRecording: boolean
}

export interface LaneAState {
  t: TParams
  x: XParams
  synth: SynthParams
  synthEnabled: boolean
}

export interface LaneBState {
  density: number
  jitter:  number
  length:  number
  kick:  DrumVoiceConfig & KickParams
  snare: DrumVoiceConfig & SnareParams
  hat:   DrumVoiceConfig & HatParams
}

export interface AppState {
  bpm: number
  isPlaying: boolean
  laneA: LaneAState
  laneB: LaneBState
  laneC: LaneCState
  laneD: LaneDState
  mod:  ModState
}

export const DEFAULT_STATE: AppState = {
  bpm: 120,
  isPlaying: false,
  laneA: {
    t:     { rate: 2, jitter: 0.15, gate: 0.5, bias: 0.65, dejaVu: 0,   length: 16 },
    x:     { spread: 0.5, bias: 0.5, steps: 8, dejaVu: 0, length: 16, root: 'C', mode: 'Dorian' },
    synth: { engine: 2, timbre: 0.5, morph: 0.3, harmonics: 0.7, decay: 0.6, level: 0.8 },
    synthEnabled: true,
  },
  laneB: {
    density: 0.7, jitter: 0.1, length: 16,
    kick:  { bias: 0.85, dejaVu: 0, enabled: true, tune: 36, decay: 0.5, snap: 0.6 },
    snare: { bias: 0.65, dejaVu: 0, enabled: true, snap: 0.65, tone: 0.5, body: 0.5, decay: 0.4 },
    hat:   { bias: 0.55, dejaVu: 0, enabled: true, open: 0.2, tone: 0.7 },
  },
  laneC: {
    delay:  { time: 0.375, feedback: 0.4, tone: 0.7, returnLevel: 0.6, bpmSync: true, syncDiv: '3/8' },
    reverb: { size: 0.6, decay: 0.5, tone: 0.6, preDelay: 0.02, returnLevel: 0.5 },
    sends: {
      synth: { delay: 0.25, reverb: 0.35 },
      kick:  { delay: 0.05, reverb: 0.15 },
      snare: { delay: 0.15, reverb: 0.25 },
      hat:   { delay: 0.03, reverb: 0.08 },
      gran:  { delay: 0.2,  reverb: 0.3  },
    },
  },
  laneD: {
    t:    { rate: 3, jitter: 0.2, gate: 0.5, bias: 0.5, dejaVu: 0.3, length: 16 },
    grain: { position: 0.05, size: 0.4, density: 0.4, pitch: 0.5, spray: 0.3, detune: 0.1, width: 0.5, level: 0.7, wander: 0, continuousMode: false },
    granEnabled: true,
    granRecording: true,
  },
  mod: {
    lfos: [DEFAULT_LFO, DEFAULT_LFO, DEFAULT_LFO, DEFAULT_LFO],
    slots: [],
  },
}
