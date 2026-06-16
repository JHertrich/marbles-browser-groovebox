import { Transport } from './components/Transport'
import { RecorderBar } from './components/RecorderBar'
import { LaneASection } from './components/LaneASection'
import { LaneBSection } from './components/LaneBSection'
import { LaneDSection } from './components/LaneDSection'
import { FxSection } from './components/FxSection'
import { ModSection } from './components/ModSection'

export default function App() {
  return (
    <div className="groovebox">
      <Transport />
      <RecorderBar />
      <LaneASection />
      <LaneBSection />
      <LaneDSection />
      <FxSection />
      <ModSection />
    </div>
  )
}
