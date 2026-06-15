import { MarblesT } from './MarblesT'
import { MarblesX } from './MarblesX'
import { masterClock } from './MasterClock'
import { audioEngine } from '../audio/AudioEngine'
import type { TParams } from './MarblesT'
import type { XParams } from './MarblesX'
import type { SynthParams } from '../audio/AudioEngine'

export interface LaneAParams {
  t: TParams
  x: XParams
  synth: SynthParams
}

// Called on the main thread each time a trigger fires (scheduled slightly ahead).
// Use to update UI: schedule a setTimeout to fire when the note actually plays.
export type TriggerListener = (step: number, midiNote: number, scheduledAt: number) => void

class LaneA {
  readonly t = new MarblesT(0.7)
  readonly x = new MarblesX(0.3)

  // Mutable params — React reads/writes these directly. The clock reads on each tick.
  params: LaneAParams = {
    t: { rate: 2, jitter: 0.15, gate: 0.5, bias: 0.65, dejaVu: 0, length: 16 },
    x: { spread: 0.5, bias: 0.5, steps: 8, dejaVu: 0, length: 16, root: 'C', mode: 'Dorian' },
    synth: { engine: 2, timbre: 0.5, morph: 0.3, harmonics: 0.7, decay: 0.6, level: 0.8 },
  }

  private unsub: (() => void) | null = null
  private listeners = new Set<TriggerListener>()

  onTrigger(cb: TriggerListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  start(): void {
    if (this.unsub) return
    this.unsub = masterClock.subscribe((audioTime, step, stepDur) => {
      this.tick(audioTime, step, stepDur)
    })
  }

  stop(): void {
    this.unsub?.()
    this.unsub = null
  }

  reset(): void {
    this.t.reset()
    this.x.reset()
  }

  reseed(): void {
    this.t.reseed(Math.random())
    this.x.reseed(Math.random())
  }

  private tick(audioTime: number, step: number, stepDur: number): void {
    const event = this.t.tick(audioTime, stepDur, this.params.t)
    if (!event) return

    const midiNote = this.x.next(this.params.x)
    const ctx = audioEngine.audioContext
    if (!ctx) return

    const when = Math.max(0, event.time - ctx.currentTime)
    audioEngine.triggerSynth(midiNote, this.params.synth, when)

    this.listeners.forEach(cb => cb(step, midiNote, event.time))
  }
}

export const laneA = new LaneA()
