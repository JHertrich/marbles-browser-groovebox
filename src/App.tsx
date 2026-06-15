import { useState, useCallback, useEffect, useRef } from 'react'
import { audioEngine } from './audio/AudioEngine'
import { masterClock } from './sequencer/MasterClock'
import { laneA } from './sequencer/LaneA'
import { midiToName } from './sequencer/scales'
import './styles/test.css'

const HISTORY_CELLS = 16

export default function App() {
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('Click "Start Audio" to initialise the engine.')
  const [lastNote, setLastNote] = useState('—')
  const [bpm, setBpm] = useState(120)

  // Trigger history: array of { fired, active } for the last HISTORY_CELLS evaluations
  const [history, setHistory] = useState<boolean[]>(new Array(HISTORY_CELLS).fill(false))
  const historyRef = useRef<boolean[]>(new Array(HISTORY_CELLS).fill(false))
  const historyPosRef = useRef(0)

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

  // Subscribe to Lane A triggers once the engine is ready
  useEffect(() => {
    if (!ready) return
    const unsub = laneA.onTrigger((_step, midiNote, scheduledAt) => {
      const ctx = audioEngine.audioContext
      if (!ctx) return
      const delayMs = Math.max(0, (scheduledAt - ctx.currentTime) * 1000)

      // Update UI when the note actually plays (not when it's scheduled)
      setTimeout(() => {
        setLastNote(midiToName(midiNote))

        const pos = historyPosRef.current % HISTORY_CELLS
        historyRef.current = historyRef.current.map((_, i) => i === pos)
        historyPosRef.current++
        setHistory([...historyRef.current])
      }, delayMs)
    })
    return unsub
  }, [ready])

  const togglePlay = useCallback(() => {
    if (!ready) return
    if (playing) {
      masterClock.stop()
      laneA.stop()
      setPlaying(false)
    } else {
      masterClock.bpm = bpm
      masterClock.start(audioEngine.audioContext!)
      laneA.start()
      setPlaying(true)
    }
  }, [ready, playing, bpm])

  const handleBpm = useCallback((v: number) => {
    setBpm(v)
    masterClock.bpm = v
  }, [])

  const handleReseed = useCallback(() => {
    laneA.reseed()
    laneA.reset()
  }, [])

  return (
    <div className="test-shell">
      <h1 className="test-title">Groovebox — Phase 3 · Marbles sequencer</h1>
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
              <button
                className={`btn-play${playing ? ' btn-stop' : ''}`}
                onClick={togglePlay}
              >
                {playing ? '■ Stop' : '▶ Play'}
              </button>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{bpm}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>BPM</span>
                <input
                  type="range" min={60} max={200} value={bpm}
                  onChange={e => handleBpm(Number(e.target.value))}
                  style={{ width: 100 }}
                />
              </div>

              <button className="btn-plain" onClick={handleReseed}>⚄ Reseed</button>
            </div>
          </div>

          {/* Trigger history */}
          <div className="test-section">
            <h2>Lane A — trigger history (Marbles t-section)</h2>
            <div className="step-grid">
              {history.map((active, i) => (
                <div
                  key={i}
                  className={`step-cell${active ? ' step-active' : ''}`}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Last note: <span style={{ color: 'var(--accent-a-pale)', fontWeight: 600 }}>
                {lastNote}
              </span>
            </p>
          </div>

          {/* Params summary */}
          <div className="test-section">
            <h2>Lane A params (defaults)</h2>
            <pre style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
{`t: rate÷${laneA.params.t.rate}  jitter ${laneA.params.t.jitter}  bias ${laneA.params.t.bias}  dejaVu ${laneA.params.t.dejaVu}  len ${laneA.params.t.length}
x: spread ${laneA.params.x.spread}  bias ${laneA.params.x.bias}  steps ${laneA.params.x.steps}  dejaVu ${laneA.params.x.dejaVu}
   scale: ${laneA.params.x.root} ${laneA.params.x.mode}
synth: engine ${laneA.params.synth.engine} (FM)  timbre ${laneA.params.synth.timbre}  morph ${laneA.params.synth.morph}`}
            </pre>
          </div>

        </div>
      )}
    </div>
  )
}
