import { useApp } from '../state/AppContext'
import { laneA } from '../sequencer/LaneA'
import { laneB } from '../sequencer/LaneB'
import { laneD } from '../sequencer/LaneD'

export function Transport() {
  const { state, dispatch, startAudio, audioReady } = useApp()
  const { bpm, isPlaying } = state

  const handlePlay = async () => {
    if (!audioReady) await startAudio()
    dispatch({ type: 'SET_PLAYING', value: !isPlaying })
  }

  const handleReset = () => {
    dispatch({ type: 'SET_PLAYING', value: false })
    dispatch({ type: 'RESET' })
    laneA.reset(); laneB.reset()
  }

  const handleRandomize = () => {
    dispatch({ type: 'RANDOMIZE' })
    laneA.reseed(); laneA.reset()
    laneB.reseed(); laneB.reset()
    laneD.reseed(); laneD.reset()
  }

  const handleSave = () => (window as never as Record<string, () => void>).__gb_save?.()
  const handleLoad = () => (window as never as Record<string, () => void>).__gb_load?.()

  return (
    <div className="transport">
      <div className="transport-left">
        <span className="app-title">Groovebox</span>
        <div className="bpm-group">
          <span className="bpm-value">{bpm}</span>
          <span className="bpm-label">BPM</span>
        </div>
        <input
          type="range" min={60} max={200} value={bpm}
          onChange={e => dispatch({ type: 'SET_BPM', value: Number(e.target.value) })}
          style={{ width: 100 }}
        />
      </div>
      <div className="transport-btns">
        <button className="btn" onClick={handleReset}>RST</button>
        <button className={`btn btn-play${isPlaying ? ' btn-stop' : ''}`} onClick={handlePlay}>
          {isPlaying ? '■ STOP' : '▶ RUN'}
        </button>
        <button className="btn btn-rnd" onClick={handleRandomize}>⚄ RANDOM</button>
        <button className="btn" onClick={handleSave}>SAVE</button>
        <button className="btn" onClick={handleLoad}>LOAD</button>
      </div>
    </div>
  )
}
