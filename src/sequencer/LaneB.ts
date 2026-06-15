import { MarblesT } from './MarblesT'
import { masterClock } from './MasterClock'
import { audioEngine } from '../audio/AudioEngine'
import type { KickParams, SnareParams, HatParams } from '../audio/AudioEngine'
import type { TParams } from './MarblesT'

export interface DrumVoiceConfig {
  bias: number    // 0–1 per-voice trigger probability
  dejaVu: number  // 0–1 per-voice loop probability (independent per voice)
  enabled: boolean
}

export interface LaneBParams {
  density: number // 0–1 overall density — scales all voice biases
                  // 0 = silence, 0.5 = transparent (uses per-voice bias), 1 = dense
  jitter: number  // 0–1 shared timing randomization
  length: number  // 1–32 shared loop length

  kick:  DrumVoiceConfig & KickParams
  snare: DrumVoiceConfig & SnareParams
  hat:   DrumVoiceConfig & HatParams
}

export type DrumTriggerListener = (
  voice: 'kick' | 'snare' | 'hat',
  step: number,
  scheduledAt: number,
) => void

// Lane B: three independent MarblesT trigger streams → three Plaits drum voices.
// Each voice has its own logistic map seed, bias, and dejaVu so kick/snare/hat
// loop and vary completely independently.
class LaneB {
  private kickT  = new MarblesT(0.23)
  private snareT = new MarblesT(0.51)
  private hatT   = new MarblesT(0.79)

  private unsub: (() => void) | null = null
  private listeners = new Set<DrumTriggerListener>()

  params: LaneBParams = {
    density: 0.7,
    jitter:  0.1,
    length:  16,
    kick:  { bias: 0.85, dejaVu: 0, enabled: true, tune: 36, decay: 0.5, snap: 0.6 },
    snare: { bias: 0.65, dejaVu: 0, enabled: true, snap: 0.65, tone: 0.5, body: 0.5, decay: 0.4 },
    hat:   { bias: 0.55, dejaVu: 0, enabled: true, open: 0.2, tone: 0.7 },
  }

  onTrigger(cb: DrumTriggerListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  start(): void {
    if (this.unsub) return
    this.unsub = masterClock.subscribe((t, step, dur) => this.tick(t, step, dur))
  }

  stop(): void {
    this.unsub?.()
    this.unsub = null
  }

  reset(): void {
    this.kickT.reset()
    this.snareT.reset()
    this.hatT.reset()
  }

  reseed(): void {
    this.kickT.reseed(Math.random())
    this.snareT.reseed(Math.random())
    this.hatT.reseed(Math.random())
  }

  // density=0.5 leaves per-voice bias unchanged; 0→silences all; 1→maximises all
  private effectiveBias(voiceBias: number): number {
    return Math.min(1, voiceBias * this.params.density * 2)
  }

  private tParams(voiceBias: number, voiceDejaVu: number): TParams {
    return {
      rate:   1,   // drums always at 1/16th-note resolution
      jitter: this.params.jitter,
      gate:   0.5,
      bias:   this.effectiveBias(voiceBias),
      dejaVu: voiceDejaVu,
      length: this.params.length,
    }
  }

  private tick(audioTime: number, step: number, stepDur: number): void {
    const ctx = audioEngine.audioContext
    if (!ctx) return
    const { kick, snare, hat } = this.params

    const kickEv = this.kickT.tick(audioTime, stepDur, this.tParams(kick.bias, kick.dejaVu))
    if (kickEv) {
      audioEngine.triggerKick(kick, Math.max(0, kickEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('kick', step, kickEv.time))
    }

    const snareEv = this.snareT.tick(audioTime, stepDur, this.tParams(snare.bias, snare.dejaVu))
    if (snareEv) {
      audioEngine.triggerSnare(snare, Math.max(0, snareEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('snare', step, snareEv.time))
    }

    const hatEv = this.hatT.tick(audioTime, stepDur, this.tParams(hat.bias, hat.dejaVu))
    if (hatEv) {
      audioEngine.triggerHat(hat, Math.max(0, hatEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('hat', step, hatEv.time))
    }
  }
}

export const laneB = new LaneB()
