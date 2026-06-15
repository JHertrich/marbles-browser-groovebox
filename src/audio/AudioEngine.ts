import { wosc } from '@vectorsize/woscillators'
import type {
  WoscNode,
  SynthParams,
  KickParams,
  SnareParams,
  HatParams,
} from './types'

export type { SynthParams, KickParams, SnareParams, HatParams }

class AudioEngine {
  private ctx: AudioContext | null = null
  private synthVoice: WoscNode | null = null
  private kickVoice: WoscNode | null = null
  private snareVoice: WoscNode | null = null
  private hatVoice: WoscNode | null = null

  private masterGain: GainNode | null = null
  private synthAnalyser: AnalyserNode | null = null
  private kickAnalyser: AnalyserNode | null = null
  private snareAnalyser: AnalyserNode | null = null
  private hatAnalyser: AnalyserNode | null = null

  private _initialized = false

  get isInitialized() { return this._initialized }
  get audioContext() { return this.ctx }
  get synthAnalyserNode() { return this.synthAnalyser }
  get kickAnalyserNode() { return this.kickAnalyser }
  get snareAnalyserNode() { return this.snareAnalyser }
  get hatAnalyserNode() { return this.hatAnalyser }

  async init(): Promise<void> {
    if (this._initialized) {
      await this.ctx?.resume()
      return
    }

    this.ctx = new AudioContext()
    await wosc.loadOscillator(this.ctx)

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.8
    this.masterGain.connect(this.ctx.destination)

    // Synth: analyser → master (oscilloscope reads from synthAnalyser)
    this.synthAnalyser = this.ctx.createAnalyser()
    this.synthAnalyser.fftSize = 2048
    this.synthAnalyser.connect(this.masterGain)

    this.synthVoice = wosc.createOscillator() as WoscNode
    this.synthVoice.engine = 2        // FM default
    this.synthVoice.modTriggerPatched = 1
    this.synthVoice.volume = 0.8
    this.synthVoice.connect(this.synthAnalyser)
    this.synthVoice.start()

    // Kick
    this.kickAnalyser = this.ctx.createAnalyser()
    this.kickAnalyser.fftSize = 256
    this.kickAnalyser.connect(this.masterGain)

    this.kickVoice = wosc.createOscillator() as WoscNode
    this.kickVoice.engine = 13
    this.kickVoice.modTriggerPatched = 1
    this.kickVoice.volume = 0.9
    this.kickVoice.connect(this.kickAnalyser)
    this.kickVoice.start()

    // Snare
    this.snareAnalyser = this.ctx.createAnalyser()
    this.snareAnalyser.fftSize = 256
    this.snareAnalyser.connect(this.masterGain)

    this.snareVoice = wosc.createOscillator() as WoscNode
    this.snareVoice.engine = 14
    this.snareVoice.modTriggerPatched = 1
    this.snareVoice.volume = 0.8
    this.snareVoice.connect(this.snareAnalyser)
    this.snareVoice.start()

    // Hat
    this.hatAnalyser = this.ctx.createAnalyser()
    this.hatAnalyser.fftSize = 256
    this.hatAnalyser.connect(this.masterGain)

    this.hatVoice = wosc.createOscillator() as WoscNode
    this.hatVoice.engine = 15
    this.hatVoice.modTriggerPatched = 1
    this.hatVoice.volume = 0.6
    this.hatVoice.connect(this.hatAnalyser)
    this.hatVoice.start()

    this._initialized = true
  }

  // Send a 10 ms trigger pulse at the given AudioContext time offset.
  // Does NOT call cancelScheduledValues — multiple pulses can be queued safely.
  private fireTrigger(voice: WoscNode, when = 0): void {
    if (!this.ctx) return
    const p = voice.modTriggerAudioParameter
    const t = this.ctx.currentTime + when
    p.setValueAtTime(1, t)
    p.setValueAtTime(0, t + 0.01)
  }

  // ─── Synth ────────────────────────────────────────────────────────────────

  triggerSynth(midiNote: number, params: SynthParams, when = 0): void {
    if (!this.synthVoice || !this.ctx) return
    const t = this.ctx.currentTime + when + 0.016  // one frame ramp

    this.synthVoice.note = midiNote
    this.synthVoice.engine = params.engine

    this.synthVoice.timbreAudioParameter.linearRampToValueAtTime(params.timbre, t)
    this.synthVoice.morphAudioParameter.linearRampToValueAtTime(params.morph, t)
    this.synthVoice.harmonicsAudioParameter.linearRampToValueAtTime(params.harmonics, t)
    this.synthVoice.decayAudioParameter.linearRampToValueAtTime(params.decay, t)
    this.synthVoice.volumeAudioParameter.linearRampToValueAtTime(params.level, t)

    this.fireTrigger(this.synthVoice, when)
  }

  setSynthParams(params: SynthParams): void {
    if (!this.synthVoice || !this.ctx) return
    const t = this.ctx.currentTime + 0.016
    this.synthVoice.engine = params.engine
    this.synthVoice.timbreAudioParameter.linearRampToValueAtTime(params.timbre, t)
    this.synthVoice.morphAudioParameter.linearRampToValueAtTime(params.morph, t)
    this.synthVoice.harmonicsAudioParameter.linearRampToValueAtTime(params.harmonics, t)
    this.synthVoice.decayAudioParameter.linearRampToValueAtTime(params.decay, t)
    this.synthVoice.volumeAudioParameter.linearRampToValueAtTime(params.level, t)
  }

  // ─── Drums ────────────────────────────────────────────────────────────────

  triggerKick(params: KickParams, when = 0): void {
    if (!this.kickVoice || !this.ctx) return
    const t = this.ctx.currentTime + when + 0.016
    this.kickVoice.note = params.tune
    this.kickVoice.timbreAudioParameter.linearRampToValueAtTime(params.snap, t)
    this.kickVoice.decayAudioParameter.linearRampToValueAtTime(params.decay, t)
    this.fireTrigger(this.kickVoice, when)
  }

  triggerSnare(params: SnareParams, when = 0): void {
    if (!this.snareVoice || !this.ctx) return
    const t = this.ctx.currentTime + when + 0.016
    this.snareVoice.morphAudioParameter.linearRampToValueAtTime(params.snap, t)
    this.snareVoice.harmonicsAudioParameter.linearRampToValueAtTime(params.tone, t)
    this.snareVoice.decayAudioParameter.linearRampToValueAtTime(params.decay, t)
    this.fireTrigger(this.snareVoice, when)
  }

  triggerHat(params: HatParams, when = 0): void {
    if (!this.hatVoice || !this.ctx) return
    const t = this.ctx.currentTime + when + 0.016
    this.hatVoice.decayAudioParameter.linearRampToValueAtTime(params.open, t)
    this.hatVoice.timbreAudioParameter.linearRampToValueAtTime(params.tone, t)
    this.fireTrigger(this.hatVoice, when)
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  resume(): void { this.ctx?.resume() }
  suspend(): void { this.ctx?.suspend() }

  dispose(): void {
    this.synthVoice?.dispose()
    this.kickVoice?.dispose()
    this.snareVoice?.dispose()
    this.hatVoice?.dispose()
    wosc.teardown()
    this.ctx?.close()
    this.ctx = null
    this._initialized = false
  }
}

export const audioEngine = new AudioEngine()
