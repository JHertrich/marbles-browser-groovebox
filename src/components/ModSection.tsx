import { useRef, useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { lfoEngine } from '../audio/LFOEngine'
import { Knob } from './Knob'
import type { ModDest, LFOWaveform, LFOSyncDiv } from '../state/types'

const LFO_COLORS = [
  'var(--accent-a)',
  'var(--accent-b)',
  'var(--accent-c)',
  'var(--accent-d)',
] as const

const WAVEFORMS: { id: LFOWaveform; label: string }[] = [
  { id: 'sine',        label: '∿' },
  { id: 'triangle',    label: '△' },
  { id: 'square',      label: '⊓' },
  { id: 'sample-hold', label: 'S/H' },
]

const SYNC_DIVS: LFOSyncDiv[] = ['4/1', '2/1', '1/1', '1/2', '1/4', '1/8', '1/16']

// ─── Destination groups shown in the matrix ──────────────────────────────────
const DEST_GROUPS: { label: string; dests: [ModDest, string][] }[] = [
  {
    label: 'Lane A — Synth',
    dests: [
      ['synth.timbre',    'Timbre'],
      ['synth.morph',     'Morph'],
      ['synth.harmonics', 'Harmonics'],
      ['synth.decay',     'Decay'],
      ['synth.level',     'Level'],
    ],
  },
  {
    label: 'Lane A — Timing',
    dests: [
      ['laneA.jitter', 'Jitter'],
      ['laneA.bias',   'Bias'],
    ],
  },
  {
    label: 'Lane B — Rhythm',
    dests: [
      ['laneB.density', 'Density'],
      ['laneB.jitter',  'Jitter'],
    ],
  },
  {
    label: 'Lane B — Kick',
    dests: [
      ['kick.snap',  'Snap'],
      ['kick.decay', 'Decay'],
    ],
  },
  {
    label: 'Lane B — Snare',
    dests: [
      ['snare.snap',  'Snap'],
      ['snare.tone',  'Tone'],
      ['snare.body',  'Body'],
      ['snare.decay', 'Decay'],
    ],
  },
  {
    label: 'Lane B — Hi-Hat',
    dests: [
      ['hat.open', 'Open'],
      ['hat.tone', 'Tone'],
    ],
  },
  {
    label: 'Lane C — Granular',
    dests: [
      ['gran.position', 'Position'],
      ['gran.size',     'Size'],
      ['gran.density',  'Density'],
      ['gran.pitch',    'Pitch'],
      ['gran.spray',    'Spray'],
      ['gran.detune',   'Detune'],
      ['gran.wander',   'Wander'],
      ['gran.level',    'Level'],
    ],
  },
  {
    label: 'Lane C — Timing',
    dests: [
      ['laneD.jitter', 'Jitter'],
      ['laneD.bias',   'Bias'],
    ],
  },
  {
    label: 'FX — Delay',
    dests: [
      ['delay.feedback', 'Feedback'],
      ['delay.time',     'Time'],
    ],
  },
  {
    label: 'FX — Reverb',
    dests: [
      ['reverb.size',  'Size'],
      ['reverb.decay', 'Decay'],
      ['reverb.level', 'Level'],
    ],
  },
]

// ─── LFO phase gauge ─────────────────────────────────────────────────────────
function LFOGauge({ index, color }: { index: number; color: string }) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const fillRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf: number
    const update = () => {
      const values = lfoEngine.getValues()
      const raw    = values[index] ?? 0  // -depth..+depth
      // Phase isn't exposed — approximate from raw value for visual
      if (cursorRef.current) {
        // Map raw [-1,1] to horizontal position [0,100%]
        cursorRef.current.style.left = `${(raw * 0.5 + 0.5) * 100}%`
      }
      if (fillRef.current) {
        const pct = Math.abs(raw) * 50
        if (raw >= 0) {
          fillRef.current.style.left  = '50%'
          fillRef.current.style.width = `${pct}%`
        } else {
          fillRef.current.style.left  = `${50 - pct}%`
          fillRef.current.style.width = `${pct}%`
        }
      }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [index])

  return (
    <div className="lfo-gauge">
      <div className="lfo-gauge-center" />
      <div className="lfo-gauge-fill" ref={fillRef} style={{ background: color }} />
      <div className="lfo-gauge-cursor" ref={cursorRef} style={{ background: color }} />
    </div>
  )
}

