export const SCALE_MODES = {
  Ionian:        [0, 2, 4, 5, 7, 9, 11],
  Dorian:        [0, 2, 3, 5, 7, 9, 10],
  Phrygian:      [0, 1, 3, 5, 7, 8, 10],
  Lydian:        [0, 2, 4, 6, 7, 9, 11],
  Mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  Aeolian:       [0, 2, 3, 5, 7, 8, 10],
  Locrian:       [0, 1, 3, 5, 6, 8, 10],
  'Pent. Minor': [0, 3, 5, 7, 10],
  'Pent. Major': [0, 2, 4, 7, 9],
  Chromatic:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const

export type ScaleMode = keyof typeof SCALE_MODES
export const SCALE_MODE_NAMES = Object.keys(SCALE_MODES) as ScaleMode[]

export const ROOT_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const
export type RootNote = typeof ROOT_NOTES[number]

const ROOT_SEMITONE: Record<RootNote, number> = {
  C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11,
}

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

// Build every MIDI note in [loMidi, hiMidi] that belongs to the scale.
function buildNoteSet(root: RootNote, mode: ScaleMode, lo: number, hi: number): number[] {
  const intervals = SCALE_MODES[mode] as readonly number[]
  const rs = ROOT_SEMITONE[root]
  const notes: number[] = []
  for (let m = lo; m <= hi; m++) {
    if (intervals.includes(((m - rs) % 12 + 12) % 12)) notes.push(m)
  }
  return notes
}

// Map a random voltage [0,1] to a MIDI note according to the scale parameters.
// spread : 0–1 → pitch range in octaves (0 to 3)
// bias   : 0–1 → center shift (0 = low, 0.5 = center, 1 = high)
// steps  : 1–8 → number of discrete pitch levels
export function quantize(
  voltage: number,
  root: RootNote,
  mode: ScaleMode,
  spread: number,
  bias: number,
  steps: number,
): number {
  const centerMidi = 60 + (bias - 0.5) * 24   // range: 48–72
  const semitoneRange = Math.max(12, Math.round(spread * 3 * 12))
  const lo = Math.max(24, Math.round(centerMidi - semitoneRange / 2))
  const hi = Math.min(96, Math.round(centerMidi + semitoneRange / 2))

  const notes = buildNoteSet(root, mode, lo, hi)
  if (notes.length === 0) return 60

  // Discretize to `steps` levels before mapping to notes
  const clamped = Math.max(0, Math.min(1, voltage))
  const steppedV = steps > 1
    ? Math.round(clamped * (steps - 1)) / (steps - 1)
    : clamped

  const idx = Math.min(Math.floor(steppedV * notes.length), notes.length - 1)
  return notes[Math.max(0, idx)]
}
