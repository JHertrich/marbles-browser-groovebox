// Master clock: AudioContext.currentTime-based lookahead scheduler.
// Fires callbacks at precisely scheduled audio timestamps, not wall-clock time.
//
// Lookahead window: 100 ms  — events scheduled this far ahead
// Scheduler interval: 25 ms — how often the pump runs via setTimeout

export type TickCallback = (
  audioTime: number,       // absolute AudioContext time for this tick
  step: number,            // monotonically increasing step counter
  stepDuration: number,    // seconds per master tick (1/16th note)
) => void

const LOOKAHEAD = 0.1    // seconds
const INTERVAL = 25      // milliseconds

class MasterClock {
  bpm = 120

  private ctx: AudioContext | null = null
  private nextTickTime = 0
  private step = 0
  private timerId: ReturnType<typeof setTimeout> | null = null
  private callbacks = new Set<TickCallback>()

  get isRunning(): boolean { return this.timerId !== null }

  // 1/16th note duration in seconds at current BPM
  get stepDuration(): number { return (60 / this.bpm) / 4 }

  subscribe(cb: TickCallback): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  start(ctx: AudioContext): void {
    if (this.timerId !== null) return
    this.ctx = ctx
    this.nextTickTime = ctx.currentTime + 0.05
    this.step = 0
    this.pump()
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  reset(): void {
    this.stop()
    this.step = 0
  }

  private pump(): void {
    const ctx = this.ctx
    if (!ctx) return

    const dur = this.stepDuration
    const horizon = ctx.currentTime + LOOKAHEAD

    while (this.nextTickTime < horizon) {
      const t = this.nextTickTime
      const s = this.step
      this.callbacks.forEach(cb => cb(t, s, dur))
      this.nextTickTime += dur
      this.step++
    }

    this.timerId = setTimeout(() => this.pump(), INTERVAL)
  }
}

export const masterClock = new MasterClock()
