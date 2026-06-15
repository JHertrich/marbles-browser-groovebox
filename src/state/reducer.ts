import type { AppState, LaneAState, LaneBState, LaneCState, DelayState, ReverbState, SendLevels, TParams, XParams, SynthParams } from './types'
import { DEFAULT_STATE } from './types'

export type Action =
  | { type: 'SET_BPM';              value: number }
  | { type: 'SET_PLAYING';          value: boolean }
  | { type: 'PATCH_LANE_A_T';       patch: Partial<TParams> }
  | { type: 'PATCH_LANE_A_X';       patch: Partial<XParams> }
  | { type: 'PATCH_LANE_A_SYNTH';   patch: Partial<SynthParams> }
  | { type: 'PATCH_LANE_B';         patch: Partial<Pick<LaneBState, 'density' | 'jitter' | 'length'>> }
  | { type: 'PATCH_KICK';           patch: Partial<LaneBState['kick']> }
  | { type: 'PATCH_SNARE';          patch: Partial<LaneBState['snare']> }
  | { type: 'PATCH_HAT';            patch: Partial<LaneBState['hat']> }
  | { type: 'PATCH_LANE_C_DELAY';   patch: Partial<DelayState> }
  | { type: 'PATCH_LANE_C_REVERB';  patch: Partial<ReverbState> }
  | { type: 'PATCH_LANE_C_SEND';    voice: keyof LaneCState['sends']; patch: Partial<SendLevels> }
  | { type: 'RANDOMIZE' }
  | { type: 'RANDOMIZE_SYNTH' }
  | { type: 'RANDOMIZE_KICK' }
  | { type: 'RANDOMIZE_SNARE' }
  | { type: 'RANDOMIZE_HAT' }
  | { type: 'RESET' }
  | { type: 'LOAD_PRESET';          state: AppState }

function randA(laneA: LaneAState): LaneAState {
  return {
    ...laneA,
    t: { ...laneA.t, bias: Math.random(), jitter: Math.random() * 0.5, dejaVu: Math.random() * 0.8 },
    x: { ...laneA.x, spread: 0.2 + Math.random() * 0.8, bias: Math.random(), dejaVu: Math.random() * 0.8 },
    synth: {
      ...laneA.synth,
      timbre: Math.random(), morph: Math.random(), harmonics: Math.random(),
      decay: 0.2 + Math.random() * 0.8, level: 0.4 + Math.random() * 0.6,
    },
  }
}

function randB(laneB: LaneBState): LaneBState {
  return {
    ...laneB,
    density: 0.3 + Math.random() * 0.7,
    kick:  { ...laneB.kick,  bias: Math.random(), dejaVu: Math.random() * 0.8 },
    snare: { ...laneB.snare, bias: Math.random(), dejaVu: Math.random() * 0.8 },
    hat:   { ...laneB.hat,   bias: Math.random(), dejaVu: Math.random() * 0.8 },
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BPM':
      return { ...state, bpm: action.value }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.value }
    case 'PATCH_LANE_A_T':
      return { ...state, laneA: { ...state.laneA, t: { ...state.laneA.t, ...action.patch } } }
    case 'PATCH_LANE_A_X':
      return { ...state, laneA: { ...state.laneA, x: { ...state.laneA.x, ...action.patch } } }
    case 'PATCH_LANE_A_SYNTH':
      return { ...state, laneA: { ...state.laneA, synth: { ...state.laneA.synth, ...action.patch } } }
    case 'PATCH_LANE_B':
      return { ...state, laneB: { ...state.laneB, ...action.patch } }
    case 'PATCH_KICK':
      return { ...state, laneB: { ...state.laneB, kick: { ...state.laneB.kick, ...action.patch } } }
    case 'PATCH_SNARE':
      return { ...state, laneB: { ...state.laneB, snare: { ...state.laneB.snare, ...action.patch } } }
    case 'PATCH_HAT':
      return { ...state, laneB: { ...state.laneB, hat: { ...state.laneB.hat, ...action.patch } } }
    case 'PATCH_LANE_C_DELAY':
      return { ...state, laneC: { ...state.laneC, delay: { ...state.laneC.delay, ...action.patch } } }
    case 'PATCH_LANE_C_REVERB':
      return { ...state, laneC: { ...state.laneC, reverb: { ...state.laneC.reverb, ...action.patch } } }
    case 'PATCH_LANE_C_SEND':
      return {
        ...state,
        laneC: {
          ...state.laneC,
          sends: {
            ...state.laneC.sends,
            [action.voice]: { ...state.laneC.sends[action.voice], ...action.patch },
          },
        },
      }
    case 'RANDOMIZE':
      return { ...state, laneA: randA(state.laneA), laneB: randB(state.laneB) }
    case 'RANDOMIZE_SYNTH':
      return {
        ...state,
        laneA: {
          ...state.laneA,
          synth: {
            ...state.laneA.synth,
            timbre: Math.random(), morph: Math.random(), harmonics: Math.random(),
            decay: 0.2 + Math.random() * 0.8, level: 0.4 + Math.random() * 0.6,
          },
        },
      }
    case 'RANDOMIZE_KICK':
      return {
        ...state,
        laneB: {
          ...state.laneB,
          kick: {
            ...state.laneB.kick,
            tune: Math.round(24 + Math.random() * 48),
            decay: 0.2 + Math.random() * 0.8,
            snap: Math.random(),
          },
        },
      }
    case 'RANDOMIZE_SNARE':
      return {
        ...state,
        laneB: {
          ...state.laneB,
          snare: {
            ...state.laneB.snare,
            snap: Math.random(), tone: Math.random(), decay: 0.2 + Math.random() * 0.8,
          },
        },
      }
    case 'RANDOMIZE_HAT':
      return {
        ...state,
        laneB: {
          ...state.laneB,
          hat: { ...state.laneB.hat, open: Math.random(), tone: Math.random() },
        },
      }
    case 'RESET':
      return { ...DEFAULT_STATE, isPlaying: state.isPlaying }
    case 'LOAD_PRESET':
      return action.state
    default:
      return state
  }
}
