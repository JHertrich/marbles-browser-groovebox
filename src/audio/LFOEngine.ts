import type { AppState } from '../state/types'
import type { ModDest, LFOSyncDiv } from '../state/types'
import { audioEngine } from './AudioEngine'
import { laneA } from '../sequencer/LaneA'
import { laneB } from '../sequencer/LaneB'
import { laneD } from '../sequencer/LaneD'

// Beats-per-bar multipliers for synced LFO rates (relative to 1/4 note = 1 beat)
const SYNC_DIV_BEATS: Record<LFOSyncDiv, number> = {
  '4/1': 16, '2/1': 8, '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25,
}

function lfoRateHz(normalized: number, synced: boolean, syncDiv: LFOSyncDiv, bpm: number): number {
  if (synced) {
    const beats = SYNC_DIV_BEATS[syncDiv]
    return bpm / (60 * beats)
  }
  // Logarithmic: 0.05 Hz at 0, ~10 Hz at 1
  return 0.05 * Math.pow(200, normalized)
}

function computeWaveform(phase: number, waveform: string, shValue: number): number {
  switch (waveform) {
    case 'triangle':    return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase
    case 'square':      return phase < 0.5 ? 1 : -1
    case 'sample-hold': return shValue
    default:            return Math.sin(phase * 2 * Math.PI)  // sine
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

class LFOEngine {
  private intervalId: number | null = null
  private lastTime: number[] = [0, 0, 0, 0]
  private phases: number[] = [0, 0, 0, 0]
  private shValues: number[] = [0, 0, 0, 0]
  private rawValues: number[] = [0, 0, 0, 0]  // current [-1,1] output per LFO, for UI

  private stateRef: AppState | null = null

  setStateRef(state: AppState): void {
    this.stateRef = state
  }

  start(ctx: AudioContext): void {
    if (this.intervalId !== null) return
    const now = ctx.currentTime
    this.lastTime = [now, now, now, now]
    this.intervalId = window.setInterval(() => this.tick(ctx), 25)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // Returns current raw LFO outputs [-1,1] for UI animation
  getValues(): number[] { return this.rawValues }

  private tick(ctx: AudioContext): void {
    if (!this.stateRef) return
    const state = this.stateRef
    const now = ctx.currentTime
    const bpm = state.bpm

    // Advance phases for each LFO
    for (let i = 0; i < 4; i++) {
      const lfo = state.mod.lfos[i]
      const rate = lfoRateHz(lfo.rate, lfo.synced, lfo.syncDiv, bpm)
      const dt = now - this.lastTime[i]
      this.lastTime[i] = now
      const prevPhase = this.phases[i]
      this.phases[i] = (this.phases[i] + rate * dt) % 1
      // S&H: sample new random value on phase wraparound
      if (lfo.waveform === 'sample-hold' && this.phases[i] < prevPhase) {
        this.shValues[i] = Math.random() * 2 - 1
      }
      this.rawValues[i] = computeWaveform(this.phases[i], lfo.waveform, this.shValues[i]) * lfo.depth
    }

    if (state.mod.slots.length === 0) return

    // Compute total modulation offset per destination
    const mods = new Map<ModDest, number>()
    for (const slot of state.mod.slots) {
      const lfoOut = this.rawValues[slot.lfoIndex]
      const offset = lfoOut * slot.amount
      mods.set(slot.dest, (mods.get(slot.dest) ?? 0) + offset)
    }

    // Apply modulation to each destination
    for (const [dest, mod] of mods) {
      this.applyDest(dest, mod, state)
    }
  }

  private applyDest(dest: ModDest, mod: number, state: AppState): void {
    // Audio-param destinations — use AudioEngine.applyModulation
    const audioParamDests: ModDest[] = [
      'synth.timbre', 'synth.morph', 'synth.harmonics', 'synth.decay', 'synth.level',
      'gran.position', 'gran.size', 'gran.density', 'gran.pitch',
      'gran.spray', 'gran.detune', 'gran.wander', 'gran.level',
      'delay.feedback', 'delay.time',
    ]
    if (audioParamDests.includes(dest)) {
      const base = this.baseValue(dest, state)
      audioEngine.applyModulation(dest, clamp01(base + mod))
      return
    }

    // JS-param destinations — write directly to sequencer params
    switch (dest) {
      case 'laneA.jitter':
        laneA.params.t = { ...laneA.params.t, jitter: clamp01(state.laneA.t.jitter + mod) }; break
      case 'laneA.bias':
        laneA.params.t = { ...laneA.params.t, bias: clamp01(state.laneA.t.bias + mod) }; break
      case 'laneB.density':
        laneB.params.density = clamp01(state.laneB.density + mod); break
      case 'laneB.jitter':
        laneB.params.jitter = clamp01(state.laneB.jitter + mod); break
      case 'laneD.jitter':
        laneD.params.t = { ...laneD.params.t, jitter: clamp01(state.laneD.t.jitter + mod) }; break
      case 'laneD.bias':
        laneD.params.t = { ...laneD.params.t, bias: clamp01(state.laneD.t.bias + mod) }; break
      case 'kick.decay':
        laneB.params.kick = { ...laneB.params.kick, decay: clamp01(state.laneB.kick.decay + mod) }; break
      case 'kick.snap':
        laneB.params.kick = { ...laneB.params.kick, snap: clamp01(state.laneB.kick.snap + mod) }; break
      case 'snare.snap':
        laneB.params.snare = { ...laneB.params.snare, snap: clamp01(state.laneB.snare.snap + mod) }; break
      case 'snare.tone':
        laneB.params.snare = { ...laneB.params.snare, tone: clamp01(state.laneB.snare.tone + mod) }; break
      case 'snare.body':
        laneB.params.snare = { ...laneB.params.snare, body: clamp01(state.laneB.snare.body + mod) }; break
      case 'snare.decay':
        laneB.params.snare = { ...laneB.params.snare, decay: clamp01(state.laneB.snare.decay + mod) }; break
      case 'hat.open':
        laneB.params.hat = { ...laneB.params.hat, open: clamp01(state.laneB.hat.open + mod) }; break
      case 'hat.tone':
        laneB.params.hat = { ...laneB.params.hat, tone: clamp01(state.laneB.hat.tone + mod) }; break
    }
  }

  private baseValue(dest: ModDest, state: AppState): number {
    switch (dest) {
      case 'synth.timbre':    return state.laneA.synth.timbre
      case 'synth.morph':     return state.laneA.synth.morph
      case 'synth.harmonics': return state.laneA.synth.harmonics
      case 'synth.decay':     return state.laneA.synth.decay
      case 'synth.level':     return state.laneA.synth.level
      case 'gran.position':   return state.laneD.grain.position
      case 'gran.size':       return state.laneD.grain.size
      case 'gran.density':    return state.laneD.grain.density
      case 'gran.pitch':      return state.laneD.grain.pitch
      case 'gran.spray':      return state.laneD.grain.spray
      case 'gran.detune':     return state.laneD.grain.detune
      case 'gran.wander':     return state.laneD.grain.wander
      case 'gran.level':      return state.laneD.grain.level
      case 'delay.feedback':  return state.laneC.delay.feedback / 0.85  // normalize to 0-1
      case 'delay.time':      return state.laneC.delay.time / 2.0       // 0-2s → 0-1
      default:                return 0
    }
  }
}

export const lfoEngine = new LFOEngine()
