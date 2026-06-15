import { useRef, useCallback } from 'react'

interface KnobProps {
  value: number           // 0–1 normalised
  onChange: (v: number) => void
  defaultValue?: number   // double-click resets to this
  size?: number           // px diameter (default 38, small = 28)
  color?: string          // accent colour
  label?: string
  valueLabel?: string
  modulated?: boolean     // show LFO-active indicator ring
}

const START_DEG = -135   // 7 o'clock relative to top
const RANGE_DEG = 270    // total travel
const DRAG_PX   = 150   // pixels for full 0→1 travel

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * (Math.PI / 180)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function arc(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const [sx, sy] = polar(cx, cy, r, a1)
  const [ex, ey] = polar(cx, cy, r, a2)
  const large = (a2 - a1 > 180) ? 1 : 0
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
}

export function Knob({
  value,
  onChange,
  defaultValue = 0.5,
  size = 38,
  color = 'var(--accent-a)',
  label,
  valueLabel,
  modulated = false,
}: KnobProps) {
  const drag = useRef<{ y0: number; v0: number } | null>(null)
  const cx = size / 2
  const cy = size / 2
  const r  = size / 2 - 3
  const sw = size >= 34 ? 2.5 : 2

  const endDeg = START_DEG + value * RANGE_DEG
  const trackPath = arc(cx, cy, r, START_DEG, START_DEG + RANGE_DEG)
  const valuePath = value > 0.001 ? arc(cx, cy, r, START_DEG, endDeg) : null
  const [dotX, dotY] = polar(cx, cy, r, endDeg)

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y0: e.clientY, v0: value }
  }, [value])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const delta = (drag.current.y0 - e.clientY) / DRAG_PX
    onChange(Math.max(0, Math.min(1, drag.current.v0 + delta)))
  }, [onChange])

  const onPointerUp = useCallback(() => { drag.current = null }, [])

  return (
    <div className="knob-group">
      <svg
        width={size} height={size}
        style={{ cursor: 'ns-resize', userSelect: 'none', touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => onChange(defaultValue)}
      >
        {/* background track */}
        <path d={trackPath} fill="none" stroke="var(--bg-element)" strokeWidth={sw} strokeLinecap="round" />
        {/* value fill */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        )}
        {/* position dot */}
        <circle cx={dotX} cy={dotY} r={sw * 0.7} fill={color} />
        {/* centre circle */}
        <circle cx={cx} cy={cy} r={size * 0.12} fill="var(--bg-section)" stroke="var(--border-hover)" strokeWidth={0.5} />
        {/* LFO modulation indicator — dashed outer ring */}
        {modulated && (
          <circle cx={cx} cy={cy} r={r + sw + 1.5} fill="none" stroke={color} strokeWidth={1}
            strokeOpacity={0.7} strokeDasharray="3 3" />
        )}
      </svg>
      {label      && <span className="knob-label">{label}</span>}
      {valueLabel !== undefined && <span className="knob-val">{valueLabel}</span>}
    </div>
  )
}
