import { wosc } from '@vectorsize/woscillators'
import type {
  WoscNode,
  SynthParams,
  KickParams,
  SnareParams,
  HatParams,
} from './types'

export type { SynthParams, KickParams, SnareParams, HatParams }

// Delay BPM-sync divisions expressed as quarter-note multiples
const SYNC_DIV_BEATS: Record<string, number> = {
  '1/8': 0.5, '3/16': 0.75, '1/4': 1, '3/8': 1.5, '1/2': 2,
}

// Map tone knob (0–1) to filter frequency (300 Hz – 18 kHz, log scale)
function toneToHz(t: number): number { return 300 * Math.pow(60, t) }

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

  // ── Send gains (4 voices × 2 effects) ──────────────────────────────────────
  private synthDelaySend: GainNode | null = null
  private kickDelaySend: GainNode | null = null
  private snareDelaySend: GainNode | null = null
  private hatDelaySend: GainNode | null = null
  private synthReverbSend: GainNode | null = null
  private kickReverbSend: GainNode | null = null
  private snareReverbSend: GainNode | null = null
  private hatReverbSend: GainNode | null = null

  // ── Delay chain ─────────────────────────────────────────────────────────────
  private delayInput: GainNode | null = null
  private delayNode: DelayNode | null = null
  private delayFilter: BiquadFilterNode | null = null
  private delayFeedback: GainNode | null = null
  private delayReturn: GainNode | null = null

  // ── Reverb chain ────────────────────────────────────────────────────────────
  private reverbPreDelay: DelayNode | null = null
  private reverbConvolver: ConvolverNode | null = null
  private reverbFilter: BiquadFilterNode | null = null
  private reverbReturn: GainNode | null = null

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

    // ── Build delay chain ───────────────────────────────────────────────────
    this.delayInput    = this.ctx.createGain()
    this.delayNode     = this.ctx.createDelay(2.0)
    this.delayNode.delayTime.value = 0.375
    this.delayFilter   = this.ctx.createBiquadFilter()
    this.delayFilter.type = 'lowpass'
    this.delayFilter.frequency.value = toneToHz(0.7)
    this.delayFeedback = this.ctx.createGain()
    this.delayFeedback.gain.value = 0.4
    this.delayReturn   = this.ctx.createGain()
    this.delayReturn.gain.value = 0.6

    this.delayInput.connect(this.delayNode)
    this.delayNode.connect(this.delayFilter)
    this.delayFilter.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delayNode)   // feedback loop
    this.delayFilter.connect(this.delayReturn)
    this.delayReturn.connect(this.masterGain)

    // ── Build reverb chain ──────────────────────────────────────────────────
    this.reverbPreDelay  = this.ctx.createDelay(0.1)
    this.reverbPreDelay.delayTime.value = 0.02
    this.reverbConvolver = this.ctx.createConvolver()
    this.reverbConvolver.buffer = this.generateIR(this.ctx, 0.6, 0.5)
    this.reverbFilter    = this.ctx.createBiquadFilter()
    this.reverbFilter.type = 'lowpass'
    this.reverbFilter.frequency.value = toneToHz(0.6)
    this.reverbReturn    = this.ctx.createGain()
    this.reverbReturn.gain.value = 0.5

    this.reverbPreDelay.connect(this.reverbConvolver)
    this.reverbConvolver.connect(this.reverbFilter)
    this.reverbFilter.connect(this.reverbReturn)
    this.reverbReturn.connect(this.masterGain)

    // ── Voices ──────────────────────────────────────────────────────────────

    // Synth: voice → analyser → master (dry)
    //              → synthDelaySend → delayInput
    //              → synthReverbSend → reverbPreDelay
    this.synthAnalyser = this.ctx.createAnalyser()
    this.synthAnalyser.fftSize = 2048
    this.synthAnalyser.connect(this.masterGain)

    this.synthDelaySend  = this.ctx.createGain(); this.synthDelaySend.gain.value = 0.25
    this.synthReverbSend = this.ctx.createGain(); this.synthReverbSend.gain.value = 0.35
    this.synthAnalyser.connect(this.synthDelaySend);  this.synthDelaySend.connect(this.delayInput)
    this.synthAnalyser.connect(this.synthReverbSend); this.synthReverbSend.connect(this.reverbPreDelay)

    this.synthVoice = wosc.createOscillator() as WoscNode
    this.synthVoice.engine = 2
    this.synthVoice.modTriggerPatched = 1
    this.synthVoice.volume = 0.8
    this.synthVoice.connect(this.synthAnalyser)
    this.synthVoice.start()

    // Kick
    this.kickAnalyser = this.ctx.createAnalyser()
    this.kickAnalyser.fftSize = 256
    this.kickAnalyser.connect(this.masterGain)

    this.kickDelaySend  = this.ctx.createGain(); this.kickDelaySend.gain.value = 0.05
    this.kickReverbSend = this.ctx.createGain(); this.kickReverbSend.gain.value = 0.15
    this.kickAnalyser.connect(this.kickDelaySend);  this.kickDelaySend.connect(this.delayInput)
    this.kickAnalyser.connect(this.kickReverbSend); this.kickReverbSend.connect(this.reverbPreDelay)

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

    this.snareDelaySend  = this.ctx.createGain(); this.snareDelaySend.gain.value = 0.15
    this.snareReverbSend = this.ctx.createGain(); this.snareReverbSend.gain.value = 0.25
    this.snareAnalyser.connect(this.snareDelaySend);  this.snareDelaySend.connect(this.delayInput)
    this.snareAnalyser.connect(this.snareReverbSend); this.snareReverbSend.connect(this.reverbPreDelay)

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

    this.hatDelaySend  = this.ctx.createGain(); this.hatDelaySend.gain.value = 0.03
    this.hatReverbSend = this.ctx.createGain(); this.hatReverbSend.gain.value = 0.08
    this.hatAnalyser.connect(this.hatDelaySend);  this.hatDelaySend.connect(this.delayInput)
    this.hatAnalyser.connect(this.hatReverbSend); this.hatReverbSend.connect(this.reverbPreDelay)

    this.hatVoice = wosc.createOscillator() as WoscNode
    this.hatVoice.engine = 15
    this.hatVoice.modTriggerPatched = 1
    this.hatVoice.volume = 0.6
    this.hatVoice.connect(this.hatAnalyser)
    this.hatVoice.start()

    this._initialized = true
  }

  // Generates a synthetic reverb impulse response (exponentially decaying stereo noise).
  private generateIR(ctx: AudioContext, size: number, decay: number): AudioBuffer {
    const duration = 0.5 + size * 5.5
    const sampleRate = ctx.sampleRate
    const length = Math.ceil(duration * sampleRate)
    const ir = ctx.createBuffer(2, length, sampleRate)
    // RT60 = fraction of duration determined by decay knob
    const rt60 = Math.max(0.1, duration * (0.1 + decay * 0.9))
    const k = Math.log(1000) / rt60

    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        data[i] = (Math.random() * 2 - 1) * Math.exp(-k * t)
      }
    }
    return ir
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

  // ─── Lane C: Effects ──────────────────────────────────────────────────────

  setDelayParams(time: number, feedback: number, tone: number, returnLevel: number): void {
    if (!this.ctx || !this.delayNode || !this.delayFilter || !this.delayFeedback || !this.delayReturn) return
    const t = this.ctx.currentTime + 0.016
    this.delayNode.delayTime.linearRampToValueAtTime(Math.min(time, 1.999), t)
    // Hard cap at 0.90 — values above this cause runaway self-oscillation
    this.delayFeedback.gain.linearRampToValueAtTime(Math.min(feedback, 0.90), t)
    this.delayFilter.frequency.linearRampToValueAtTime(toneToHz(tone), t)
    this.delayReturn.gain.linearRampToValueAtTime(returnLevel, t)
  }

  setDelayTimeFromBpm(bpm: number, syncDiv: string): void {
    if (!this.ctx || !this.delayNode) return
    const beats = SYNC_DIV_BEATS[syncDiv] ?? 1
    const time = Math.min((60 / bpm) * beats, 1.999)
    this.delayNode.delayTime.linearRampToValueAtTime(time, this.ctx.currentTime + 0.016)
  }

  setReverbParams(size: number, decay: number, tone: number, preDelay: number, returnLevel: number): void {
    if (!this.ctx || !this.reverbConvolver || !this.reverbPreDelay || !this.reverbFilter || !this.reverbReturn) return
    const t = this.ctx.currentTime + 0.016
    this.reverbConvolver.buffer = this.generateIR(this.ctx, size, decay)
    this.reverbPreDelay.delayTime.linearRampToValueAtTime(Math.min(preDelay, 0.099), t)
    this.reverbFilter.frequency.linearRampToValueAtTime(toneToHz(tone), t)
    this.reverbReturn.gain.linearRampToValueAtTime(returnLevel, t)
  }

  setSendLevel(voice: 'synth' | 'kick' | 'snare' | 'hat', effect: 'delay' | 'reverb', level: number): void {
    if (!this.ctx) return
    const map = {
      synth: { delay: this.synthDelaySend, reverb: this.synthReverbSend },
      kick:  { delay: this.kickDelaySend,  reverb: this.kickReverbSend  },
      snare: { delay: this.snareDelaySend, reverb: this.snareReverbSend },
      hat:   { delay: this.hatDelaySend,   reverb: this.hatReverbSend   },
    }
    const node = map[voice][effect]
    if (node) node.gain.linearRampToValueAtTime(level, this.ctx.currentTime + 0.016)
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
