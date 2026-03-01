import { useRef, useEffect } from 'react'
import type { TrackingStatus } from '../types'

interface CameraProps {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  trackingStatus: TrackingStatus
  isStarted: boolean
  onStart: () => void
  onStop: () => void
  currentSign: string | null
  confidence: number
}

const STATUS_LABELS: Record<TrackingStatus, string> = {
  off:       'Camera off',
  searching: 'Searching for hands…',
  tracking:  'Tracking',
}

export default function Camera({
  videoRef,
  canvasRef,
  trackingStatus,
  isStarted,
  onStart,
  onStop,
  currentSign,
  confidence,
}: CameraProps) {
  // Mirror the video for natural front-camera feel
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = 'scaleX(-1)'
    }
  }, [videoRef])

  return (
    <div className="camera-wrap">
      {/* Video + skeleton overlay */}
      <div className="camera-viewport">
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="camera-canvas"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Live badge */}
        {isStarted && (
          <div className={`camera-badge camera-badge--${trackingStatus}`}>
            <span className="camera-badge-dot" />
            {STATUS_LABELS[trackingStatus]}
          </div>
        )}

        {/* Current sign overlay — big, readable, top-center */}
        {trackingStatus === 'tracking' && currentSign && currentSign !== 'NOTHING' && (
          <div className="camera-sign-overlay">
            <span className="camera-sign-letter">{currentSign}</span>
            <div className="camera-sign-confidence">
              <div
                className="camera-sign-confidence-bar"
                style={{ width: `${(confidence * 100).toFixed(0)}%` }}
              />
            </div>
          </div>
        )}

        {/* Start prompt when camera is off */}
        {!isStarted && (
          <div className="camera-start-prompt">
            <div className="camera-start-icon">✋</div>
            <p>Tap to activate camera</p>
            <p className="camera-start-sub">Camera runs locally. No video is transmitted.</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="camera-controls">
        {!isStarted ? (
          <button className="btn btn-primary" onClick={onStart}>
            Start Interpreting
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </div>
  )
}
