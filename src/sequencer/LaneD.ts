import { MarblesT } from './MarblesT'
import { masterClock } from './MasterClock'
import { audioEngine } from '../audio/AudioEngine'
import type { TParams } from './MarblesT'

export type GranTriggerListener = (step: number, scheduledAt: number) => void

class LaneD {
  readonly t = new MarblesT(0.47)

  params: { t: TParams } = {
    t: { rate: 3, jitter: 0.2, gate: 0.5, bias: 0.5, dejaVu: 0.3, length: 16 },
  }

  private unsub: (() => void) | null = null
  private listeners = new Set<GranTriggerListener>()

  onTrigger(cb: GranTriggerListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  start(): void {
    if (this.unsub) return
    this.unsub = masterClock.subscribe((audioTime, step, stepDur) => this.tick(audioTime, step, stepDur))
  }

  stop(): void { this.unsub?.(); this.unsub = null }
  reset(): void { this.t.reset() }
  reseed(): void { this.t.reseed(Math.random()) }

  private tick(audioTime: number, step: number, stepDur: number): void {
    const event = this.t.tick(audioTime, stepDur, this.params.t)
    if (!event) return
    const ctx = audioEngine.audioContext
    if (!ctx) return
    const when = Math.max(0, event.time - ctx.currentTime)
    audioEngine.triggerGranular(when)
    this.listeners.forEach(cb => cb(step, event.time))
  }
}

export const laneD = new LaneD()
