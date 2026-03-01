import { useEffect, useRef, useState, useCallback } from 'react'
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { Landmark, TrackingStatus } from '../types'

const MEDIAPIPE_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'

const HAND_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

interface UseMediaPipeOptions {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  onFrame?: (landmarks: Landmark[]) => void
}

interface UseMediaPipeReturn {
  trackingStatus: TrackingStatus
  isModelReady: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  lastResult: HandLandmarkerResult | null
}

export function useMediaPipe({
  videoRef,
  canvasRef,
  onFrame,
}: UseMediaPipeOptions): UseMediaPipeReturn {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('off')
  const [isModelReady, setIsModelReady] = useState(false)

  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const drawingUtilsRef = useRef<DrawingUtils | null>(null)
  const animFrameRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const lastResultRef = useRef<HandLandmarkerResult | null>(null)
  const lastVideoTimeRef = useRef(-1)

  // ── Init MediaPipe ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN)
        const hl = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        if (!cancelled) {
          handLandmarkerRef.current = hl
          setIsModelReady(true)
        }
      } catch (err) {
        console.error('[SignForge] MediaPipe init failed:', err)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Per-frame detection loop ──────────────────────────────────────────────
  const detectLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const hl = handLandmarkerRef.current

    if (!video || !canvas || !hl || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas to video dimensions
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    // Only run inference on new frames
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      const result = hl.detectForVideo(video, performance.now())
      lastResultRef.current = result

      // Draw skeleton overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (result.landmarks.length > 0) {
        setTrackingStatus('tracking')

        if (!drawingUtilsRef.current) {
          drawingUtilsRef.current = new DrawingUtils(ctx)
        }
        const du = drawingUtilsRef.current

        for (const handLandmarks of result.landmarks) {
          // Connections
          du.drawConnectors(
            handLandmarks,
            HandLandmarker.HAND_CONNECTIONS,
            { color: 'rgba(124,58,237,0.55)', lineWidth: 2 }
          )
          // Joints
          du.drawLandmarks(handLandmarks, {
            color: '#a78bfa',
            lineWidth: 1,
            radius: 3,
          })
        }

        // Forward primary hand landmarks to inference hook
        if (onFrame) {
          const primary = result.landmarks[0]
          const lms: Landmark[] = primary.map(lm => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
          }))
          onFrame(lms)
        }
      } else {
        setTrackingStatus('searching')
      }
    }

    animFrameRef.current = requestAnimationFrame(detectLoop)
  }, [videoRef, canvasRef, onFrame])

  // ── Camera control ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setTrackingStatus('searching')
          animFrameRef.current = requestAnimationFrame(detectLoop)
        }
      }
    } catch (err) {
      console.error('[SignForge] Camera access denied:', err)
    }
  }, [videoRef, detectLoop])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setTrackingStatus('off')
    lastResultRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      handLandmarkerRef.current?.close()
    }
  }, [stopCamera])

  return {
    trackingStatus,
    isModelReady,
    startCamera,
    stopCamera,
    lastResult: lastResultRef.current,
  }
}
