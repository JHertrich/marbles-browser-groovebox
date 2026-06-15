import { useCallback } from 'react'
import { useApp } from '../state/AppContext'
import { Knob } from './Knob'
import { StepGrid } from './StepGrid'
import { PeakMeter } from './PeakMeter'
import { audioEngine } from '../audio/AudioEngine'
import { laneB } from '../sequencer/LaneB'

const B   = 'var(--accent-b)'
const HAT = 'var(--accent-hat)'
const A   = 'var(--accent-a)'
const C   = 'var(--accent-c)'
const fmt = (v: number) => v.toFixed(2)

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

export function LaneBSection() {
  const { state, dispatch } = useApp()
  const { density, jitter, length, kick, snare, hat } = state.laneB
  const { sends } = state.laneC

  const kickSub  = useCallback((cb: (at: number) => void) =>
    laneB.onTrigger((v, _, at) => { if (v === 'kick')  cb(at) }), [])
  const snareSub = useCallback((cb: (at: number) => void) =>
    laneB.onTrigger((v, _, at) => { if (v === 'snare') cb(at) }), [])
  const hatSub   = useCallback((cb: (at: number) => void) =>
    laneB.onTrigger((v, _, at) => { if (v === 'hat')   cb(at) }), [])

  return (
    <div className="lane">
      <div className="lane-header">
        <span className="lane-tag tag-b">Lane B</span>
        <span className="lane-name">Plaits Drums + Marbles Rhythm Generator</span>
        <div className="lane-mode">
          <div className="dot" style={{ background: B }} />
          Probabilistic
        </div>
      </div>

      {/* ── Shared rhythm section ── */}
      <div className="section" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <span className="section-title" style={{ marginBottom: 0 }}>Marbles — rhythm generator (3 trigger outputs)</span>
          <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_LANE_B_RHYTHM' })}>⚄</button>
        </div>
        <div className="knob-row">
          <Knob value={density} onChange={v => dispatch({ type: 'PATCH_LANE_B', patch: { density: v } })}
            defaultValue={0.7} color={B} label="Density" valueLabel={fmt(density)} />
          <Knob value={jitter} onChange={v => dispatch({ type: 'PATCH_LANE_B', patch: { jitter: v } })}
            defaultValue={0.1} color={B} label="Jitter" valueLabel={fmt(jitter)} />
          <div className="knob-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span className="knob-label" style={{ whiteSpace: 'nowrap' }}>Length</span>
              <input type="range" min={1} max={32} value={length}
                onChange={e => dispatch({ type: 'PATCH_LANE_B', patch: { length: Number(e.target.value) } })}
                style={{ width: 60 }} />
              <span className="knob-val">{length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 drum voices ── */}
      <div className="drum-voices">

        {/* Kick */}
        <div className="dv">
          <div className="dv-header">
            <button
              className={`voice-toggle${kick.enabled ? ' voice-toggle-on' : ''}`}
              style={{ '--vc': A } as React.CSSProperties}
              onClick={() => dispatch({ type: 'TOGGLE_KICK_ENABLED' })}
              title={kick.enabled ? 'Mute kick' : 'Unmute kick'}
            />
            <span className="dv-name" style={{ color: A, opacity: kick.enabled ? 1 : 0.4 }}>● Kick</span>
            <span className="dv-prob">Bias {Math.round(kick.bias * 100)}%</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_KICK' })}>⚄</button>
          </div>
          <div className="prob-bar">
            <div className="prob-fill" style={{ background: A, width: `${kick.bias * 100}%` }} />
          </div>
          <StepGrid subscribe={kickSub} color={A} cells={8} />
          <div className="knob-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Knob value={kick.tune / 127} onChange={v => dispatch({ type: 'PATCH_KICK', patch: { tune: Math.round(v * 60 + 24) } })}
              defaultValue={36 / 127} size={28} color={A} label="Tune" valueLabel={`${kick.tune}`} />
            <Knob value={kick.decay} onChange={v => dispatch({ type: 'PATCH_KICK', patch: { decay: v } })}
              defaultValue={0.5} size={28} color={A} label="Decay" valueLabel={fmt(kick.decay)} />
            <Knob value={kick.snap} onChange={v => dispatch({ type: 'PATCH_KICK', patch: { snap: v } })}
              defaultValue={0.6} size={28} color={A} label="Snap" valueLabel={fmt(kick.snap)} />
            <Knob value={sends.kick.delay} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'kick', patch: { delay: v } })}
              defaultValue={0.05} size={28} color={C} label="Dly" valueLabel={fmt(sends.kick.delay)} />
            <Knob value={sends.kick.reverb} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'kick', patch: { reverb: v } })}
              defaultValue={0.15} size={28} color={C} label="Rvb" valueLabel={fmt(sends.kick.reverb)} />
          </div>
          <DejaVuBar value={kick.dejaVu} color={A} label="Deja vu" />
          <PeakMeter analyser={audioEngine.kickAnalyserNode} color={A} />
        </div>

        {/* Snare */}
        <div className="dv">
          <div className="dv-header">
            <button
              className={`voice-toggle${snare.enabled ? ' voice-toggle-on' : ''}`}
              style={{ '--vc': B } as React.CSSProperties}
              onClick={() => dispatch({ type: 'TOGGLE_SNARE_ENABLED' })}
              title={snare.enabled ? 'Mute snare' : 'Unmute snare'}
            />
            <span className="dv-name" style={{ color: B, opacity: snare.enabled ? 1 : 0.4 }}>— Snare</span>
            <span className="dv-prob">Bias {Math.round(snare.bias * 100)}%</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_SNARE' })}>⚄</button>
          </div>
          <div className="prob-bar">
            <div className="prob-fill" style={{ background: B, width: `${snare.bias * 100}%` }} />
          </div>
          <StepGrid subscribe={snareSub} color={B} cells={8} />
          <div className="knob-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Knob value={snare.snap} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { snap: v } })}
              defaultValue={0.65} size={28} color={B} label="Snap" valueLabel={fmt(snare.snap)} />
            <Knob value={snare.tone} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { tone: v } })}
              defaultValue={0.5} size={28} color={B} label="Tone" valueLabel={fmt(snare.tone)} />
            <Knob value={snare.body} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { body: v } })}
              defaultValue={0.5} size={28} color={B} label="Body" valueLabel={fmt(snare.body)} />
            <Knob value={snare.decay} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { decay: v } })}
              defaultValue={0.4} size={28} color={B} label="Decay" valueLabel={fmt(snare.decay)} />
            <Knob value={sends.snare.delay} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'snare', patch: { delay: v } })}
              defaultValue={0.15} size={28} color={C} label="Dly" valueLabel={fmt(sends.snare.delay)} />
            <Knob value={sends.snare.reverb} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'snare', patch: { reverb: v } })}
              defaultValue={0.25} size={28} color={C} label="Rvb" valueLabel={fmt(sends.snare.reverb)} />
          </div>
          <DejaVuBar value={snare.dejaVu} color={B} label="Deja vu" />
          <PeakMeter analyser={audioEngine.snareAnalyserNode} color={B} />
        </div>

        {/* Hi-Hat */}
        <div className="dv">
          <div className="dv-header">
            <button
              className={`voice-toggle${hat.enabled ? ' voice-toggle-on' : ''}`}
              style={{ '--vc': HAT } as React.CSSProperties}
              onClick={() => dispatch({ type: 'TOGGLE_HAT_ENABLED' })}
              title={hat.enabled ? 'Mute hi-hat' : 'Unmute hi-hat'}
            />
            <span className="dv-name" style={{ color: HAT, opacity: hat.enabled ? 1 : 0.4 }}>∿ Hi-Hat</span>
            <span className="dv-prob">Bias {Math.round(hat.bias * 100)}%</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_HAT' })}>⚄</button>
          </div>
          <div className="prob-bar">
            <div className="prob-fill" style={{ background: HAT, width: `${hat.bias * 100}%` }} />
          </div>
          <StepGrid subscribe={hatSub} color={HAT} cells={8} />
          <div className="knob-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Knob value={hat.open} onChange={v => dispatch({ type: 'PATCH_HAT', patch: { open: v } })}
              defaultValue={0.2} size={28} color={HAT} label="Open" valueLabel={fmt(hat.open)} />
            <Knob value={hat.tone} onChange={v => dispatch({ type: 'PATCH_HAT', patch: { tone: v } })}
              defaultValue={0.7} size={28} color={HAT} label="Tone" valueLabel={fmt(hat.tone)} />
            <Knob value={sends.hat.delay} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'hat', patch: { delay: v } })}
              defaultValue={0.03} size={28} color={C} label="Dly" valueLabel={fmt(sends.hat.delay)} />
            <Knob value={sends.hat.reverb} onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'hat', patch: { reverb: v } })}
              defaultValue={0.08} size={28} color={C} label="Rvb" valueLabel={fmt(sends.hat.reverb)} />
          </div>
          <DejaVuBar value={hat.dejaVu} color={HAT} label="Deja vu" />
          <PeakMeter analyser={audioEngine.hatAnalyserNode} color={HAT} />
        </div>

      </div>

      {/* per-voice bias knobs row */}
      <div className="section" style={{ marginTop: 10 }}>
        <div className="section-title">Per-voice bias &amp; deja vu</div>
        <div className="knob-row">
          <Knob value={kick.bias}  onChange={v => dispatch({ type: 'PATCH_KICK',  patch: { bias: v } })}  defaultValue={0.85} color={A}   label="K.Bias"  valueLabel={fmt(kick.bias)} />
          <Knob value={kick.dejaVu}  onChange={v => dispatch({ type: 'PATCH_KICK',  patch: { dejaVu: v } })} defaultValue={0} color={A}   label="K.Loop"  valueLabel={fmt(kick.dejaVu)} />
          <Knob value={snare.bias} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { bias: v } })}  defaultValue={0.65} color={B}   label="S.Bias"  valueLabel={fmt(snare.bias)} />
          <Knob value={snare.dejaVu} onChange={v => dispatch({ type: 'PATCH_SNARE', patch: { dejaVu: v } })} defaultValue={0} color={B}   label="S.Loop"  valueLabel={fmt(snare.dejaVu)} />
          <Knob value={hat.bias}   onChange={v => dispatch({ type: 'PATCH_HAT',   patch: { bias: v } })}  defaultValue={0.55} color={HAT} label="H.Bias"  valueLabel={fmt(hat.bias)} />
          <Knob value={hat.dejaVu}   onChange={v => dispatch({ type: 'PATCH_HAT',   patch: { dejaVu: v } })} defaultValue={0} color={HAT} label="H.Loop"  valueLabel={fmt(hat.dejaVu)} />
        </div>
      </div>
    </div>
  )
}
