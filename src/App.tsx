import { Transport } from './components/Transport'
import { LaneASection } from './components/LaneASection'
import { LaneBSection } from './components/LaneBSection'
import { LaneDSection } from './components/LaneDSection'
import { FxSection } from './components/FxSection'
import { ModSection } from './components/ModSection'

export default function App() {
  return (
    <div className="groovebox">
      <Transport />
      <LaneASection />
      <LaneBSection />
      <LaneDSection />
      <FxSection />
      <ModSection />
    </div>
  )
}
