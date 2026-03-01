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
