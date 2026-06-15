import { LogisticMap } from './LogisticMap'
import { quantize } from './scales'
import type { ScaleMode, RootNote } from './scales'

export interface XParams {
  spread: number    // 0–1 → pitch range (0–3 octaves)
  bias: number      // 0–1 → distribution center (0=low, 1=high)
  steps: number     // 1–8 discrete pitch levels
  dejaVu: number    // 0–1 loop probability — INDEPENDENT from t.dejaVu
  length: number    // loop length in steps (usually same as t.length)
  root: RootNote
  mode: ScaleMode
}

// Marbles x-section: random voltage generator with independent deja_vu loop.
// Called once per t-trigger to produce the next pitch.
export class MarblesX {
  private rng: LogisticMap
  private loopBuffer: number[]   // stores raw voltages [0,1]
  private loopPos = 0

  constructor(seed = 0.3) {
    this.rng = new LogisticMap(seed)
    this.loopBuffer = new Array(32).fill(0.5)
  }

  // Returns a MIDI note for this trigger.
  next(p: XParams): number {
    const pos = this.loopPos % Math.max(1, p.length)

    const replayFromLoop = this.rng.next() < p.dejaVu
    let voltage: number
    if (replayFromLoop) {
      voltage = this.loopBuffer[pos]
    } else {
      voltage = this.rng.next()
      this.loopBuffer[pos] = voltage
    }

    this.loopPos = (this.loopPos + 1) % Math.max(1, p.length)

    return quantize(voltage, p.root, p.mode, p.spread, p.bias, p.steps)
  }

  // Return the last N stored voltages for UI visualization.
  getVoltages(n: number): number[] {
    const result: number[] = []
    for (let i = 0; i < n; i++) {
      const pos = (this.loopPos - n + i + this.loopBuffer.length) % this.loopBuffer.length
      result.push(this.loopBuffer[pos])
    }
    return result
  }

  reset(): void {
    this.loopPos = 0
  }

  reseed(seed: number): void {
    this.rng.seed(seed)
  }
}
