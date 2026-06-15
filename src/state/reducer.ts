import type { AppState, LaneAState, LaneBState, TParams, XParams, SynthParams } from './types'
import { DEFAULT_STATE } from './types'

export type Action =
  | { type: 'SET_BPM';          value: number }
  | { type: 'SET_PLAYING';      value: boolean }
  | { type: 'PATCH_LANE_A_T';   patch: Partial<TParams> }
  | { type: 'PATCH_LANE_A_X';   patch: Partial<XParams> }
  | { type: 'PATCH_LANE_A_SYNTH'; patch: Partial<SynthParams> }
  | { type: 'PATCH_LANE_B';     patch: Partial<Pick<LaneBState, 'density' | 'jitter' | 'length'>> }
  | { type: 'PATCH_KICK';       patch: Partial<LaneBState['kick']> }
  | { type: 'PATCH_SNARE';      patch: Partial<LaneBState['snare']> }
  | { type: 'PATCH_HAT';        patch: Partial<LaneBState['hat']> }
  | { type: 'RANDOMIZE' }
  | { type: 'RESET' }
  | { type: 'LOAD_PRESET';      state: AppState }

function randA(laneA: LaneAState): LaneAState {
  return {
    ...laneA,
    t: { ...laneA.t, bias: Math.random(), jitter: Math.random() * 0.5, dejaVu: Math.random() * 0.8 },
    x: { ...laneA.x, spread: 0.2 + Math.random() * 0.8, bias: Math.random(), dejaVu: Math.random() * 0.8 },
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
    case 'RANDOMIZE':
      return { ...state, laneA: randA(state.laneA), laneB: randB(state.laneB) }
    case 'RESET':
      return { ...DEFAULT_STATE, isPlaying: state.isPlaying }
    case 'LOAD_PRESET':
      return action.state
    default:
      return state
  }
}
