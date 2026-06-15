import { useCallback, useMemo } from 'react'
import { useApp } from '../state/AppContext'
import { Knob } from './Knob'
import { StepGrid } from './StepGrid'
import { Oscilloscope } from './Oscilloscope'
import { audioEngine } from '../audio/AudioEngine'
import { laneA } from '../sequencer/LaneA'
import { PLAITS_ENGINE_NAMES, SYNTH_ENGINES } from '../audio/types'
import { SCALE_MODE_NAMES, ROOT_NOTES } from '../sequencer/scales'
import type { ScaleMode, RootNote } from '../sequencer/scales'

const A = 'var(--accent-a)'
const C = 'var(--accent-c)'
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

export function LaneASection() {
  const { state, dispatch } = useApp()
  const { t, x, synth, synthEnabled } = state.laneA
  const synthSends = state.laneC.sends.synth

  // Stable subscription for StepGrid
  const synthSubscribe = useCallback(
    (cb: (at: number) => void) => laneA.onTrigger((_, __, at) => cb(at)),
    []
  )

  // Pitch bars: last N voltages from the x-generator
  const pitchBars = useMemo(() => laneA.x.getVoltages(12), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lane">
      <div className="lane-header">
        <span className="lane-tag tag-a">Lane A</span>
        <span className="lane-name">Plaits Synth + Marbles Sequencer</span>
        <div className="lane-mode">
          <div className="dot" style={{ background: A }} />
          {PLAITS_ENGINE_NAMES[synth.engine]}
        </div>
      </div>

      <div className="two-col">
        {/* ── t-section ── */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Marbles — timing (t)</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_LANE_A_T' })}>⚄</button>
          </div>
          <div className="knob-row">
            <Knob value={(t.rate - 1) / 7} onChange={v => dispatch({ type: 'PATCH_LANE_A_T', patch: { rate: Math.round(1 + v * 7) } })}
              defaultValue={1 / 7} color={A} label="Rate" valueLabel={`÷${t.rate}`} />
            <Knob value={t.jitter} onChange={v => dispatch({ type: 'PATCH_LANE_A_T', patch: { jitter: v } })}
              defaultValue={0.15} color={A} label="Jitter" valueLabel={fmt(t.jitter)} />
            <Knob value={t.gate} onChange={v => dispatch({ type: 'PATCH_LANE_A_T', patch: { gate: v } })}
              defaultValue={0.5} color={A} label="Gate" valueLabel={fmt(t.gate)} />
            <Knob value={t.bias} onChange={v => dispatch({ type: 'PATCH_LANE_A_T', patch: { bias: v } })}
              defaultValue={0.65} color={A} label="Bias" valueLabel={fmt(t.bias)} />
          </div>
          <div className="section-sep" />
          <div className="section-title" style={{ marginBottom: 4 }}>Trigger history</div>
          <StepGrid subscribe={synthSubscribe} color={A} />
          <div className="step-annotation">↑ lights up when Marbles fires — not user-programmable</div>
          <DejaVuBar value={t.dejaVu} color={A} label="Deja vu (t)" />
          <div style={{ marginTop: 4 }}>
            <Knob value={t.dejaVu} onChange={v => dispatch({ type: 'PATCH_LANE_A_T', patch: { dejaVu: v } })}
              defaultValue={0} size={28} color={A} />
          </div>
          <div style={{ marginTop: 6 }}>
            <span className="section-title">Length: </span>
            <input type="range" min={1} max={32} value={t.length}
              onChange={e => dispatch({ type: 'PATCH_LANE_A_T', patch: { length: Number(e.target.value) } })}
              style={{ width: 80, verticalAlign: 'middle' }} />
            <span className="knob-val" style={{ marginLeft: 6 }}>{t.length}</span>
          </div>
        </div>

        {/* ── x-section ── */}
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Marbles — pitch (x)</span>
            <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_LANE_A_X' })}>⚄</button>
          </div>

          {/* Scale mode chips */}
          <div className="chip-row">
            {SCALE_MODE_NAMES.map((m: ScaleMode) => (
              <span key={m} className={`chip${x.mode === m ? ' chip-sel-a' : ''}`}
                onClick={() => dispatch({ type: 'PATCH_LANE_A_X', patch: { mode: m } })}>
                {m}
              </span>
            ))}
          </div>

          {/* Root note chips */}
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {ROOT_NOTES.map((n: RootNote) => (
              <span key={n} className={`chip${x.root === n ? ' chip-sel-a' : ''}`}
                onClick={() => dispatch({ type: 'PATCH_LANE_A_X', patch: { root: n } })}>
                {n}
              </span>
            ))}
          </div>

          {/* Pitch bars (live voltage visualization) */}
          <div className="section-title" style={{ marginBottom: 2 }}>Current pitch sequence (live)</div>
          <div className="pitch-bars">
            {pitchBars.map((v, i) => (
              <div key={i} className={`pb${i === (laneA.x as unknown as { loopPos: number }).loopPos % 12 ? ' pb-active' : ''}`}
                style={{ height: `${Math.max(10, v * 38)}px` }} />
            ))}
          </div>

          <div className="section-sep" />

          <div className="knob-row">
            <Knob value={x.spread} onChange={v => dispatch({ type: 'PATCH_LANE_A_X', patch: { spread: v } })}
              defaultValue={0.5} color={A} label="Spread" valueLabel={fmt(x.spread)} />
            <Knob value={x.bias} onChange={v => dispatch({ type: 'PATCH_LANE_A_X', patch: { bias: v } })}
              defaultValue={0.5} color={A} label="Bias" valueLabel={fmt(x.bias)} />
            <Knob value={(x.steps - 1) / 7} onChange={v => dispatch({ type: 'PATCH_LANE_A_X', patch: { steps: Math.max(1, Math.round(1 + v * 7)) } })}
              defaultValue={1} color={A} label="Steps" valueLabel={`${x.steps}`} />
          </div>

          <DejaVuBar value={x.dejaVu} color={A} label="Deja vu (x)" />
          <div style={{ marginTop: 4 }}>
            <Knob value={x.dejaVu} onChange={v => dispatch({ type: 'PATCH_LANE_A_X', patch: { dejaVu: v } })}
              defaultValue={0} size={28} color={A} />
          </div>
          <div className="step-annotation">↑ t and x deja vu are independent — key musical feature</div>
        </div>
      </div>

      {/* ── Plaits engine ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <button
            className={`voice-toggle${synthEnabled ? ' voice-toggle-on' : ''}`}
            style={{ '--vc': A, marginRight: 8 } as React.CSSProperties}
            onClick={() => dispatch({ type: 'TOGGLE_SYNTH_ENABLED' })}
            title={synthEnabled ? 'Mute synth' : 'Unmute synth'}
          />
          <span className="section-title" style={{ marginBottom: 0, opacity: synthEnabled ? 1 : 0.4 }}>Plaits (WASM) — synthesis engine</span>
          <button className="btn-voice-rnd" onClick={() => dispatch({ type: 'RANDOMIZE_SYNTH' })}>⚄</button>
        </div>
        <div className="mode-tabs">
          {SYNTH_ENGINES.map(idx => (
            <span key={idx}
              className={`mtab${synth.engine === idx ? ' mtab-sel' : ''}`}
              onClick={() => dispatch({ type: 'PATCH_LANE_A_SYNTH', patch: { engine: idx } })}>
              {PLAITS_ENGINE_NAMES[idx]}
            </span>
          ))}
        </div>
        <div className="knob-row">
          {([
            ['timbre',    'Timbre',  0.5],
            ['morph',     'Morph',   0.3],
            ['harmonics', 'Harm.',   0.7],
            ['decay',     'Decay',   0.6],
            ['level',     'Level',   0.8],
          ] as [keyof typeof synth, string, number][]).map(([k, lbl, def]) => (
            <Knob key={k}
              value={synth[k] as number}
              onChange={v => dispatch({ type: 'PATCH_LANE_A_SYNTH', patch: { [k]: v } })}
              defaultValue={def} color={A} label={lbl} valueLabel={fmt(synth[k] as number)} />
          ))}
          <Knob value={synthSends.delay}
            onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'synth', patch: { delay: v } })}
            defaultValue={0.25} color={C} label="FX:Dly" valueLabel={fmt(synthSends.delay)} />
          <Knob value={synthSends.reverb}
            onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: 'synth', patch: { reverb: v } })}
            defaultValue={0.35} color={C} label="FX:Rvb" valueLabel={fmt(synthSends.reverb)} />
        </div>
        <Oscilloscope analyser={audioEngine.synthAnalyserNode} color="#7f77dd" />
      </div>
    </div>
  )
}
