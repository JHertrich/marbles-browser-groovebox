import { useEffect, useRef } from 'react'

interface PeakMeterProps {
  analyser: AnalyserNode | null
  color?: string
}

export function PeakMeter({ analyser, color = 'var(--accent-b)' }: PeakMeterProps) {
  const fillRef = useRef<HTMLDivElement>(null)
  const rafRef  = useRef<number>(0)

  useEffect(() => {
    const fill = fillRef.current
    if (!fill || !analyser) return
    const node = analyser
    const buf = new Uint8Array(node.frequencyBinCount)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      node.getByteFrequencyData(buf)
      let peak = 0
      for (let i = 0; i < buf.length; i++) if (buf[i] > peak) peak = buf[i]
      fill!.style.height = `${(peak / 255) * 100}%`
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <div className="meter-bar" style={{ height: 24 }}>
      <div ref={fillRef} className="meter-fill" style={{ background: color, height: '0%' }} />
    </div>
  )
}
