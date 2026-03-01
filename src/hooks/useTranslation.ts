import { useState, useRef, useCallback } from 'react'
import type { TranslationEntry, SignLanguage } from '../types'

// ── Backend proxy URL ─────────────────────────────────────────────────────────
// The FastAPI backend handles the Claude API call server-side to keep the key safe.
// In dev: http://localhost:8000/translate
// In prod: https://api.ayter.com/signforge/translate  (or same-origin proxy)
const TRANSLATE_URL =
  import.meta.env.VITE_TRANSLATE_URL ?? 'http://localhost:8000/translate'

// How many signs to accumulate before auto-translating
const AUTO_TRANSLATE_THRESHOLD = 6
// Idle time (ms) before auto-triggering translation
const IDLE_TIMEOUT_MS = 2500

interface UseTranslationReturn {
  history: TranslationEntry[]
  pendingSigns: string[]
  isTranslating: boolean
  addSign: (sign: string) => void
  translateNow: () => Promise<void>
  clearHistory: () => void
}

export function useTranslation(language: SignLanguage): UseTranslationReturn {
  const [history, setHistory] = useState<TranslationEntry[]>([])
  const [pendingSigns, setPendingSigns] = useState<string[]>([])
  const [isTranslating, setIsTranslating] = useState(false)

  const pendingRef = useRef<string[]>([])
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doTranslate = useCallback(async (signs: string[]) => {
    if (signs.length === 0 || isTranslating) return

    const gloss = signs.join(' ')
    setIsTranslating(true)
    setPendingSigns([])
    pendingRef.current = []

    try {
      const res = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gloss, language }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { translation: string }

      const entry: TranslationEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        gloss,
        translation: data.translation,
        language,
        timestamp: Date.now(),
      }

      setHistory(prev => [entry, ...prev].slice(0, 50)) // keep last 50
    } catch (err) {
      console.error('[SignForge] Translation failed:', err)
      // Fallback: show raw gloss in history without translation
      const entry: TranslationEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        gloss,
        translation: gloss,  // raw fallback
        language,
        timestamp: Date.now(),
      }
      setHistory(prev => [entry, ...prev].slice(0, 50))
    } finally {
      setIsTranslating(false)
    }
  }, [language, isTranslating])

  const addSign = useCallback((sign: string) => {
    if (sign === 'NOTHING' || sign === 'DEL') {
      if (sign === 'DEL') {
        pendingRef.current = pendingRef.current.slice(0, -1)
        setPendingSigns([...pendingRef.current])
      }
      return
    }

    if (sign === 'SPACE') {
      // Space = word boundary, trigger translation if enough signs
      if (pendingRef.current.length >= 2) {
        doTranslate([...pendingRef.current])
      }
      return
    }

    // Avoid consecutive duplicates in the buffer
    const last = pendingRef.current[pendingRef.current.length - 1]
    if (last === sign) return

    pendingRef.current = [...pendingRef.current, sign]
    setPendingSigns([...pendingRef.current])

    // Reset idle timer
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (pendingRef.current.length > 0) {
        doTranslate([...pendingRef.current])
      }
    }, IDLE_TIMEOUT_MS)

    // Auto-translate when threshold reached
    if (pendingRef.current.length >= AUTO_TRANSLATE_THRESHOLD) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      doTranslate([...pendingRef.current])
    }
  }, [doTranslate])

  const translateNow = useCallback(async () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    await doTranslate([...pendingRef.current])
  }, [doTranslate])

  const clearHistory = useCallback(() => {
    setHistory([])
    setPendingSigns([])
    pendingRef.current = []
  }, [])

  return {
    history,
    pendingSigns,
    isTranslating,
    addSign,
    translateNow,
    clearHistory,
  }
}
