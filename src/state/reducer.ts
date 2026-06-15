import type { AppState, LaneAState, LaneBState, LaneCState, LaneDState, DelayState, ReverbState, SendLevels, SyncDiv, TParams, XParams, SynthParams, GranularParams } from './types'
import { DEFAULT_STATE } from './types'
import { SCALE_MODE_NAMES, ROOT_NOTES } from '../sequencer/scales'

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
  | { type: 'RANDOMIZE_LANE_A_T' }
  | { type: 'RANDOMIZE_LANE_A_X' }
  | { type: 'RANDOMIZE_LANE_B_RHYTHM' }
  | { type: 'RANDOMIZE_DELAY' }
  | { type: 'RANDOMIZE_REVERB' }
  | { type: 'TOGGLE_SYNTH_ENABLED' }
  | { type: 'TOGGLE_KICK_ENABLED' }
  | { type: 'TOGGLE_SNARE_ENABLED' }
  | { type: 'TOGGLE_HAT_ENABLED' }
  | { type: 'PATCH_LANE_D_T';      patch: Partial<TParams> }
  | { type: 'PATCH_LANE_D_GRAIN';  patch: Partial<GranularParams> }
  | { type: 'TOGGLE_GRAN_ENABLED' }
  | { type: 'RANDOMIZE_GRAN' }
  | { type: 'RANDOMIZE_LANE_D_T' }
  | { type: 'RESET' }
  | { type: 'LOAD_PRESET';          state: AppState }

const rnd = Math.random
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]

const SYNC_DIVS: SyncDiv[] = ['1/8', '3/16', '1/4', '3/8', '1/2']

