import { EuclideanDrum } from './EuclideanDrum'
import { masterClock } from './MasterClock'
import { audioEngine } from '../audio/AudioEngine'
import type { KickParams, SnareParams, HatParams } from '../audio/AudioEngine'

export interface DrumVoiceConfig {
  bias: number      // 0–1 Euclidean fill density (fraction of loop steps that trigger)
  dejaVu: number    // 0–1 variation: 0 = strict Euclidean, higher adds ghost/drop probability
  rotation: number  // 0–1 pattern rotation (e.g. 0.25 offsets snare to beats 2 & 4)
  enabled: boolean
}

export interface LaneBParams {
  density: number   // 0–1 global hit-count scaler (0=silence, 0.5=neutral, 1=double)
  jitter: number    // 0–1 shared timing humanization
  length: number    // 1–32 shared loop length in 16th-note steps

  kick:  DrumVoiceConfig & KickParams
  snare: DrumVoiceConfig & SnareParams
  hat:   DrumVoiceConfig & HatParams
}

export type DrumTriggerListener = (
  voice: 'kick' | 'snare' | 'hat',
  step: number,
  scheduledAt: number,
) => void

class LaneB {
  private kickDrum  = new EuclideanDrum(0.23)
  private snareDrum = new EuclideanDrum(0.51)
  private hatDrum   = new EuclideanDrum(0.79)

  private unsub: (() => void) | null = null
  private listeners = new Set<DrumTriggerListener>()

  params: LaneBParams = {
    density: 0.5,
    jitter:  0.08,
    length:  16,
    kick:  { bias: 0.25, dejaVu: 0, rotation: 0,    enabled: true, tune: 36, decay: 0.5, snap: 0.6 },
    snare: { bias: 0.125, dejaVu: 0, rotation: 0.25, enabled: true, snap: 0.65, tone: 0.5, body: 0.5, decay: 0.4 },
    hat:   { bias: 0.5,  dejaVu: 0, rotation: 0,    enabled: true, open: 0.2, tone: 0.7 },
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
    this.kickDrum.reset()
    this.snareDrum.reset()
    this.hatDrum.reset()
  }

  reseed(): void {
    this.kickDrum.reseed(Math.random())
    this.snareDrum.reseed(Math.random())
    this.hatDrum.reseed(Math.random())
  }

  // density 0.5 = neutral (use per-voice bias directly); 0 = silence; 1 = doubled hits.
  // Formula mirrors the original effectiveBias so density knob feels the same.
  private effectiveHits(voiceBias: number): number {
    const fill = Math.min(1, voiceBias * this.params.density * 2)
    return Math.round(fill * this.params.length)
  }

  private tick(audioTime: number, step: number, stepDur: number): void {
    const ctx = audioEngine.audioContext
    if (!ctx) return
    const { kick, snare, hat, jitter, length } = this.params

    const kickEv = this.kickDrum.tick(
      audioTime, stepDur,
      this.effectiveHits(kick.bias), length,
      jitter, kick.dejaVu, kick.rotation,
    )
    if (kickEv) {
      audioEngine.triggerKick(kick, Math.max(0, kickEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('kick', step, kickEv.time))
    }

    const snareEv = this.snareDrum.tick(
      audioTime, stepDur,
      this.effectiveHits(snare.bias), length,
      jitter, snare.dejaVu, snare.rotation,
    )
    if (snareEv) {
      audioEngine.triggerSnare(snare, Math.max(0, snareEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('snare', step, snareEv.time))
    }

    const hatEv = this.hatDrum.tick(
      audioTime, stepDur,
      this.effectiveHits(hat.bias), length,
      jitter, hat.dejaVu, hat.rotation,
    )
    if (hatEv) {
      audioEngine.triggerHat(hat, Math.max(0, hatEv.time - ctx.currentTime))
      this.listeners.forEach(cb => cb('hat', step, hatEv.time))
    }
  }
}

export const laneB = new LaneB()
