import { useState, useCallback, useEffect, useRef } from 'react'
import { audioEngine } from './audio/AudioEngine'
import { masterClock } from './sequencer/MasterClock'
import { laneA } from './sequencer/LaneA'
import { laneB } from './sequencer/LaneB'
import { midiToName } from './sequencer/scales'
import './styles/test.css'

const CELLS = 16

function useStepHistory(size = CELLS) {
  const [cells, setCells] = useState<boolean[]>(new Array(size).fill(false))
  const posRef = useRef(0)

  const flash = useCallback((scheduledAt: number) => {
    const ctx = audioEngine.audioContext
    if (!ctx) return
    const delayMs = Math.max(0, (scheduledAt - ctx.currentTime) * 1000)
    setTimeout(() => {
      const pos = posRef.current % size
      posRef.current++
      setCells(prev => prev.map((_, i) => i === pos))
    }, delayMs)
  }, [size])

  return { cells, flash }
}

function StepGrid({ cells, color }: { cells: boolean[]; color: string }) {
  return (
    <div className="step-grid">
      {cells.map((active, i) => (
        <div
          key={i}
          className="step-cell"
          style={active ? {
            background: color,
            borderColor: color,
            boxShadow: `0 0 6px ${color}`,
            opacity: 0.9,
          } : undefined}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [ready, setReady]   = useState(false)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('Click "Start Audio" to initialise the engine.')
  const [bpm, setBpm]       = useState(120)
  const [lastNote, setLastNote] = useState('—')

  const synthHist  = useStepHistory()
  const kickHist   = useStepHistory()
  const snareHist  = useStepHistory()
  const hatHist    = useStepHistory()

  const start = useCallback(async () => {
    try {
      setStatus('Loading WASM…')
      await audioEngine.init()
      setReady(true)
      setStatus('Engine ready.')
    } catch (err) {
      setStatus(`Error: ${err}`)
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    const unsubA = laneA.onTrigger((_step, midiNote, scheduledAt) => {
      const ctx = audioEngine.audioContext
      if (!ctx) return
      const delayMs = Math.max(0, (scheduledAt - ctx.currentTime) * 1000)
      setTimeout(() => setLastNote(midiToName(midiNote)), delayMs)
      synthHist.flash(scheduledAt)
    })

    const unsubB = laneB.onTrigger((voice, _step, scheduledAt) => {
      if (voice === 'kick')  kickHist.flash(scheduledAt)
      if (voice === 'snare') snareHist.flash(scheduledAt)
      if (voice === 'hat')   hatHist.flash(scheduledAt)
    })

    return () => { unsubA(); unsubB() }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = useCallback(() => {
    if (!ready) return
    if (playing) {
      masterClock.stop()
      laneA.stop()
      laneB.stop()
      setPlaying(false)
    } else {
      masterClock.bpm = bpm
      masterClock.start(audioEngine.audioContext!)
      laneA.start()
      laneB.start()
      setPlaying(true)
    }
  }, [ready, playing, bpm])

  const handleBpm = useCallback((v: number) => {
    setBpm(v)
    masterClock.bpm = v
  }, [])

  const handleReseed = useCallback(() => {
    laneA.reseed(); laneA.reset()
    laneB.reseed(); laneB.reset()
  }, [])

  return (
    <div className="test-shell">
      <h1 className="test-title">Groovebox — Phase 4 · Both lanes running</h1>
      <p className="test-status">{status}</p>

      {!ready && (
        <button className="btn-start" onClick={start}>▶ Start Audio</button>
      )}

      {ready && (
        <div className="test-grid">

          {/* Transport */}
          <div className="test-section">
            <h2>Transport</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className={`btn-play${playing ? ' btn-stop' : ''}`} onClick={togglePlay}>
                {playing ? '■ Stop' : '▶ Play'}
              </button>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{bpm}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>BPM</span>
                <input type="range" min={60} max={200} value={bpm}
                  onChange={e => handleBpm(Number(e.target.value))} style={{ width: 100 }} />
              </div>
              <button className="btn-plain" onClick={handleReseed}>⚄ Reseed all</button>
            </div>
          </div>

          {/* Lane A */}
          <div className="test-section">
            <h2 style={{ color: 'var(--accent-a-pale)' }}>Lane A — Synth · Marbles FM (C Dorian)</h2>
            <StepGrid cells={synthHist.cells} color="var(--accent-a)" />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Last note:{' '}
              <span style={{ color: 'var(--accent-a-pale)', fontWeight: 600 }}>{lastNote}</span>
              {'  ·  '}
              rate÷{laneA.params.t.rate} · bias {laneA.params.t.bias} · dejaVu(t) {laneA.params.t.dejaVu} · dejaVu(x) {laneA.params.x.dejaVu}
            </p>
          </div>

          {/* Lane B */}
          <div className="test-section">
            <h2 style={{ color: 'var(--accent-b-pale)' }}>Lane B — Drums · density {laneB.params.density} · jitter {laneB.params.jitter}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <p className="drum-label" style={{ color: 'var(--accent-a)' }}>
                  ● Kick — bias {laneB.params.kick.bias} · dejaVu {laneB.params.kick.dejaVu}
                </p>
                <StepGrid cells={kickHist.cells} color="var(--accent-a)" />
              </div>
              <div>
                <p className="drum-label" style={{ color: 'var(--accent-b)' }}>
                  — Snare — bias {laneB.params.snare.bias} · dejaVu {laneB.params.snare.dejaVu}
                </p>
                <StepGrid cells={snareHist.cells} color="var(--accent-b)" />
              </div>
              <div>
                <p className="drum-label" style={{ color: 'var(--accent-hat)' }}>
                  ∿ Hi-Hat — bias {laneB.params.hat.bias} · dejaVu {laneB.params.hat.dejaVu}
                </p>
                <StepGrid cells={hatHist.cells} color="var(--accent-hat)" />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
