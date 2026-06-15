import { Transport } from './components/Transport'
import { LaneASection } from './components/LaneASection'
import { LaneBSection } from './components/LaneBSection'
import { FxSection } from './components/FxSection'

export default function App() {
  return (
    <div className="groovebox">
      <Transport />
      <LaneASection />
      <LaneBSection />
      <FxSection />
    </div>
  )
}
