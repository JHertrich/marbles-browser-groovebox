import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { reducer, type Action } from './reducer'
import { DEFAULT_STATE, type AppState } from './types'
import { audioEngine } from '../audio/AudioEngine'
import { masterClock } from '../sequencer/MasterClock'
import { laneA } from '../sequencer/LaneA'
import { laneB } from '../sequencer/LaneB'

interface Ctx {
  state: AppState
  dispatch: (action: Action) => void
  startAudio: () => Promise<void>
  audioReady: boolean
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)
  const [audioReady, setAudioReady] = useReducerHelper(false)
  const prevPlaying = useRef(false)

  const startAudio = useCallback(async () => {
    await audioEngine.init()
    setAudioReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync BPM
  useEffect(() => { masterClock.bpm = state.bpm }, [state.bpm])

  // Sync play state
  useEffect(() => {
    if (!audioReady) return
    if (state.isPlaying && !prevPlaying.current) {
      masterClock.start(audioEngine.audioContext!)
      laneA.start()
      laneB.start()
    } else if (!state.isPlaying && prevPlaying.current) {
      masterClock.stop()
      laneA.stop()
      laneB.stop()
    }
    prevPlaying.current = state.isPlaying
  }, [state.isPlaying, audioReady])

  // Sync Lane A params into the sequencer objects (read on each tick)
  useEffect(() => { laneA.params.t = state.laneA.t }, [state.laneA.t])
  useEffect(() => { laneA.params.x = state.laneA.x }, [state.laneA.x])
  useEffect(() => {
    laneA.params.synth = state.laneA.synth
    if (audioReady) audioEngine.setSynthParams(state.laneA.synth)
  }, [state.laneA.synth, audioReady])

  // Sync Lane B params
  useEffect(() => {
    const { density, jitter, length, kick, snare, hat } = state.laneB
    laneB.params = { density, jitter, length, kick, snare, hat }
  }, [state.laneB])

  // Sync Lane C delay
  useEffect(() => {
    if (!audioReady) return
    const { delay } = state.laneC
    if (delay.bpmSync) {
      audioEngine.setDelayTimeFromBpm(state.bpm, delay.syncDiv)
      audioEngine.setDelayParams(0 /* ignored */, delay.feedback, delay.tone, delay.returnLevel)
    } else {
      audioEngine.setDelayParams(delay.time, delay.feedback, delay.tone, delay.returnLevel)
    }
  }, [state.laneC.delay, state.bpm, audioReady])

  // Sync Lane C reverb
  useEffect(() => {
    if (!audioReady) return
    const { reverb } = state.laneC
    audioEngine.setReverbParams(reverb.size, reverb.decay, reverb.tone, reverb.preDelay, reverb.returnLevel)
  }, [state.laneC.reverb, audioReady])

  // Sync voice enabled state (mute gains)
  useEffect(() => {
    if (!audioReady) return
    audioEngine.setVoiceEnabled('synth', state.laneA.synthEnabled)
  }, [state.laneA.synthEnabled, audioReady])

  useEffect(() => {
    if (!audioReady) return
    audioEngine.setVoiceEnabled('kick',  state.laneB.kick.enabled)
    audioEngine.setVoiceEnabled('snare', state.laneB.snare.enabled)
    audioEngine.setVoiceEnabled('hat',   state.laneB.hat.enabled)
  }, [state.laneB.kick.enabled, state.laneB.snare.enabled, state.laneB.hat.enabled, audioReady])

  // Sync Lane C send levels
  useEffect(() => {
    if (!audioReady) return
    const { sends } = state.laneC
    ;(['synth', 'kick', 'snare', 'hat'] as const).forEach(v => {
      audioEngine.setSendLevel(v, 'delay', sends[v].delay)
      audioEngine.setSendLevel(v, 'reverb', sends[v].reverb)
    })
  }, [state.laneC.sends, audioReady])

  // Preset save / load via localStorage
  const save = useCallback(() => {
    localStorage.setItem('groovebox-preset', JSON.stringify(state))
  }, [state])

  const load = useCallback(() => {
    const raw = localStorage.getItem('groovebox-preset')
    if (raw) dispatch({ type: 'LOAD_PRESET', state: JSON.parse(raw) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose save/load on window for Transport buttons (avoids prop drilling)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__gb_save = save;
    (window as unknown as Record<string, unknown>).__gb_load = load
  }, [save, load])

  return (
    <AppContext.Provider value={{ state, dispatch, startAudio, audioReady }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

// Minimal useState-like helper to avoid an extra import
function useReducerHelper<T>(initial: T): [T, (v: T) => void] {
  const [v, setV] = useReducer((_: T, next: T) => next, initial)
  return [v, setV]
}
