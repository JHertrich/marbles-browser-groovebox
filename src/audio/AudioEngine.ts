import { wosc } from '@vectorsize/woscillators'
import type {
  WoscNode,
  SynthParams,
  KickParams,
  SnareParams,
  HatParams,
  GranularParams,
  ModDest,
} from './types'

export type { SynthParams, KickParams, SnareParams, HatParams, GranularParams, ModDest }

// Granular AudioWorkletProcessor — loaded via Blob URL so no extra build config is needed.
const GRANULAR_PROCESSOR = `
const MAX_GRAINS = 32
class GranularProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'position', defaultValue: 0.05, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'size',     defaultValue: 0.4,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'density',  defaultValue: 0.4,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pitch',    defaultValue: 0.5,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'spray',    defaultValue: 0.3,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'detune',   defaultValue: 0.1,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'width',    defaultValue: 0.5,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'level',    defaultValue: 0.7,  minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'gate',     defaultValue: 0,    minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'record',   defaultValue: 1,    minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'wander',   defaultValue: 0,    minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mode',     defaultValue: 0,    minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }
  constructor(options) {
    super(options)
    this.bufLen       = Math.ceil(sampleRate * 4)
    this.bufL         = new Float32Array(this.bufLen)
    this.bufR         = new Float32Array(this.bufLen)
    this.writePos     = 0
    this.grains       = []
    this.prevGate     = 0
    this.wanderOffset = 0   // slow random-walk offset applied to position (−0.5 … +0.5)
    this.contPhase    = 0   // block counter for continuous-mode grain clock
  }
  process(inputs, outputs, parameters) {
    const inL  = inputs[0] !== undefined ? inputs[0][0] : undefined
    const inR  = inputs[0] !== undefined ? inputs[0][1] : undefined
    const outL = outputs[0][0]
    const outR = outputs[0].length > 1 ? outputs[0][1] : outputs[0][0]
    const bs   = outL.length

    const pos    = parameters.position[0]
    const sz     = parameters.size[0]
    const dens   = parameters.density[0]
    const pit    = parameters.pitch[0]
    const spray  = parameters.spray[0]
    const detune = parameters.detune[0]
    const width  = parameters.width[0]
    const lvl    = parameters.level[0]
    const gate   = parameters.gate
    const wander = parameters.wander[0]
    const mode   = parameters.mode[0]

    const grainLen   = Math.floor(sampleRate * (0.02 + sz * 0.38))
    const baseRate   = Math.pow(2, (pit - 0.5) * 4)
    const sprayLen   = Math.floor(spray * sampleRate * 0.5)
    const detuneST   = detune * 2

    // Wander: slow bounded random walk that drifts the effective read position.
    // Rate 0.00015/block ≈ full ±0.5 range traversal in ~20 s at wander=1.
    if (wander > 0) {
      this.wanderOffset += 0.00015 * (Math.random() * 2 - 1)
      if (this.wanderOffset >  0.5) this.wanderOffset =  0.5
      if (this.wanderOffset < -0.5) this.wanderOffset = -0.5
    }
    const effPos = pos + this.wanderOffset * wander
    const clPos  = effPos < 0 ? 0 : effPos > 1 ? 1 : effPos
    const bufOffset = Math.floor(clPos * Math.max(1, this.bufLen - grainLen))

    // Continuous mode: one grain per self-clocked interval, density → grains/sec.
    // 2^(dens*4) gives 1–16 grains/sec on an exponential curve (musically natural).
    if (mode >= 0.5) {
      const grainsPerSec   = Math.pow(2, dens * 4)
      const blocksPerGrain = Math.max(1, Math.round((sampleRate / bs) / grainsPerSec))
      this.contPhase++
      if (this.contPhase >= blocksPerGrain && this.grains.length < MAX_GRAINS) {
        this.contPhase = 0
        const scatter = Math.floor((Math.random() * 2 - 1) * sprayLen)
        const rp      = (this.writePos - bufOffset + scatter + this.bufLen * 8) % this.bufLen
        const rate    = baseRate * Math.pow(2, (Math.random() * 2 - 1) * detuneST / 12)
        const pan     = (Math.random() * 2 - 1) * width
        this.grains.push({ rp, rem: grainLen, tot: grainLen, rate, pan, delay: 0 })
      }
    }

    for (let i = 0; i < bs; i++) {
      // Record synth input into circular buffer
      if (parameters.record[0] >= 0.5) {
        this.bufL[this.writePos] = inL ? inL[i] : 0
        this.bufR[this.writePos] = inR ? inR[i] : (inL ? inL[i] : 0)
        this.writePos = (this.writePos + 1) % this.bufLen
      }

      // Triggered mode: spawn a burst of grains on each gate rising edge
      if (mode < 0.5) {
        const g = gate.length > 1 ? gate[i] : gate[0]
        if (g > 0.5 && this.prevGate <= 0.5) {
          const grainCount = Math.max(1, Math.round(1 + dens * 11))
          const stagger    = Math.max(1, Math.floor(grainLen / (2 * Math.max(grainCount, 2))))
          for (let gi = 0; gi < grainCount && this.grains.length < MAX_GRAINS; gi++) {
            const scatter = Math.floor((Math.random() * 2 - 1) * sprayLen)
            const rp      = (this.writePos - bufOffset + scatter + this.bufLen * 8) % this.bufLen
            const rate    = baseRate * Math.pow(2, (Math.random() * 2 - 1) * detuneST / 12)
            const pan     = (Math.random() * 2 - 1) * width
            this.grains.push({ rp, rem: grainLen, tot: grainLen, rate, pan, delay: gi * stagger })
          }
        }
        this.prevGate = g
      }

      // Sum all active grains
      let sL = 0, sR = 0
      for (let gi = this.grains.length - 1; gi >= 0; gi--) {
        const gr = this.grains[gi]
        if (gr.delay > 0) { gr.delay--; continue }
        if (gr.rem   <= 0) { this.grains.splice(gi, 1); continue }
        const atkLen  = Math.max(4, Math.floor(gr.tot * 0.1))
        const elapsed = gr.tot - gr.rem
        const amp = elapsed < atkLen ? elapsed / atkLen : gr.rem < atkLen ? gr.rem / atkLen : 1
        const idx  = Math.floor(gr.rp)
        const frac = gr.rp - idx
        const i0   = ((idx     % this.bufLen) + this.bufLen) % this.bufLen
        const i1   = (((idx+1) % this.bufLen) + this.bufLen) % this.bufLen
        const smL  = this.bufL[i0] + frac * (this.bufL[i1] - this.bufL[i0])
        const smR  = this.bufR[i0] + frac * (this.bufR[i1] - this.bufR[i0])
        const panL = Math.sqrt(0.5 * (1 - gr.pan))
        const panR = Math.sqrt(0.5 * (1 + gr.pan))
        sL += smL * amp * panL
        sR += smR * amp * panR
        gr.rp  = (gr.rp + gr.rate + this.bufLen * 2) % this.bufLen
        gr.rem--
      }
      if (this.grains.length > MAX_GRAINS) this.grains.splice(0, this.grains.length - MAX_GRAINS)
      outL[i] = sL * lvl
      if (outL !== outR) outR[i] = sR * lvl
    }
    return true
  }
}
registerProcessor('granular-processor', GranularProcessor)
`

