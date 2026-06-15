import { useCallback } from 'react'
import { useApp, useModulatedDests } from '../state/AppContext'
import { Knob } from './Knob'
import { Oscilloscope } from './Oscilloscope'
import { StepGrid } from './StepGrid'
import { PeakMeter } from './PeakMeter'
import { audioEngine } from '../audio/AudioEngine'
import { laneD } from '../sequencer/LaneD'

const D   = 'var(--accent-d)'
const C   = 'var(--accent-c)'
const fmt = (v: number, d = 2) => v.toFixed(d)

// Musical intervals available for grain pitch (semitones from unison).
// The worklet formula Math.pow(2, (pit-0.5)*4) produces exact frequency ratios
// for these positions, so intervals like a P5 (7 st) land on exactly 3:2.
const PITCH_ST  = [-24, -12, -7, -5, -4, -3, 0, 3, 4, 5, 7, 12, 24] as const
const PITCH_LBL = ['-2oct','-Oct','-P5','-P4','-M3','-m3','P1','m3','M3','P4','P5','Oct','+2oct']

function snapPitch(rawV: number): number {
  const st = (rawV - 0.5) * 48
  const closest = PITCH_ST.reduce((best, iv) => Math.abs(iv - st) < Math.abs(best - st) ? iv : best)
  return 0.5 + closest / 48
}

function pitchLabel(param: number): string {
  const st = Math.round((param - 0.5) * 48)
  const idx = PITCH_ST.indexOf(st as typeof PITCH_ST[number])
  return idx >= 0 ? PITCH_LBL[idx] : `${st > 0 ? '+' : ''}${st}st`
}

function DejaVuBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="deja-row">
      <span className="deja-label">{label}</span>
      <div className="deja-track">
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${value * 100}%` }} />
      </div>
      <span className="deja-pct">{Math.round(value * 100)}%</span>
    </div>
  )
}

export function LaneDSection() {
  const { state, dispatch } = useApp()
  const mod = useModulatedDests()
  const { t, grain, granEnabled, granRecording } = state.laneD
  const granSends = state.laneC.sends.gran

  const granSubscribe = useCallback(
    (cb: (at: number) => void) => laneD.onTrigger((_, at) => cb(at)),
    []
  )

  return (
    <div className="lane">
      <div className="lane-header">
        <span className="lane-tag tag-d">Lane C</span>
        <span className="lane-name">Granular Sampler — live-samples Lane A synth output</span>
        <div className="lane-mode">
          <div className="dot" style={{ background: D }} />
          Granular
        </div>
      </div>

      <div className="two-col">
        {/* ── t-section ── */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Marbles — timing (t)</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_LANE_D_T' })}>⚄</button>
          </div>
          <div className="knob-row">
            <Knob value={(t.rate - 1) / 7} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { rate: Math.round(1 + v * 7) } })}
              defaultValue={2 / 7} color={D} label="Rate" valueLabel={`÷${t.rate}`} />
            <Knob value={t.jitter} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { jitter: v } })}
              defaultValue={0.2} color={D} label="Jitter" valueLabel={fmt(t.jitter)} modulated={mod.has('laneD.jitter')} />
            <Knob value={t.gate} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { gate: v } })}
              defaultValue={0.5} color={D} label="Gate" valueLabel={fmt(t.gate)} />
            <Knob value={t.bias} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { bias: v } })}
              defaultValue={0.5} color={D} label="Bias" valueLabel={fmt(t.bias)} modulated={mod.has('laneD.bias')} />
          </div>
          <div className="section-sep" />
          <div className="section-title" style={{ marginBottom: 4 }}>Trigger history</div>
          <StepGrid subscribe={granSubscribe} color={D} />
          <DejaVuBar value={t.dejaVu} color={D} label="Deja vu (t)" />
          <div style={{ marginTop: 4 }}>
            <Knob value={t.dejaVu} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { dejaVu: v } })}
              defaultValue={0.3} size={28} color={D} />
          </div>
          <div style={{ marginTop: 6 }}>
            <span className="section-title">Length: </span>
            <input type="range" min={1} max={32} value={t.length}
              onChange={e => dispatch({ type: 'PATCH_LANE_D_T', patch: { length: Number(e.target.value) } })}
              style={{ width: 80, verticalAlign: 'middle' }} />
            <span className="knob-val" style={{ marginLeft: 6 }}>{t.length}</span>
          </div>
        </div>

        {/* ── Granular engine ── */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              className={`voice-toggle${granEnabled ? ' voice-toggle-on' : ''}`}
              style={{ '--vc': D } as React.CSSProperties}
              onClick={() => dispatch({ type: 'TOGGLE_GRAN_ENABLED' })}
              title={granEnabled ? 'Mute granular' : 'Unmute granular'}
            />
            <span className="section-title" style={{ marginBottom: 0, opacity: granEnabled ? 1 : 0.4 }}>
              Granulator II
            </span>
            <button
              className={`btn-mode${grain.continuousMode ? ' btn-mode-on' : ''}`}
              onClick={() => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { continuousMode: !grain.continuousMode } })}
              title={grain.continuousMode ? 'Switch to triggered mode' : 'Switch to continuous drone mode'}
            >{grain.continuousMode ? '~ CONT' : '◈ TRIG'}</button>
            <button
              className={`btn-rec${granRecording ? ' btn-rec-on' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_GRAN_RECORDING' })}
              title={granRecording ? 'Freeze buffer' : 'Resume recording'}
            >{granRecording ? '● REC' : '■ FRZ'}</button>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_GRAN' })}>⚄</button>
          </div>

          <div className="knob-row" style={{ flexWrap: 'wrap' }}>
            <Knob value={grain.position}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { position: v } })}
              defaultValue={0.05} color={D} label="Pos" valueLabel={fmt(grain.position)} modulated={mod.has('gran.position')} />
            <Knob value={grain.size}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { size: v } })}
              defaultValue={0.4} color={D} label="Size"
              valueLabel={`${Math.round(20 + grain.size * 380)}ms`} modulated={mod.has('gran.size')} />
            <Knob value={grain.density}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { density: v } })}
              defaultValue={0.4} color={D} label="Dens" valueLabel={`${Math.round(1 + grain.density * 11)}`} modulated={mod.has('gran.density')} />
            <Knob value={grain.pitch}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { pitch: snapPitch(v) } })}
              defaultValue={0.5} color={D} label="Pitch"
              valueLabel={pitchLabel(grain.pitch)} modulated={mod.has('gran.pitch')} />
            <Knob value={grain.spray}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { spray: v } })}
              defaultValue={0.3} color={D} label="Spray" valueLabel={fmt(grain.spray)} modulated={mod.has('gran.spray')} />
            <Knob value={grain.detune}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { detune: v } })}
              defaultValue={0.1} color={D} label="Detun" valueLabel={fmt(grain.detune)} modulated={mod.has('gran.detune')} />
            <Knob value={grain.width}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { width: v } })}
              defaultValue={0.5} color={D} label="Width" valueLabel={fmt(grain.width)} />
            <Knob value={grain.wander}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { wander: v } })}
              defaultValue={0} color={D} label="Wander" valueLabel={fmt(grain.wander)} modulated={mod.has('gran.wander')} />
            <Knob value={grain.level}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { level: v } })}
              defaultValue={0.7} color={D} label="Level" valueLabel={fmt(grain.level)} modulated={mod.has('gran.level')} />
            <Knob value={granSends.delay}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'gran', patch: { delay: v } })}
              defaultValue={0.2} color={C} label="FX:Dly" valueLabel={fmt(granSends.delay)} />
            <Knob value={granSends.reverb}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'gran', patch: { reverb: v } })}
              defaultValue={0.3} color={C} label="FX:Rvb" valueLabel={fmt(granSends.reverb)} />
          </div>

          <div className="section-sep" style={{ marginTop: 8 }} />

          {/* Capture input view — shows what's entering the granular buffer */}
          <div style={{ opacity: granRecording ? 1 : 0.35, transition: 'opacity 0.3s' }}>
            <Oscilloscope
              analyser={audioEngine.synthAnalyserNode}
              color={granRecording ? D : 'var(--text-muted)'}
              height={32}
              label={granRecording ? '● Capture input' : '■ Buffer frozen'}
            />
          </div>

          {/* Granular output level */}
          <PeakMeter analyser={audioEngine.granAnalyserNode} color={D} />
        </div>
      </div>
    </div>
  )
}
