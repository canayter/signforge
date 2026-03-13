import { useRef, useState, useCallback } from 'react'
import Camera from './components/Camera'
import ConfidenceMeter from './components/ConfidenceMeter'
import SignHistory from './components/SignHistory'
import LanguageSelector from './components/LanguageSelector'
import InfoSections from './components/InfoSections'
import TextToSign from './components/TextToSign'
import { useMediaPipe } from './hooks/useMediaPipe'
import { useONNXInference } from './hooks/useONNXInference'
import { useTranslation } from './hooks/useTranslation'
import type { SignLanguage, Landmark } from './types'

const MODEL_STATUS_LABELS = {
  idle:    'No model loaded',
  loading: 'Loading model…',
  ready:   'Model ready',
  error:   'Model failed to load',
}

export default function App() {
  const [language, setLanguage] = useState<SignLanguage>('ASL')
  const [isStarted, setIsStarted] = useState(false)
  const [mode, setMode] = useState<'interpret' | 'translate'>('interpret')

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Inference ──────────────────────────────────────────────────────────────
  const {
    prediction,
    modelStatus,
    feedFrame,
    stabilizedSign,
  } = useONNXInference({ language })

  // ── Translation ────────────────────────────────────────────────────────────
  const {
    history,
    pendingSigns,
    isTranslating,
    addSign,
    translateNow,
    clearHistory,
  } = useTranslation(language)

  // When a sign stabilizes, push it into the translation buffer
  const lastStabilizedRef = useRef<string | null>(null)
  if (stabilizedSign && stabilizedSign !== lastStabilizedRef.current) {
    lastStabilizedRef.current = stabilizedSign
    addSign(stabilizedSign)
  }

  // ── Frame handler (MediaPipe → Inference) ──────────────────────────────────
  const handleFrame = useCallback(
    (landmarks: Landmark[]) => {
      feedFrame(landmarks)
    },
    [feedFrame]
  )

  // ── MediaPipe ──────────────────────────────────────────────────────────────
  const {
    trackingStatus,
    isModelReady: isMediaPipeReady,
    startCamera,
    stopCamera,
  } = useMediaPipe({ videoRef, canvasRef, onFrame: handleFrame })

  // ── Camera control ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setIsStarted(true)
    await startCamera()
  }, [startCamera])

  const handleStop = useCallback(() => {
    stopCamera()
    setIsStarted(false)
  }, [stopCamera])

  const handleLanguageChange = useCallback((lang: SignLanguage) => {
    if (isStarted) handleStop()
    setLanguage(lang)
  }, [isStarted, handleStop])

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <div className="container">
          <div className="header-inner">

            {/* Logo */}
            <div className="logo">
              <span className="logo-emoji" aria-hidden="true">✋</span>
              <div className="logo-textblock">
                <span className="logo-wordmark">
                  <span className="logo-sign">SIGN</span><span className="logo-forge">FORGE</span>
                </span>
                <span className="logo-tagline">Your Hands Signify</span>
              </div>
            </div>

            {/* Nav right: language selector */}
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
              disabled={isStarted}
            />
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: 'var(--space-lg) 0' }}>
        <div className="container">

          {/* Mode tabs */}
          <div className="mode-tabs">
            <button
              className={`mode-tab${mode === 'interpret' ? ' mode-tab--active' : ''}`}
              onClick={() => setMode('interpret')}
            >
              <span className="mode-tab-icon">📷</span>
              Sign → Text
            </button>
            <button
              className={`mode-tab${mode === 'translate' ? ' mode-tab--active' : ''}`}
              onClick={() => setMode('translate')}
            >
              <span className="mode-tab-icon">✍️</span>
              Text → Sign
            </button>
          </div>

          {/* Interpret mode */}
          {mode === 'interpret' && (
            <div className="main-layout">

              <Camera
                videoRef={videoRef}
                canvasRef={canvasRef}
                trackingStatus={trackingStatus}
                isStarted={isStarted}
                onStart={handleStart}
                onStop={handleStop}
                currentSign={prediction?.sign ?? null}
                confidence={prediction?.confidence ?? 0}
              />

              <div className="right-panel">
                <div className="model-status-card">
                  <div className={`model-status-dot model-status-dot--${modelStatus}`} />
                  <div className="model-status-text">
                    <strong>{MODEL_STATUS_LABELS[modelStatus]}</strong>
                    {!isMediaPipeReady && (
                      <span> &middot; MediaPipe loading…</span>
                    )}
                  </div>
                </div>

                <ConfidenceMeter
                  confidence={prediction?.confidence ?? 0}
                  stability={0}
                  sign={prediction?.sign ?? null}
                />

                <SignHistory
                  history={history}
                  pendingSigns={pendingSigns}
                  isTranslating={isTranslating}
                  onTranslateNow={translateNow}
                  onClear={clearHistory}
                />
              </div>
            </div>
          )}

          {/* Translate mode */}
          {mode === 'translate' && <TextToSign />}

        </div>
      </main>

      {/* ── Info Sections ───────────────────────────────────────────────────── */}
      <div className="container">
        <InfoSections />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <div className="footer-brand">
                SIGN<span className="forge">FORGE</span>
              </div>
              <div className="footer-motto">
                Real-time sign language interpretation · Your hands signify.
              </div>
            </div>
            <div className="footer-credit">
              Built by <a href="https://ayter.com" target="_blank" rel="noopener">Can Ayter</a>
              <br />
              <span>ayter.com/signforge</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
