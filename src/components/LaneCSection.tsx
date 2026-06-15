import { useApp } from '../state/AppContext'
import { Knob } from './Knob'
import type { SyncDiv } from '../state/types'

const C = 'var(--accent-c)'
const A = 'var(--accent-a-pale)'
const B = 'var(--accent-b-pale)'
const HAT = 'var(--accent-hat)'
const fmt = (v: number) => v.toFixed(2)

const SYNC_DIVS: SyncDiv[] = ['1/8', '3/16', '1/4', '3/8', '1/2']

type Voice = 'synth' | 'kick' | 'snare' | 'hat'
const VOICES: { key: Voice; label: string; color: string }[] = [
  { key: 'synth', label: '● Synth',  color: A   },
  { key: 'kick',  label: '● Kick',   color: A   },
  { key: 'snare', label: '— Snare',  color: B   },
  { key: 'hat',   label: '∿ Hi-Hat', color: HAT },
]

export function LaneCSection() {
  const { state, dispatch } = useApp()
  const { delay, reverb, sends } = state.laneC

  return (
    <div className="lane">
      <div className="lane-header">
        <span className="lane-tag tag-c">Lane C</span>
        <span className="lane-name">Effects — Delay + Reverb (send)</span>
        <div className="lane-mode">
          <div className="dot" style={{ background: C }} />
          Send FX
        </div>
      </div>

      {/* ── Send matrix ── */}
      <div className="section" style={{ marginBottom: 10 }}>
        <div className="section-title">Send levels — per voice</div>
        <div className="send-matrix">
          <div />
          <div className="send-header">Delay</div>
          <div className="send-header">Reverb</div>
          {VOICES.map(({ key, label, color }) => (
            <>
              <div key={`${key}-label`} className="send-voice-label" style={{ color }}>{label}</div>
              <div key={`${key}-delay`} className="send-cell">
                <Knob
                  value={sends[key].delay}
                  onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: key, patch: { delay: v } })}
                  defaultValue={0} size={28} color={C} label="Dly" valueLabel={fmt(sends[key].delay)}
                />
              </div>
              <div key={`${key}-reverb`} className="send-cell">
                <Knob
                  value={sends[key].reverb}
                  onChange={v => dispatch({ type: 'PATCH_LANE_C_SEND', voice: key, patch: { reverb: v } })}
                  defaultValue={0} size={28} color={C} label="Rvb" valueLabel={fmt(sends[key].reverb)}
                />
              </div>
            </>
          ))}
        </div>
      </div>

      {/* ── Effect controls ── */}
      <div className="two-col">
        {/* Delay */}
        <div className="section">
          <div className="section-title">Delay</div>

          {/* BPM sync chips */}
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <span
              className={`chip${delay.bpmSync ? ' chip-sel-c' : ''}`}
              onClick={() => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { bpmSync: !delay.bpmSync } })}
            >BPM</span>
            {SYNC_DIVS.map(div => (
              <span
                key={div}
                className={`chip${delay.bpmSync && delay.syncDiv === div ? ' chip-sel-c' : ''}`}
                onClick={() => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { bpmSync: true, syncDiv: div } })}
              >{div}</span>
            ))}
          </div>

          <div className="knob-row">
            {!delay.bpmSync && (
              <Knob
                value={delay.time / 2}
                onChange={v => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { time: v * 2 } })}
                defaultValue={0.2} color={C} label="Time" valueLabel={`${delay.time.toFixed(3)}s`}
              />
            )}
            <Knob value={delay.feedback}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { feedback: v } })}
              defaultValue={0.4} color={C} label="Feedback" valueLabel={fmt(delay.feedback)} />
            <Knob value={delay.tone}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { tone: v } })}
              defaultValue={0.7} color={C} label="Tone" valueLabel={fmt(delay.tone)} />
            <Knob value={delay.returnLevel}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { returnLevel: v } })}
              defaultValue={0.6} color={C} label="Return" valueLabel={fmt(delay.returnLevel)} />
          </div>
        </div>

        {/* Reverb */}
        <div className="section">
          <div className="section-title">Reverb (convolution)</div>
          <div className="knob-row">
            <Knob value={reverb.size}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_REVERB', patch: { size: v } })}
              defaultValue={0.6} color={C} label="Size" valueLabel={fmt(reverb.size)} />
            <Knob value={reverb.decay}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_REVERB', patch: { decay: v } })}
              defaultValue={0.5} color={C} label="Decay" valueLabel={fmt(reverb.decay)} />
            <Knob value={reverb.tone}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_REVERB', patch: { tone: v } })}
              defaultValue={0.6} color={C} label="Tone" valueLabel={fmt(reverb.tone)} />
            <Knob value={reverb.preDelay}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_REVERB', patch: { preDelay: v * 0.1 } })}
              defaultValue={0.2} color={C} label="Pre-dly"
              valueLabel={`${Math.round(reverb.preDelay * 1000)}ms`} />
            <Knob value={reverb.returnLevel}
              onChange={v => dispatch({ type: 'PATCH_LANE_C_REVERB', patch: { returnLevel: v } })}
              defaultValue={0.5} color={C} label="Return" valueLabel={fmt(reverb.returnLevel)} />
          </div>
          <div className="step-annotation" style={{ marginTop: 8 }}>
            IR generated algorithmically — size and decay re-build the impulse response in real time
          </div>
        </div>
      </div>
    </div>
  )
}
