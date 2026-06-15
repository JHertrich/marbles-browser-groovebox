import { LogisticMap } from './LogisticMap'

export interface TParams {
  rate: number      // 1–8  clock divider (÷N master ticks per step)
  jitter: number    // 0–1  timing randomization
  gate: number      // 0–1  gate length as fraction of step duration
  bias: number      // 0–1  trigger probability when generating fresh
  dejaVu: number    // 0–1  loop probability (0=always fresh, 1=always loop)
  length: number    // 1–32 loop length in steps
}

export interface TriggerEvent {
  time: number        // absolute AudioContext timestamp
  gateLength: number  // seconds
}

// Marbles t-section: Bernoulli trigger generator with deja_vu loop memory.
//
// Each Marbles step (every `rate` master ticks):
//   - roll RNG to decide whether to replay the loop or generate fresh
//   - if fresh: roll again against `bias` to decide whether a trigger fires
//   - if replaying: use the stored boolean from the loop buffer
//   - always write the result back into the loop buffer (loop evolves when dejaVu < 1)
export class MarblesT {
  private rng: LogisticMap
  private loopBuffer: boolean[]
  private loopPos = 0
  private tickCount = 0

  constructor(seed = 0.7) {
    this.rng = new LogisticMap(seed)
    this.loopBuffer = new Array(32).fill(false)
  }

  // Call on every master clock tick. Returns a TriggerEvent when this step fires.
  tick(masterTime: number, masterStepDuration: number, p: TParams): TriggerEvent | null {
    if (++this.tickCount < p.rate) return null
    this.tickCount = 0

    const stepDuration = masterStepDuration * p.rate
    const pos = this.loopPos % Math.max(1, p.length)

    const replayFromLoop = this.rng.next() < p.dejaVu
    let fires: boolean
    if (replayFromLoop) {
      fires = this.loopBuffer[pos]
    } else {
      fires = this.rng.next() < p.bias
      this.loopBuffer[pos] = fires
    }

    this.loopPos = (this.loopPos + 1) % Math.max(1, p.length)

    if (!fires) return null

    const jitterRange = stepDuration * p.jitter * 0.4
    const jitterOffset = (this.rng.next() - 0.5) * jitterRange
    const time = Math.max(masterTime, masterTime + jitterOffset)

    return { time, gateLength: stepDuration * Math.max(0.05, p.gate) }
  }

  reset(): void {
    this.loopPos = 0
    this.tickCount = 0
  }

  reseed(seed: number): void {
    this.rng.seed(seed)
  }
}
