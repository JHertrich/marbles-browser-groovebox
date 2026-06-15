// Logistic map: x_{n+1} = r * x_n * (1 - x_n)
// r ≈ 3.9999 keeps the system in the chaotic regime, producing values in (0, 1)
// that are deterministic yet sensitively dependent on the seed.
export class LogisticMap {
  private x: number

  constructor(seed = 0.5) {
    this.x = Math.max(0.001, Math.min(0.999, seed))
  }

  next(): number {
    this.x = 3.9999 * this.x * (1 - this.x)
    return this.x
  }

  seed(value: number): void {
    this.x = Math.max(0.001, Math.min(0.999, value))
  }

  getState(): number {
    return this.x
  }
}
