import { LogisticMap } from './LogisticMap'
import type { TriggerEvent } from './MarblesT'

// Euclidean (Bjorklund/Bresenham) rhythm generator.
// Distributes `hits` trigger pulses as evenly as possible across `length` steps,
// then applies timing jitter and probabilistic variation (ghost/drop).
export class EuclideanDrum {
  private stepPos = 0
  private rng: LogisticMap
  private pattern: boolean[] = []
  private lastHits = -1
  private lastLength = -1

  constructor(seed: number) {
    this.rng = new LogisticMap(seed)
  }

  // Bresenham accumulator: distributes h hits over `steps` as evenly as possible.
  // E(4,16)={0,4,8,12}  E(2,16)={0,8}  E(3,8)={0,3,6}  E(5,8)={0,2,3,5,7}
  private buildPattern(hits: number, steps: number): boolean[] {
    if (steps <= 0) return []
    const h = Math.max(0, Math.min(steps, Math.round(hits)))
    if (h === 0) return new Array(steps).fill(false)
    if (h >= steps) return new Array(steps).fill(true)
    const out = new Array(steps).fill(false)
    let bucket = steps - h
    for (let i = 0; i < steps; i++) {
      bucket += h
      if (bucket >= steps) { bucket -= steps; out[i] = true }
    }
    return out
  }

  // hits     – desired trigger count in `length` steps
  // rotation – 0–1 fraction → shifts which step index the pattern starts on
  //            (e.g. 0.25 in 16 steps = 4-step offset, moves snare to beats 2 & 4)
  // variation – 0 = strict Euclidean, 1 = occasional ghosts / dropped hits
  tick(
    audioTime: number,
    stepDur: number,
    hits: number,
    length: number,
    jitter: number,
    variation: number,
    rotation: number,
  ): TriggerEvent | null {
    const len = Math.max(1, length)
    if (hits !== this.lastHits || len !== this.lastLength) {
      this.pattern = this.buildPattern(hits, len)
      this.lastHits = hits
      this.lastLength = len
    }

    const rotOffset = Math.round(rotation * len) % len
    const pos       = (this.stepPos + rotOffset) % len
    const isHit     = this.pattern[pos] ?? false
    this.stepPos    = (this.stepPos + 1) % len

    let fires: boolean
    if (isHit) {
      fires = this.rng.next() >= variation * 0.45  // drop up to 45 % of hits at max variation
    } else {
      fires = this.rng.next() < variation * 0.12   // ghost hits up to 12 % probability
    }

    if (!fires) return null

    const jitterRange = stepDur * jitter * 0.4
    const offset = (this.rng.next() - 0.5) * jitterRange
    return {
      time: Math.max(audioTime, audioTime + offset),
      gateLength: stepDur * 0.5,
    }
  }

  reset(): void { this.stepPos = 0 }
  reseed(seed: number): void { this.rng.seed(seed) }
}
