import { Transport } from './components/Transport'
import { LaneASection } from './components/LaneASection'
import { LaneBSection } from './components/LaneBSection'
import { FxSection } from './components/FxSection'
import { useApp } from './state/AppContext'
import { laneA } from './sequencer/LaneA'
import { laneB } from './sequencer/LaneB'

export default function App() {
  const { dispatch } = useApp()
  const w = window as never as Record<string, () => void>

  return (
    <div className="groovebox">
      <Transport />
      <LaneASection />
      <LaneBSection />
      <FxSection />
      <div className="footer">
        <button className="btn" onClick={() => w.__gb_save?.()}>💾 Save preset</button>
        <button className="btn" onClick={() => w.__gb_load?.()}>📂 Load preset</button>
        <button className="btn btn-rnd" onClick={() => {
          dispatch({ type: 'RANDOMIZE' })
          laneA.reseed(); laneA.reset()
          laneB.reseed(); laneB.reset()
        }}>⚄ Randomize all</button>
      </div>
    </div>
  )
}
