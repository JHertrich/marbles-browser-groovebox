import type { AppState, LaneAState, LaneBState, LaneCState, LaneDState, DelayState, ReverbState, SendLevels, SyncDiv, TParams, XParams, SynthParams, GranularParams, LFOState, LFOWaveform, LFOSyncDiv, ModDest } from './types'
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
  | { type: 'TOGGLE_GRAN_RECORDING' }
  | { type: 'RANDOMIZE_GRAN' }
  | { type: 'RANDOMIZE_LANE_D_T' }
  | { type: 'RESET' }
  | { type: 'LOAD_PRESET';          state: AppState }
  | { type: 'PATCH_LFO';            index: 0|1|2|3; patch: Partial<LFOState> }
  | { type: 'SET_MOD_SLOT';         lfoIndex: 0|1|2|3; dest: ModDest; amount: number }
  | { type: 'REMOVE_MOD_SLOT';      lfoIndex: 0|1|2|3; dest: ModDest }
  | { type: 'RANDOMIZE_MOD' }
  | { type: 'RANDOMIZE_LFOS' }
  | { type: 'RANDOMIZE_MOD_SLOTS' }

const rnd = Math.random
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]

// Musical interval set for granular pitch randomization (semitones from unison).
const GRAN_PITCH_ST = [-24, -12, -7, -5, -4, -3, 0, 3, 4, 5, 7, 12, 24] as const
const randGranPitch = (): number => 0.5 + pick(GRAN_PITCH_ST) / 48

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
      position: rnd() * 0.5,
      size: 0.1 + rnd() * 0.9,
      density: rnd(),
      pitch: randGranPitch(),
      spray: rnd() * 0.7,
      detune: rnd() * 0.5,
      width: rnd(),
      level: 0.4 + rnd() * 0.6,
      wander: rnd() * 0.6,
      continuousMode: laneD.grain.continuousMode,  // preserve mode on randomize
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
            snap: 0.4 + Math.random() * 0.6,       // keep noise component audible
            tone: Math.random(),
            body: 0.2 + Math.random() * 0.7,        // avoid fully dead body
            decay: 0.15 + Math.random() * 0.6,
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
    case 'TOGGLE_GRAN_RECORDING':
      return { ...state, laneD: { ...state.laneD, granRecording: !state.laneD.granRecording } }
    case 'RANDOMIZE_GRAN':
      return { ...state, laneD: { ...state.laneD, grain: randD(state.laneD).grain } }
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
    case 'RANDOMIZE_MOD':
    case 'RANDOMIZE_LFOS':
    case 'RANDOMIZE_MOD_SLOTS': {
      const WAVEFORMS: LFOWaveform[] = ['sine', 'triangle', 'square', 'sample-hold']
      const SYNC_DIVS: LFOSyncDiv[] = ['4/1', '2/1', '1/1', '1/2', '1/4', '1/8', '1/16']
      const ALL_DESTS: ModDest[] = [
        'synth.timbre', 'synth.morph', 'synth.harmonics', 'synth.decay', 'synth.level',
        'laneA.jitter', 'laneA.bias',
        'laneB.density', 'laneB.jitter',
        'kick.decay', 'kick.snap',
        'snare.snap', 'snare.tone', 'snare.body', 'snare.decay',
        'hat.open', 'hat.tone',
        'gran.position', 'gran.size', 'gran.density', 'gran.pitch',
        'gran.spray', 'gran.detune', 'gran.wander', 'gran.level',
        'laneD.jitter', 'laneD.bias',
        'delay.feedback', 'delay.time',
        'reverb.size', 'reverb.decay', 'reverb.level',
      ]
      const randLfos = () => state.mod.lfos.map(() => ({
        waveform: pick(WAVEFORMS),
        rate: rnd(),
        synced: rnd() > 0.65,
        syncDiv: pick(SYNC_DIVS),
        depth: 0.25 + rnd() * 0.75,
      })) as typeof state.mod.lfos
      const randSlots = () => {
        const count = 4 + Math.floor(rnd() * 5)
        return [...ALL_DESTS].sort(() => rnd() - 0.5).slice(0, count).map(dest => ({
          lfoIndex: Math.floor(rnd() * 4) as 0|1|2|3,
          dest,
          amount: (rnd() > 0.5 ? 1 : -1) * (0.3 + rnd() * 0.7),
        }))
      }
      const lfos  = action.type !== 'RANDOMIZE_MOD_SLOTS' ? randLfos()  : state.mod.lfos
      const slots = action.type !== 'RANDOMIZE_LFOS'     ? randSlots() : state.mod.slots
      return { ...state, mod: { lfos, slots } }
    }
    case 'PATCH_LFO': {
      const lfos = [...state.mod.lfos] as typeof state.mod.lfos
      lfos[action.index] = { ...lfos[action.index], ...action.patch }
      return { ...state, mod: { ...state.mod, lfos } }
    }
    case 'SET_MOD_SLOT': {
      const existing = state.mod.slots.findIndex(s => s.lfoIndex === action.lfoIndex && s.dest === action.dest)
      const slots = existing >= 0
        ? state.mod.slots.map((s, i) => i === existing ? { ...s, amount: action.amount } : s)
        : [...state.mod.slots, { lfoIndex: action.lfoIndex, dest: action.dest, amount: action.amount }]
      return { ...state, mod: { ...state.mod, slots } }
    }
    case 'REMOVE_MOD_SLOT':
      return {
        ...state,
        mod: {
          ...state.mod,
          slots: state.mod.slots.filter(s => !(s.lfoIndex === action.lfoIndex && s.dest === action.dest)),
        },
      }
    default:
      return state
  }
}