// Delay BPM-sync divisions expressed as quarter-note multiples
const SYNC_DIV_BEATS: Record<string, number> = {
  '1/8': 0.5, '3/16': 0.75, '1/4': 1, '3/8': 1.5, '1/2': 2,
}

// Map tone knob (0–1) to filter frequency (400 Hz – 6 kHz, log scale).
// Upper limit is 6 kHz rather than 20 kHz so the feedback path never passes
// harsh high-frequency content regardless of tone setting.
function toneToHz(t: number): number { return 400 * Math.pow(15, t) }

class AudioEngine {
  private ctx: AudioContext | null = null
  private synthVoice: WoscNode | null = null
  private kickVoice: WoscNode | null = null
  private snareVoice: WoscNode | null = null
  private hatVoice: WoscNode | null = null

  private masterGain: GainNode | null = null
  private synthMuteGain: GainNode | null = null
  private kickMuteGain: GainNode | null = null
  private snareMuteGain: GainNode | null = null
  private hatMuteGain: GainNode | null = null
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

  // ── Granular sampler (Lane D) ────────────────────────────────────────────────
  private granularNode: AudioWorkletNode | null = null
  private granMuteGain: GainNode | null = null
  private granAnalyser: AnalyserNode | null = null
  private granDelaySend: GainNode | null = null
  private granReverbSend: GainNode | null = null

  private _initialized = false

  // Throttle state for LFO-driven reverb IR regeneration
  private modIRSize  = 0.6
  private modIRDecay = 0.5
  private lastIRTime = 0

  get isInitialized() { return this._initialized }
  get audioContext() { return this.ctx }
  get synthAnalyserNode() { return this.synthAnalyser }
  get kickAnalyserNode() { return this.kickAnalyser }
  get snareAnalyserNode() { return this.snareAnalyser }
  get hatAnalyserNode() { return this.hatAnalyser }
  get granAnalyserNode() { return this.granAnalyser }

