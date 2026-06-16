import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../state/AppContext'
import { audioEngine } from '../audio/AudioEngine'

type RecState = 'idle' | 'recording' | 'stopped'

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

function fmtTime(secs: number): string {
  if (!isFinite(secs) || isNaN(secs)) return '--:--.--'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

// Decode the recorded blob and encode as 16-bit stereo PCM WAV.
async function toWAV(blobUrl: string, ctx: AudioContext): Promise<Blob> {
  const ab  = await (await fetch(blobUrl)).arrayBuffer()
  const buf = await ctx.decodeAudioData(ab)
  const numCh = Math.min(buf.numberOfChannels, 2)
  const sr  = buf.sampleRate
  const len = buf.length
  const out = new ArrayBuffer(44 + len * numCh * 2)
  const v   = new DataView(out)
  const ws  = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * numCh * 2, true); ws(8, 'WAVE')
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * numCh * 2, true)
  v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, len * numCh * 2, true)
  const chs = Array.from({ length: numCh }, (_, i) => buf.getChannelData(i))
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, chs[ch][i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function RecorderBar() {
  const { audioReady } = useApp()

  const [recState,  setRecState]  = useState<RecState>('idle')
  const [elapsed,   setElapsed]   = useState(0)
  const [blobUrl,   setBlobUrl]   = useState<string | null>(null)
  const [duration,  setDuration]  = useState(0)
  const [playTime,  setPlayTime]  = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [exporting, setExporting] = useState(false)

  const mrRef       = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<number | null>(null)
  const startRef    = useRef(0)
  const elapsedRef  = useRef(0)
  const audioRef    = useRef<HTMLAudioElement>(null)

  // Revoke old blob URL when it changes
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  const startRecording = useCallback(async () => {
    if (!audioReady) return
    const stream = audioEngine.recordingStream
    if (!stream) return

    // Discard previous recording
    setBlobUrl(null)
    setElapsed(0)
    setPlayTime(0)
    setDuration(0)
    setPlaying(false)
    chunksRef.current = []
    elapsedRef.current = 0

    const mimeType = getSupportedMimeType()
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      setBlobUrl(URL.createObjectURL(blob))
      setDuration(elapsedRef.current)
      setRecState('stopped')
    }

    mr.start(100)
    mrRef.current = mr
    startRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000
      elapsedRef.current = e
      setElapsed(e)
    }, 100)
    setRecState('recording')
  }, [audioReady])

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mrRef.current?.stop()
  }, [])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else         { el.play();  setPlaying(true)  }
  }, [playing])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setPlayTime(t)
  }, [])

  const handleDownloadWAV = useCallback(async () => {
    if (!blobUrl || !audioEngine.audioContext) return
    setExporting(true)
    try {
      const wav = await toWAV(blobUrl, audioEngine.audioContext)
      triggerDownload(wav, 'groovebox.wav')
    } catch (err) {
      console.error('WAV export failed', err)
    } finally {
      setExporting(false)
    }
  }, [blobUrl])

  // Keep seek bar synced with playback position
  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) setPlayTime(audioRef.current.currentTime)
  }, [])

  const onLoadedMetadata = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    // webm blobs from MediaRecorder often lack a duration header → audio.duration is Infinity
    if (isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    // else keep elapsedRef.current already set in onstop
  }, [])

  const onEnded = useCallback(() => setPlaying(false), [])

  const discardTake = useCallback(() => {
    audioRef.current?.pause()
    setBlobUrl(null)
    setRecState('idle')
    setElapsed(0)
    setDuration(0)
    setPlayTime(0)
    setPlaying(false)
  }, [])

  if (!audioReady) return null

  const isRecording = recState === 'recording'
  const hasTake     = recState === 'stopped' && blobUrl !== null

  return (
    <div className="rec-bar">
      {/* ── REC / STOP button ── */}
      <button
        className={`rec-btn${isRecording ? ' rec-btn-active' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? '■ STOP REC' : '● REC'}
      </button>

      {/* ── Timer while recording ── */}
      {isRecording && (
        <span className="rec-time">{fmtTime(elapsed)}</span>
      )}

      {/* ── Playback strip ── */}
      {hasTake && (
        <>
          <audio
            ref={audioRef}
            src={blobUrl!}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onEnded}
          />

          <button className="rec-play-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>

          <div className="rec-seek-wrap">
            <input
              type="range"
              className="rec-seek"
              min={0}
              max={isFinite(duration) && duration > 0 ? duration : 1}
              step={0.01}
              value={playTime}
              onChange={handleSeek}
            />
          </div>

          <span className="rec-time">
            {fmtTime(playTime)} / {fmtTime(duration)}
          </span>

          <button
            className="rec-dl-btn"
            onClick={handleDownloadWAV}
            disabled={exporting}
            title="Download WAV"
          >
            {exporting ? '…' : '⬇ WAV'}
          </button>

          <button
            className="rec-discard-btn"
            onClick={discardTake}
            title="Discard recording"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}
