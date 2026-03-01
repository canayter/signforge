import { useRef, useState, useCallback } from 'react'
import Camera from './components/Camera'
import ConfidenceMeter from './components/ConfidenceMeter'
import SignHistory from './components/SignHistory'
import LanguageSelector from './components/LanguageSelector'
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
              <svg
                className="logo-svg"
                viewBox="0 0 44 44"
                width="44"
                height="44"
                aria-hidden="true"
              >
                {/* Hexagon mark */}
                <polygon
                  className="logo-hex"
                  points="22,3 38,12.5 38,31.5 22,41 6,31.5 6,12.5"
                />
                {/* Inner pulse circle */}
                <circle className="logo-pulse" cx="22" cy="22" r="10" />
                {/* Hand silhouette — simplified path */}
                <text
                  x="22" y="29"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  fontSize="16"
                  fill="white"
                  style={{ userSelect: 'none' }}
                >
                  SF
                </text>
              </svg>

              <div className="logo-type">
                <div className="logo-name">
                  <span className="logo-sign">SIGN</span>
                  <span className="logo-forge">FORGE</span>
                </div>
                <div className="logo-motto">YOUR HANDS SIGNIFY</div>
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
          <div className="main-layout">

            {/* Left: Camera */}
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

            {/* Right: Panel */}
            <div className="right-panel">

              {/* Model status */}
              <div className="model-status-card">
                <div className={`model-status-dot model-status-dot--${modelStatus}`} />
                <div className="model-status-text">
                  <strong>{MODEL_STATUS_LABELS[modelStatus]}</strong>
                  {!isMediaPipeReady && (
                    <span> &middot; MediaPipe loading…</span>
                  )}
                </div>
              </div>

              {/* Confidence meter */}
              <ConfidenceMeter
                confidence={prediction?.confidence ?? 0}
                stability={0}
                sign={prediction?.sign ?? null}
              />

              {/* Translation history */}
              <SignHistory
                history={history}
                pendingSigns={pendingSigns}
                isTranslating={isTranslating}
                onTranslateNow={translateNow}
                onClear={clearHistory}
              />

            </div>
          </div>
        </div>
      </main>

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