  async init(): Promise<void> {
    if (this._initialized) {
      await this.ctx?.resume()
      return
    }

    this.ctx = new AudioContext()
    await wosc.loadOscillator(this.ctx)

    // Load granular worklet via Blob URL — no Vite config changes required
    const granBlob = new Blob([GRANULAR_PROCESSOR], { type: 'application/javascript' })
    const granBlobUrl = URL.createObjectURL(granBlob)
    await this.ctx.audioWorklet.addModule(granBlobUrl)
    URL.revokeObjectURL(granBlobUrl)

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
    // Q = 0.5 (below Butterworth 0.707) — ensures no resonant peak in the feedback path
    this.delayFilter.Q.value = 0.5
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

    // Synth: voice → muteGain → analyser → master (dry)
    //                           analyser → synthDelaySend → delayInput
    //                           analyser → synthReverbSend → reverbPreDelay
    this.synthMuteGain = this.ctx.createGain(); this.synthMuteGain.gain.value = 1
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
    this.synthVoice.connect(this.synthMuteGain)
    this.synthMuteGain.connect(this.synthAnalyser)
    this.synthVoice.start()

    // Granular sampler: tap from synthAnalyser (native AudioNode, reliable fan-out)
    // synthVoice is a WoscNode wrapper whose connect() may not route to AudioWorkletNode inputs
    this.granularNode = new AudioWorkletNode(this.ctx, 'granular-processor', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    })
    this.granMuteGain  = this.ctx.createGain(); this.granMuteGain.gain.value = 1
    this.granAnalyser  = this.ctx.createAnalyser(); this.granAnalyser.fftSize = 2048
    this.granAnalyser.connect(this.masterGain)

    this.granDelaySend  = this.ctx.createGain(); this.granDelaySend.gain.value = 0.2
    this.granReverbSend = this.ctx.createGain(); this.granReverbSend.gain.value = 0.3
    this.granAnalyser.connect(this.granDelaySend);  this.granDelaySend.connect(this.delayInput)
    this.granAnalyser.connect(this.granReverbSend); this.granReverbSend.connect(this.reverbPreDelay)

    this.synthAnalyser.connect(this.granularNode)   // ← native node → reliable
    this.granularNode.connect(this.granMuteGain)
    this.granMuteGain.connect(this.granAnalyser)

    // Kick
    this.kickMuteGain = this.ctx.createGain(); this.kickMuteGain.gain.value = 1
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
    this.kickVoice.connect(this.kickMuteGain)
    this.kickMuteGain.connect(this.kickAnalyser)
    this.kickVoice.start()

    // Snare
    this.snareMuteGain = this.ctx.createGain(); this.snareMuteGain.gain.value = 1
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
    // Pre-initialize to avoid the first-trigger starting from 0 on all params
    this.snareVoice.timbre = 0.65   // snap default
    this.snareVoice.harmonics = 0.5 // tone default
    this.snareVoice.morph = 0.5     // body default
    this.snareVoice.decay = 0.4
    this.snareVoice.connect(this.snareMuteGain)
    this.snareMuteGain.connect(this.snareAnalyser)
    this.snareVoice.start()

    // Hat
    this.hatMuteGain = this.ctx.createGain(); this.hatMuteGain.gain.value = 1
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
    this.hatVoice.connect(this.hatMuteGain)
    this.hatMuteGain.connect(this.hatAnalyser)
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
    // Engine 14: timbre=snappiness (noise/body balance), harmonics=body+noise frequency, morph=body resonance
    this.snareVoice.timbreAudioParameter.linearRampToValueAtTime(params.snap, t)
    this.snareVoice.harmonicsAudioParameter.linearRampToValueAtTime(params.tone, t)
    this.snareVoice.morphAudioParameter.linearRampToValueAtTime(params.body, t)
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
    // Hard cap at 0.85 — prevents runaway self-oscillation
    this.delayFeedback.gain.linearRampToValueAtTime(Math.min(feedback, 0.85), t)
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

  setSendLevel(voice: 'synth' | 'kick' | 'snare' | 'hat' | 'gran', effect: 'delay' | 'reverb', level: number): void {
    if (!this.ctx) return
    const map = {
      synth: { delay: this.synthDelaySend, reverb: this.synthReverbSend },
      kick:  { delay: this.kickDelaySend,  reverb: this.kickReverbSend  },
      snare: { delay: this.snareDelaySend, reverb: this.snareReverbSend },
      hat:   { delay: this.hatDelaySend,   reverb: this.hatReverbSend   },
      gran:  { delay: this.granDelaySend,  reverb: this.granReverbSend  },
    }
    const node = map[voice][effect]
    if (node) node.gain.linearRampToValueAtTime(level, this.ctx.currentTime + 0.016)
  }

  setVoiceEnabled(voice: 'synth' | 'kick' | 'snare' | 'hat' | 'gran', enabled: boolean): void {
    if (!this.ctx) return
    const map = {
      synth: this.synthMuteGain,
      kick:  this.kickMuteGain,
      snare: this.snareMuteGain,
      hat:   this.hatMuteGain,
      gran:  this.granMuteGain,
    }
    const gain = map[voice]
    if (gain) gain.gain.linearRampToValueAtTime(enabled ? 1 : 0, this.ctx.currentTime + 0.016)
  }