// ─── Single LFO panel ────────────────────────────────────────────────────────
function LFOPanel({ index }: { index: number }) {
  const { state, dispatch, audioReady } = useApp()
  const lfo   = state.mod.lfos[index as 0|1|2|3]
  const color = LFO_COLORS[index]

  const freeHz = (0.05 * Math.pow(200, lfo.rate)).toFixed(2)

  return (
    <div className="lfo-panel" style={{ '--lfo-color': color } as React.CSSProperties}>
      <div className="lfo-panel-header" style={{ color }}>LFO {index + 1}</div>

      {/* Waveform selector */}
      <div className="lfo-waveform-row">
        {WAVEFORMS.map(w => (
          <button
            key={w.id}
            className={`lfo-wbtn${lfo.waveform === w.id ? ' lfo-wbtn-on' : ''}`}
            style={lfo.waveform === w.id ? { borderColor: color, color } : {}}
            onClick={() => dispatch({ type: 'PATCH_LFO', index: index as 0|1|2|3, patch: { waveform: w.id } })}
          >{w.label}</button>
        ))}
      </div>

      {/* Rate + sync */}
      <div className="lfo-rate-row">
        <button
          className={`lfo-sync-btn${lfo.synced ? ' lfo-sync-on' : ''}`}
          style={lfo.synced ? { borderColor: color, color } : {}}
          onClick={() => dispatch({ type: 'PATCH_LFO', index: index as 0|1|2|3, patch: { synced: !lfo.synced } })}
        >SYNC</button>
        {lfo.synced ? (
          <select
            className="lfo-div-select"
            value={lfo.syncDiv}
            onChange={e => dispatch({ type: 'PATCH_LFO', index: index as 0|1|2|3, patch: { syncDiv: e.target.value as LFOSyncDiv } })}
          >
            {SYNC_DIVS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Knob value={lfo.rate}
              onChange={v => dispatch({ type: 'PATCH_LFO', index: index as 0|1|2|3, patch: { rate: v } })}
              defaultValue={0.3} size={28} color={color} label="Rate" valueLabel={`${freeHz}Hz`} />
          </div>
        )}
      </div>

      {/* Depth */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <Knob value={lfo.depth}
          onChange={v => dispatch({ type: 'PATCH_LFO', index: index as 0|1|2|3, patch: { depth: v } })}
          defaultValue={0.5} size={28} color={color} label="Depth" valueLabel={lfo.depth.toFixed(2)} />
      </div>

      {/* Animated value gauge */}
      {audioReady && <LFOGauge index={index} color={color} />}
    </div>
  )
}

// ─── Matrix cell ─────────────────────────────────────────────────────────────
function MatrixCell({ lfoIndex, dest }: { lfoIndex: number; dest: ModDest }) {
  const { state, dispatch } = useApp()
  const slot = state.mod.slots.find(s => s.lfoIndex === lfoIndex && s.dest === dest)
  const color = LFO_COLORS[lfoIndex]

  if (!slot) {
    return (
      <div
        className="mcell mcell-empty"
        title={`Add LFO ${lfoIndex + 1} → ${dest}`}
        onClick={() => dispatch({ type: 'SET_MOD_SLOT', lfoIndex: lfoIndex as 0|1|2|3, dest, amount: 1 })}
      />
    )
  }

  // amount -1..1 stored as knob value 0..1 (center=0)
  const knobVal = (slot.amount + 1) / 2
  const amtLabel = (slot.amount >= 0 ? '+' : '') + slot.amount.toFixed(2)

  return (
    <div className="mcell mcell-active" style={{ '--mc': color } as React.CSSProperties}>
      <Knob
        value={knobVal}
        onChange={v => dispatch({ type: 'SET_MOD_SLOT', lfoIndex: lfoIndex as 0|1|2|3, dest, amount: v * 2 - 1 })}
        defaultValue={1}
        size={22}
        color={color}
        valueLabel={amtLabel}
      />
      <button
        className="mcell-remove"
        title="Remove"
        onClick={() => dispatch({ type: 'REMOVE_MOD_SLOT', lfoIndex: lfoIndex as 0|1|2|3, dest })}
      >×</button>
    </div>
  )
}

// ─── Full modulation section ──────────────────────────────────────────────────
export function ModSection() {
  const { dispatch } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="lane mod-section">
      <div className="lane-header" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span className="lane-tag tag-mod">MOD</span>
        <span className="lane-name">LFO Modulation Matrix</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </div>

      {open && (
        <div className="mod-body">
          {/* LFO panels */}
          <div className="mod-sub-header">
            <span className="mod-sub-title">LFOs</span>
            <button className="btn-voice-rnd" title="Randomize LFO parameters"
              onClick={() => dispatch({ type: 'RANDOMIZE_LFOS' })}>⚄</button>
          </div>
          <div className="lfo-panels">
            {[0, 1, 2, 3].map(i => <LFOPanel key={i} index={i} />)}
          </div>

          {/* Modulation matrix */}
          <div className="mod-sub-header" style={{ marginTop: 12 }}>
            <span className="mod-sub-title">Matrix</span>
            <button className="btn-voice-rnd" title="Randomize mod routing and amounts"
              onClick={() => dispatch({ type: 'RANDOMIZE_MOD_SLOTS' })}>⚄</button>
          </div>
          <div className="mod-matrix">
            {/* Header row */}
            <div className="mrow mrow-header">
              <div className="mrow-label" />
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="mcol-head" style={{ color: LFO_COLORS[i] }}>L{i + 1}</div>
              ))}
            </div>

            {DEST_GROUPS.map(group => (
              <div key={group.label}>
                <div className="mgroup-label">{group.label}</div>
                {group.dests.map(([dest, label]) => (
                  <div key={dest} className="mrow">
                    <div className="mrow-label">{label}</div>
                    {[0, 1, 2, 3].map(li => (
                      <MatrixCell key={li} lfoIndex={li} dest={dest} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
