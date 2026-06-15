import type { TParams } from '../sequencer/MarblesT'
import type { XParams } from '../sequencer/MarblesX'
import type { SynthParams, KickParams, SnareParams, HatParams } from '../audio/AudioEngine'
import type { DrumVoiceConfig } from '../sequencer/LaneB'
import type { RootNote, ScaleMode } from '../sequencer/scales'

export type { TParams, XParams, SynthParams, KickParams, SnareParams, HatParams, DrumVoiceConfig, RootNote, ScaleMode }

export interface LaneAState {
  t: TParams
  x: XParams
  synth: SynthParams
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
}

export const DEFAULT_STATE: AppState = {
  bpm: 120,
  isPlaying: false,
  laneA: {
    t:     { rate: 2, jitter: 0.15, gate: 0.5, bias: 0.65, dejaVu: 0,   length: 16 },
    x:     { spread: 0.5, bias: 0.5, steps: 8, dejaVu: 0, length: 16, root: 'C', mode: 'Dorian' },
    synth: { engine: 2, timbre: 0.5, morph: 0.3, harmonics: 0.7, decay: 0.6, level: 0.8 },
  },
  laneB: {
    density: 0.7, jitter: 0.1, length: 16,
    kick:  { bias: 0.85, dejaVu: 0, tune: 36, decay: 0.5, snap: 0.6 },
    snare: { bias: 0.65, dejaVu: 0, snap: 0.4, tone: 0.5, decay: 0.4 },
    hat:   { bias: 0.55, dejaVu: 0, open: 0.2, tone: 0.7 },
  },
}
