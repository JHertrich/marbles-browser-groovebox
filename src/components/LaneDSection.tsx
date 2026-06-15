import { useCallback } from 'react'
import { useApp } from '../state/AppContext'
import { Knob } from './Knob'
import { StepGrid } from './StepGrid'
import { PeakMeter } from './PeakMeter'
import { audioEngine } from '../audio/AudioEngine'
import { laneD } from '../sequencer/LaneD'

const D   = 'var(--accent-d)'
const C   = 'var(--accent-c)'
const fmt = (v: number, d = 2) => v.toFixed(d)

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
              defaultValue={0.2} color={D} label="Jitter" valueLabel={fmt(t.jitter)} />
            <Knob value={t.gate} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { gate: v } })}
              defaultValue={0.5} color={D} label="Gate" valueLabel={fmt(t.gate)} />
            <Knob value={t.bias} onChange={v => dispatch({ type: 'PATCH_LANE_D_T', patch: { bias: v } })}
              defaultValue={0.5} color={D} label="Bias" valueLabel={fmt(t.bias)} />
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <button
              className={`voice-toggle${granEnabled ? ' voice-toggle-on' : ''}`}
              style={{ '--vc': D, marginRight: 8 } as React.CSSProperties}
              onClick={() => dispatch({ type: 'TOGGLE_GRAN_ENABLED' })}
              title={granEnabled ? 'Mute granular' : 'Unmute granular'}
            />
            <span className="section-title" style={{ marginBottom: 0, opacity: granEnabled ? 1 : 0.4 }}>
              Granulator II — grain engine
            </span>
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
              defaultValue={0.2} color={D} label="Pos" valueLabel={fmt(grain.position)} />
            <Knob value={grain.size}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { size: v } })}
              defaultValue={0.4} color={D} label="Size"
              valueLabel={`${Math.round(20 + grain.size * 380)}ms`} />
            <Knob value={grain.density}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { density: v } })}
              defaultValue={0.4} color={D} label="Dens" valueLabel={`${Math.round(1 + grain.density * 11)}`} />
            <Knob value={grain.pitch}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { pitch: v } })}
              defaultValue={0.5} color={D} label="Pitch"
              valueLabel={grain.pitch === 0.5 ? '0' : `${((grain.pitch - 0.5) * 4 * 12).toFixed(0)}st`} />
            <Knob value={grain.spray}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { spray: v } })}
              defaultValue={0.3} color={D} label="Spray" valueLabel={fmt(grain.spray)} />
            <Knob value={grain.detune}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { detune: v } })}
              defaultValue={0.1} color={D} label="Detun" valueLabel={fmt(grain.detune)} />
            <Knob value={grain.width}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { width: v } })}
              defaultValue={0.5} color={D} label="Width" valueLabel={fmt(grain.width)} />
            <Knob value={grain.level}
              onChange={v => dispatch({ type: 'PATCH_LANE_D_GRAIN', patch: { level: v } })}
              defaultValue={0.7} color={D} label="Level" valueLabel={fmt(grain.level)} />
            <Knob value={granSends.delay}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'gran', patch: { delay: v } })}
              defaultValue={0.2} color={C} label="FX:Dly" valueLabel={fmt(granSends.delay)} />
            <Knob value={granSends.reverb}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'gran', patch: { reverb: v } })}
              defaultValue={0.3} color={C} label="FX:Rvb" valueLabel={fmt(granSends.reverb)} />
          </div>

          <div className="section-sep" style={{ marginTop: 8 }} />
          <div className="section-title" style={{ marginBottom: 4 }}>
            Samples live synth output — start Lane A first to fill the buffer
          </div>
          <PeakMeter analyser={audioEngine.granAnalyserNode} color={D} />
        </div>
      </div>
    </div>
  )
}
