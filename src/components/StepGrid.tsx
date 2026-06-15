import { useState, useEffect, useRef, useCallback } from 'react'
import { audioEngine } from '../audio/AudioEngine'

const CELLS = 16

// Reactive read-only trigger history grid.
// Pass an `onTrigger` subscription function; the grid lights up each cell
// when a trigger fires, timed to the actual audio playback moment.
interface StepGridProps {
  subscribe: (cb: (scheduledAt: number) => void) => () => void
  color: string
  cells?: number
}

export function StepGrid({ subscribe, color, cells = CELLS }: StepGridProps) {
  const [active, setActive] = useState<number>(-1)
  const posRef = useRef(0)

  const flash = useCallback((scheduledAt: number) => {
    const ctx = audioEngine.audioContext
    if (!ctx) return
    const delayMs = Math.max(0, (scheduledAt - ctx.currentTime) * 1000)
    const pos = posRef.current % cells
    posRef.current++
    setTimeout(() => setActive(pos), delayMs)
    // Dim after 120 ms
    setTimeout(() => setActive(p => p === pos ? -1 : p), delayMs + 120)
  }, [cells])

  useEffect(() => subscribe(flash), [subscribe, flash])

  return (
    <div className="steps-row">
      {Array.from({ length: cells }, (_, i) => (
        <div
          key={i}
          className="step"
          style={i === active ? {
            background: `${color}44`,
            borderColor: color,
            boxShadow: `0 0 4px ${color}88`,
          } : undefined}
        />
      ))}
    </div>
  )
}