  // ─── Granular sampler (Lane D) ────────────────────────────────────────────

  setGranularParams(params: GranularParams): void {
    if (!this.ctx || !this.granularNode) return
    const t = this.ctx.currentTime + 0.016
    const p = this.granularNode.parameters
    p.get('position')!.linearRampToValueAtTime(params.position, t)
    p.get('size')!.linearRampToValueAtTime(params.size, t)
    p.get('density')!.linearRampToValueAtTime(params.density, t)
    p.get('pitch')!.linearRampToValueAtTime(params.pitch, t)
    p.get('spray')!.linearRampToValueAtTime(params.spray, t)
    p.get('detune')!.linearRampToValueAtTime(params.detune, t)
    p.get('width')!.linearRampToValueAtTime(params.width, t)
    p.get('level')!.linearRampToValueAtTime(params.level, t)
    p.get('wander')!.linearRampToValueAtTime(params.wander, t)
    p.get('mode')!.setValueAtTime(params.continuousMode ? 1 : 0, t)
  }

  triggerGranular(when = 0): void {
    if (!this.ctx || !this.granularNode) return
    const gate = this.granularNode.parameters.get('gate')!
    const t = this.ctx.currentTime + when
    gate.setValueAtTime(1, t)
    gate.setValueAtTime(0, t + 0.01)
  }

  setGranularRecording(enabled: boolean): void {
    if (!this.ctx || !this.granularNode) return
    this.granularNode.parameters.get('record')!
      .setValueAtTime(enabled ? 1 : 0, this.ctx.currentTime + 0.016)
  }

  // ─── LFO modulation ──────────────────────────────────────────────────────
  // Called by LFOEngine on each tick. `value` is always 0–1 normalized.
  // JS-param destinations (laneA/B/D jitter etc.) are handled in LFOEngine directly.
  applyModulation(dest: ModDest, value: number): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const c = (v: number) => Math.max(0, Math.min(1, v))
    const cv = c(value)
    switch (dest) {
      case 'synth.timbre':    this.synthVoice?.timbreAudioParameter.setValueAtTime(cv, t); break
      case 'synth.morph':     this.synthVoice?.morphAudioParameter.setValueAtTime(cv, t); break
      case 'synth.harmonics': this.synthVoice?.harmonicsAudioParameter.setValueAtTime(cv, t); break
      case 'synth.decay':     this.synthVoice?.decayAudioParameter.setValueAtTime(cv, t); break
      case 'synth.level':     this.synthVoice?.volumeAudioParameter.setValueAtTime(cv, t); break
      case 'gran.position':   this.granularNode?.parameters.get('position')?.setValueAtTime(cv, t); break
      case 'gran.size':       this.granularNode?.parameters.get('size')?.setValueAtTime(cv, t); break
      case 'gran.density':    this.granularNode?.parameters.get('density')?.setValueAtTime(cv, t); break
      case 'gran.pitch':      this.granularNode?.parameters.get('pitch')?.setValueAtTime(cv, t); break
      case 'gran.spray':      this.granularNode?.parameters.get('spray')?.setValueAtTime(cv, t); break
      case 'gran.detune':     this.granularNode?.parameters.get('detune')?.setValueAtTime(cv, t); break
      case 'gran.wander':     this.granularNode?.parameters.get('wander')?.setValueAtTime(cv, t); break
      case 'gran.level':      this.granularNode?.parameters.get('level')?.setValueAtTime(cv, t); break
      case 'delay.feedback':  this.delayFeedback?.gain.setValueAtTime(Math.min(cv * 0.85, 0.85), t); break
      case 'delay.time':      this.delayNode?.delayTime.setValueAtTime(cv * 1.999, t); break
      case 'reverb.level':    this.reverbReturn?.gain.setValueAtTime(cv, t); break
      case 'reverb.size':
        this.modIRSize = cv
        this.maybeRegenerateIR(t)
        break
      case 'reverb.decay':
        this.modIRDecay = cv
        this.maybeRegenerateIR(t)
        break
      // JS-param dests (laneA/B/D jitter/bias, drum params) handled in LFOEngine
    }
  }

  // Regenerate reverb IR at most every 500 ms to avoid CPU spikes from rapid LFO changes.
  private maybeRegenerateIR(now: number): void {
    if (!this.ctx || !this.reverbConvolver) return
    if (now - this.lastIRTime < 0.5) return
    this.reverbConvolver.buffer = this.generateIR(this.ctx, this.modIRSize, this.modIRDecay)
    this.lastIRTime = now
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
