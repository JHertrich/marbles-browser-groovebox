// TypeScript interface for an AudioWorkletNode returned by wosc.createOscillator().
// Property setters call setValueAtTime on the underlying AudioParam.
// ${name}AudioParameter returns the raw AudioParam for scheduling (linearRampToValueAtTime, etc).
export interface WoscNode {
  // Pitch / synthesis
  engine: number                         // 0–15
  note: number                           // 0–127 MIDI
  harmonics: number                      // 0–1
  timbre: number                         // 0–1
  morph: number                          // 0–1
  frequencyModulationAmount: number      // 0–10
  fade: number                           // 0–1 (aux crossfade)
  decay: number                          // 0–1 (LPG decay)
  volume: number                         // 0–1

  // Trigger / level modulation
  modTrigger: number
  modTriggerPatched: number
  modLevel: number
  modLevelPatched: number

  // Raw AudioParam accessors for scheduling
  engineAudioParameter: AudioParam
  noteAudioParameter: AudioParam
  harmonicsAudioParameter: AudioParam
  timbreAudioParameter: AudioParam
  morphAudioParameter: AudioParam
  decayAudioParameter: AudioParam
  volumeAudioParameter: AudioParam
  modTriggerAudioParameter: AudioParam
  modTriggerPatchedAudioParameter: AudioParam
  frequencyModulationAmountAudioParameter: AudioParam

  // AudioWorkletNode methods
  connect(destination: AudioNode | AudioParam): void
  disconnect(): void
  start(): void
  stop(): void
  dispose(): void
}

export interface SynthParams {
  engine: number      // 0–6 (melodic engines only)
  timbre: number      // 0–1
  morph: number       // 0–1
  harmonics: number   // 0–1
  decay: number       // 0–1 (LPG decay)
  level: number       // 0–1
}

export interface KickParams {
  tune: number        // MIDI note (root pitch)
  decay: number       // 0–1
  snap: number        // 0–1 (timbre = attack FM transient amount)
}

export interface SnareParams {
  snap:  number  // 0–1 → timbre: noise/body balance (0=body only, 1=noise only)
  tone:  number  // 0–1 → harmonics: frequency / color of the body+noise
  body:  number  // 0–1 → morph: body resonance (0=rimshot-dry, 1=resonant ring)
  decay: number  // 0–1
}

export interface HatParams {
  open: number        // 0–1 (decay length — closed↔open)
  tone: number        // 0–1 (timbre: filter cutoff)
}

// Plaits engine index → display name
export const PLAITS_ENGINE_NAMES: Record<number, string> = {
  0: 'VA Osc',
  1: 'Waveshape',
  2: 'FM',
  3: 'Grain',
  4: 'Additive',
  5: 'Wavetable',
  6: 'Chord',
  7: 'Speech',
  8: 'Swarm',
  9: 'Noise',
  10: 'Particle',
  11: 'String',
  12: 'Modal',
  13: 'Bass drum',
  14: 'Snare drum',
  15: 'Hi-hat',
}

export const SYNTH_ENGINES = [0, 1, 2, 4, 6] as const  // melodic subset shown in UI

export interface GranularParams {
  position:       number   // 0–1: center read position (0 = most recent, 1 = oldest in 4 s buffer)
  size:           number   // 0–1 → 20 ms – 400 ms grain duration
  density:        number   // trig: 1–12 grains per trigger  |  cont: 1–16 grains/sec (exponential)
  pitch:          number   // 0–1 → −2 oct (0) to +2 oct (1), unity at 0.5
  spray:          number   // 0–1: random position scatter up to ±0.5 s
  detune:         number   // 0–1: random pitch variation per grain, ±2 semitones max
  width:          number   // 0–1: stereo spread
  level:          number   // 0–1
  wander:         number   // 0–1: slow random-walk drift of position over time
  continuousMode: boolean  // false = triggered by Marbles, true = self-clocked
}