function randA(laneA: LaneAState): LaneAState {
  return {
    ...laneA,
    t: {
      ...laneA.t,
      rate: Math.ceil(rnd() * 8),
      jitter: rnd() * 0.6,
      gate: 0.2 + rnd() * 0.7,
      bias: 0.3 + rnd() * 0.7,
      dejaVu: rnd() * 0.8,
      length: 4 + Math.floor(rnd() * 29),
    },
    x: {
      ...laneA.x,
      spread: 0.2 + rnd() * 0.8,
      bias: rnd(),
      steps: 1 + Math.floor(rnd() * 8),
      dejaVu: rnd() * 0.8,
      length: 4 + Math.floor(rnd() * 29),
      root: pick(ROOT_NOTES),
      mode: pick(SCALE_MODE_NAMES),
    },
    synth: {
      engine: pick([0, 1, 2, 4, 6] as const),
      timbre: rnd(), morph: rnd(), harmonics: rnd(),
      decay: 0.2 + rnd() * 0.8, level: 0.4 + rnd() * 0.6,
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

function randD(laneD: LaneDState): LaneDState {
  return {
    ...laneD,
    t: {
      rate: Math.ceil(rnd() * 8),
      jitter: rnd() * 0.6,
      gate: 0.2 + rnd() * 0.7,
      bias: 0.3 + rnd() * 0.7,
      dejaVu: rnd() * 0.8,
      length: 4 + Math.floor(rnd() * 29),
    },
    grain: {
      position: rnd(),
      size: 0.1 + rnd() * 0.9,
      density: rnd(),
      pitch: 0.2 + rnd() * 0.6,
      spray: rnd() * 0.7,
      detune: rnd() * 0.5,
      width: rnd(),
      level: 0.4 + rnd() * 0.6,
    },
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
      return {
        ...state,
        laneA: randA(state.laneA),
        laneB: randB(state.laneB),
        laneD: randD(state.laneD),
        laneC: {
          ...state.laneC,
          delay: {
            ...state.laneC.delay,
            feedback: rnd() * 0.85,
            tone: rnd(),
            returnLevel: 0.3 + rnd() * 0.6,
            bpmSync: rnd() > 0.25,
            syncDiv: pick(SYNC_DIVS),
            time: rnd() * 1.5,
          },
          reverb: {
            size: 0.2 + rnd() * 0.8,
            decay: rnd(),
            tone: 0.3 + rnd() * 0.7,
            preDelay: rnd() * 0.08,
            returnLevel: 0.3 + rnd() * 0.6,
          },
        },
      }
    case 'RANDOMIZE_SYNTH':
      return {
        ...state,
        laneA: {
          ...state.laneA,
          synth: {
            engine: pick([0, 1, 2, 4, 6] as const),
            timbre: rnd(), morph: rnd(), harmonics: rnd(),
            decay: 0.2 + rnd() * 0.8, level: 0.4 + rnd() * 0.6,
          },
        },
      }
    case 'RANDOMIZE_LANE_A_T':
      return {
        ...state,
        laneA: {
          ...state.laneA,
          t: {
            rate: Math.ceil(rnd() * 8),
            jitter: rnd() * 0.6,
            gate: 0.2 + rnd() * 0.7,
            bias: 0.3 + rnd() * 0.7,
            dejaVu: rnd() * 0.8,
            length: 4 + Math.floor(rnd() * 29),
          },
        },
      }
    case 'RANDOMIZE_LANE_A_X':
      return {
        ...state,
        laneA: {
          ...state.laneA,
          x: {
            ...state.laneA.x,
            spread: 0.2 + rnd() * 0.8,
            bias: rnd(),
            steps: 1 + Math.floor(rnd() * 8),
            dejaVu: rnd() * 0.8,
            length: 4 + Math.floor(rnd() * 29),
            root: pick(ROOT_NOTES),
            mode: pick(SCALE_MODE_NAMES),
          },
        },
      }
    case 'RANDOMIZE_LANE_B_RHYTHM':
      return {
        ...state,
        laneB: {
          ...state.laneB,
          density: 0.3 + rnd() * 0.7,
          jitter: rnd() * 0.5,
          length: 4 + Math.floor(rnd() * 29),
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
          hat: { ...state.laneB.hat, open: rnd(), tone: rnd() },
        },
      }
    case 'RANDOMIZE_DELAY':
      return {
        ...state,
        laneC: {
          ...state.laneC,
          delay: {
            ...state.laneC.delay,
            feedback: rnd() * 0.85,
            tone: rnd(),
            returnLevel: 0.3 + rnd() * 0.6,
            bpmSync: rnd() > 0.25,
            syncDiv: pick(SYNC_DIVS),
            time: rnd() * 1.5,
          },
        },
      }
    case 'RANDOMIZE_REVERB':
      return {
        ...state,
        laneC: {
          ...state.laneC,
          reverb: {
            size: 0.2 + rnd() * 0.8,
            decay: rnd(),
            tone: 0.3 + rnd() * 0.7,
            preDelay: rnd() * 0.08,
            returnLevel: 0.3 + rnd() * 0.6,
          },
        },
      }
    case 'PATCH_LANE_D_T':
      return { ...state, laneD: { ...state.laneD, t: { ...state.laneD.t, ...action.patch } } }
    case 'PATCH_LANE_D_GRAIN':
      return { ...state, laneD: { ...state.laneD, grain: { ...state.laneD.grain, ...action.patch } } }
    case 'TOGGLE_GRAN_ENABLED':
      return { ...state, laneD: { ...state.laneD, granEnabled: !state.laneD.granEnabled } }
    case 'RANDOMIZE_GRAN':
      return { ...state, laneD: randD(state.laneD) }
    case 'RANDOMIZE_LANE_D_T':
      return {
        ...state,
        laneD: {
          ...state.laneD,
          t: {
            rate: Math.ceil(rnd() * 8),
            jitter: rnd() * 0.6,
            gate: 0.2 + rnd() * 0.7,
            bias: 0.3 + rnd() * 0.7,
            dejaVu: rnd() * 0.8,
            length: 4 + Math.floor(rnd() * 29),
          },
        },
      }
    case 'TOGGLE_SYNTH_ENABLED':
      return { ...state, laneA: { ...state.laneA, synthEnabled: !state.laneA.synthEnabled } }
    case 'TOGGLE_KICK_ENABLED':
      return { ...state, laneB: { ...state.laneB, kick: { ...state.laneB.kick, enabled: !state.laneB.kick.enabled } } }
    case 'TOGGLE_SNARE_ENABLED':
      return { ...state, laneB: { ...state.laneB, snare: { ...state.laneB.snare, enabled: !state.laneB.snare.enabled } } }
    case 'TOGGLE_HAT_ENABLED':
      return { ...state, laneB: { ...state.laneB, hat: { ...state.laneB.hat, enabled: !state.laneB.hat.enabled } } }
    case 'RESET':
      return { ...DEFAULT_STATE, isPlaying: state.isPlaying }
    case 'LOAD_PRESET':
      return action.state
    default:
      return state
  }
}
