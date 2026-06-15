import { useApp } from '../state/AppContext'
import { Knob } from './Knob'
import type { SyncDiv } from '../state/types'

const C = 'var(--accent-c)'
const fmt = (v: number) => v.toFixed(2)

const SYNC_DIVS: SyncDiv[] = ['1/8', '3/16', '1/4', '3/8', '1/2']

export function FxSection() {
  const { state, dispatch } = useApp()
  const { delay, reverb } = state.laneC

  return (
    <div className="two-col" style={{ marginBottom: 12 }}>
      {/* Delay */}
      <div className="section">
        <div className="section-title">Delay — global</div>
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
          <Knob value={delay.feedback / 0.85}
            onChange={v => dispatch({ type: 'PATCH_LANE_C_DELAY', patch: { feedback: v * 0.85 } })}
            defaultValue={0.4 / 0.85} color={C} label="Feedback" valueLabel={fmt(delay.feedback)} />
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
        <div className="section-title">Reverb — global</div>
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
      </div>
    </div>
  )
}
