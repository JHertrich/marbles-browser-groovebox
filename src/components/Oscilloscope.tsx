import { useEffect, useRef } from 'react'

interface OscilloscopeProps {
  analyser: AnalyserNode | null
  color?: string
  height?: number
  label?: string
}

export function Oscilloscope({ analyser, color = '#7f77dd', height = 40, label = 'Oscilloscope' }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return
    const node = analyser
    const ctx2d = canvas.getContext('2d')!
    const buf = new Uint8Array(node.frequencyBinCount)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      node.getByteTimeDomainData(buf)

      const w = canvas!.width
      const h = canvas!.height
      ctx2d.clearRect(0, 0, w, h)
      ctx2d.beginPath()
      ctx2d.strokeStyle = color
      ctx2d.lineWidth = 1.5

      const step = w / buf.length
      for (let i = 0; i < buf.length; i++) {
        const y = ((buf[i] / 128) - 1) * (h / 2) + h / 2
        if (i === 0) ctx2d.moveTo(0, y)
        else ctx2d.lineTo(i * step, y)
      }
      ctx2d.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, color])

  return (
    <div className="oscilloscope" style={{ height }}>
      <span className="osc-label">{label}</span>
      <canvas
        ref={canvasRef}
        width={600}
        height={height * 2}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.85 }}
      />
    </div>
  )
}
