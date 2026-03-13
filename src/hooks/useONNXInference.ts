import { useEffect, useRef, useState, useCallback } from 'react'
import * as ort from 'onnxruntime-web'
import { normalizeLandmarks } from '../lib/normalize'
import { FrameBuffer, PredictionStabilizer } from '../lib/frameBuffer'
import type { Landmark, Prediction, ModelStatus, SignLanguage } from '../types'

// Point ONNX WASM runtime at its own files (avoids CSP issues in production)
ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/'

// ── ASL fingerspelling labels (A–Z, space, del, nothing) ────────────────────
const ASL_LABELS = [
  'A','B','C','D','E','F','G','H','I','J',
  'K','L','M','N','O','P','Q','R','S','T',
  'U','V','W','X','Y','Z',
  'SPACE','DEL','NOTHING',
]

// ── Rule-based special sign detector (runs before ONNX) ─────────────────────
//
// These are signs whose geometry is reliably identifiable from raw MediaPipe
// landmarks without a trained classifier.  Return a sign string or null.
//
// MediaPipe landmark index reference:
//   0=wrist  4=thumb-tip  8=index-tip  12=middle-tip  16=ring-tip  20=pinky-tip
//   6=index-pip  10=middle-pip  14=ring-pip  18=pinky-pip
//   2=thumb-mcp  9=middle-mcp (palm centre proxy)
//
function detectSpecialSigns(lm: Landmark[]): string | null {
  if (lm.length !== 21) return null

  // ── ILY (I Love You) ────────────────────────────────────────────────────
  //  Thumb up/out + Index up + Pinky up + Middle down + Ring down
  //  In image coords y increases downward, so "tip above PIP" = tip.y < pip.y
  const indexUp  = lm[8].y  < lm[6].y  - 0.02
  const pinkyUp  = lm[20].y < lm[18].y - 0.02
  const middleDown = lm[12].y > lm[10].y
  const ringDown   = lm[16].y > lm[14].y

  // Thumb: tip should be far from palm centre (not tucked)
  const palmCx = lm[9].x
  const palmCy = lm[9].y
  const thumbDist = Math.hypot(lm[4].x - palmCx, lm[4].y - palmCy)
  const thumbOut = thumbDist > 0.22

  if (indexUp && pinkyUp && middleDown && ringDown && thumbOut) {
    return 'ILY'
  }

  return null
}

const MODEL_PATHS: Record<SignLanguage, string | null> = {
  ASL:    '/signforge/models/asl_fingerspell.onnx',
  BSL:    null,
  ISL:    null,
  JSL:    null,
  CSL:    null,
  LSF:    null,
  Auslan: null,
}

const MODEL_LABELS: Record<SignLanguage, string[]> = {
  ASL:    ASL_LABELS,
  BSL:    [],
  ISL:    [],
  JSL:    [],
  CSL:    [],
  LSF:    [],
  Auslan: [],
}

// ── Confidence thresholds ────────────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 0.72   // below this → show as uncertain
const STABILITY_REQUIRED   = 10     // frames the same sign must hold

interface UseONNXInferenceOptions {
  language: SignLanguage
}

interface UseONNXInferenceReturn {
  prediction: Prediction | null
  modelStatus: ModelStatus
  feedFrame: (landmarks: Landmark[]) => void
  stabilizedSign: string | null
}

export function useONNXInference({
  language,
}: UseONNXInferenceOptions): UseONNXInferenceReturn {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [stabilizedSign, setStabilizedSign] = useState<string | null>(null)

  const sessionRef    = useRef<ort.InferenceSession | null>(null)
  const bufferRef     = useRef(new FrameBuffer(30))
  const stabilizerRef = useRef(new PredictionStabilizer(STABILITY_REQUIRED))
  const inferringRef  = useRef(false)

  // ── Load model when language changes ──────────────────────────────────────
  useEffect(() => {
    const modelPath = MODEL_PATHS[language]
    if (!modelPath) {
      setModelStatus('idle')
      sessionRef.current = null
      return
    }

    let cancelled = false
    setModelStatus('loading')

    async function loadModel() {
      try {
        const session = await ort.InferenceSession.create(modelPath!, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        })
        if (!cancelled) {
          sessionRef.current = session
          setModelStatus('ready')
          bufferRef.current.clear()
          stabilizerRef.current.reset()
        }
      } catch (err) {
        console.error('[SignForge] ONNX model load failed:', err)
        if (!cancelled) setModelStatus('error')
      }
    }

    loadModel()
    return () => {
      cancelled = true
    }
  }, [language])

  // ── Run inference on a single landmark frame ──────────────────────────────
  const feedFrame = useCallback(
    async (landmarks: Landmark[]) => {
      if (!sessionRef.current || inferringRef.current) return
      if (landmarks.length !== 21) return

      // Push to frame buffer (used for future sequence models)
      bufferRef.current.push(landmarks)

      inferringRef.current = true
      try {
        // ── Special signs (rule-based, no ONNX needed) ──────────────────────
        const special = detectSpecialSigns(landmarks)
        if (special) {
          const pred: Prediction = { sign: special, confidence: 0.97, isFingerSpell: false }
          setPrediction(pred)
          const isStable = stabilizerRef.current.feed(special)
          if (isStable) setStabilizedSign(special)
          inferringRef.current = false
          return
        }

        const input = normalizeLandmarks(landmarks)
        const tensor = new ort.Tensor('float32', input, [1, 42])
        const feeds: Record<string, ort.Tensor> = {}

        // Use the first input name from the model graph
        const inputName = sessionRef.current.inputNames[0]
        feeds[inputName] = tensor

        const results = await sessionRef.current.run(feeds)
        const outputName = sessionRef.current.outputNames[0]
        const output = results[outputName]

        // Softmax output expected; find argmax
        const scores = Array.from(output.data as Float32Array)
        const maxIdx = scores.indexOf(Math.max(...scores))
        const confidence = scores[maxIdx]

        const labels = MODEL_LABELS[language]
        const sign = labels[maxIdx] ?? `SIGN_${maxIdx}`

        const pred: Prediction = {
          sign,
          confidence,
          isFingerSpell: sign.length === 1,
        }
        setPrediction(pred)

        // Stabilize — only emit a sign after STABILITY_REQUIRED consistent frames
        if (confidence >= CONFIDENCE_THRESHOLD) {
          const isStable = stabilizerRef.current.feed(sign)
          if (isStable && sign !== 'NOTHING') {
            setStabilizedSign(sign)
          }
        } else {
          stabilizerRef.current.reset()
        }
      } catch (err) {
        console.error('[SignForge] Inference error:', err)
      } finally {
        inferringRef.current = false
      }
    },
    [language]
  )

  return { prediction, modelStatus, feedFrame, stabilizedSign }
}
