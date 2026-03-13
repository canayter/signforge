// ─── TextToSign — Text to ASL Fingerspelling Animator ────────────────────────

import { useState, useEffect, useCallback } from 'react'

// ── Token types ───────────────────────────────────────────────────────────────
interface LetterToken { type: 'letter'; char: string; wordIdx: number }
interface PauseToken  { type: 'pause';  ms: number }
type Token = LetterToken | PauseToken

// ── Tokenizer ─────────────────────────────────────────────────────────────────
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean)
  words.forEach((word, wi) => {
    if (wi > 0) tokens.push({ type: 'pause', ms: 600 })
    for (const ch of word) {
      if (/[A-Z0-9]/.test(ch)) tokens.push({ type: 'letter', char: ch, wordIdx: wi })
    }
  })
  return tokens
}

// ── Speed presets ─────────────────────────────────────────────────────────────
const SPEEDS = [
  { label: 'Slow',   ms: 1300 },
  { label: 'Normal', ms: 750  },
  { label: 'Fast',   ms: 380  },
]

// ── Letter position within word ───────────────────────────────────────────────
function getLetterPos(tokens: Token[], idx: number, wordIdx: number): number {
  let pos = -1
  for (let i = 0; i <= idx; i++) {
    const t = tokens[i]
    if (t.type === 'letter' && t.wordIdx === wordIdx) pos++
  }
  return pos
}

export default function TextToSign() {
  const [inputText, setInputText]   = useState('')
  const [tokens,    setTokens]      = useState<Token[]>([])
  const [idx,       setIdx]         = useState(-1)
  const [playing,   setPlaying]     = useState(false)
  const [speedIdx,  setSpeedIdx]    = useState(1)

  const words        = inputText.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const currentToken = idx >= 0 && idx < tokens.length ? tokens[idx] : null
  const isDone       = tokens.length > 0 && idx >= tokens.length

  const currentWordIdx   = currentToken?.type === 'letter' ? currentToken.wordIdx : -1
  const currentLetterPos = currentToken?.type === 'letter'
    ? getLetterPos(tokens, idx, currentWordIdx)
    : -1

  // ── Playback engine ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    if (idx >= tokens.length) { setPlaying(false); return }

    const t   = tokens[idx]
    const dur = t?.type === 'pause' ? t.ms : SPEEDS[speedIdx].ms
    const timer = setTimeout(() => setIdx(i => i + 1), dur)
    return () => clearTimeout(timer)
  }, [playing, idx, tokens, speedIdx])

  // ── Controls ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPlaying(false)
    setIdx(-1)
    setTokens([])
  }, [])

  const play = () => {
    if (!inputText.trim()) return
    const t = tokenize(inputText)
    if (!t.length) return
    setTokens(t)
    setIdx(0)
    setPlaying(true)
  }

  const handleTextChange = (val: string) => {
    setInputText(val)
    reset()
  }

  const currentChar = currentToken?.type === 'letter' ? currentToken.char : null

  return (
    <div className="text-to-sign">

      {/* ── Input ─────────────────────────────────────────────────────────────── */}
      <div className="tts-input-wrap">
        <textarea
          className="tts-textarea"
          placeholder="Type a word or sentence to sign…"
          value={inputText}
          onChange={e => handleTextChange(e.target.value)}
          rows={3}
          spellCheck={false}
        />

        <div className="tts-controls-row">
          <div className="tts-speed-group">
            <span className="tts-speed-label">Speed</span>
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                className={`tts-speed-btn${speedIdx === i ? ' active' : ''}`}
                onClick={() => setSpeedIdx(i)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="tts-btn-group">
            {idx < 0 && (
              <button className="btn btn-primary" onClick={play} disabled={!inputText.trim()}>
                ▶ Sign It
              </button>
            )}
            {playing && (
              <button className="btn btn-ghost" onClick={() => setPlaying(false)}>
                ⏸ Pause
              </button>
            )}
            {!playing && !isDone && idx >= 0 && (
              <button className="btn btn-primary" onClick={() => setPlaying(true)}>
                ▶ Resume
              </button>
            )}
            {idx >= 0 && (
              <button className="btn btn-ghost" onClick={reset}>↺ Reset</button>
            )}
            {isDone && (
              <button className="btn btn-primary" onClick={play}>↺ Replay</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Player ────────────────────────────────────────────────────────────── */}
      <div className={`tts-player${idx >= 0 ? ' tts-player--active' : ''}`}>

        {idx < 0 && (
          <div className="tts-idle">
            <div className="tts-idle-icon">✍️</div>
            <div>Type above and hit <strong>Sign It</strong></div>
          </div>
        )}

        {isDone && (
          <div className="tts-idle tts-idle--done">
            <div className="tts-idle-icon">✅</div>
            <div>Done signing</div>
          </div>
        )}

        {!isDone && currentToken && (
          <>
            {/* Big letter or word-gap indicator */}
            <div className="tts-sign-display">
              {currentToken.type === 'letter' ? (
                <span className="tts-big-letter">{currentToken.char}</span>
              ) : (
                <span className="tts-word-gap">···</span>
              )}
            </div>

            {/* Word context — letters of current word */}
            {currentToken.type === 'letter' && (
              <>
                <div className="tts-word-context">
                  {words[currentWordIdx]?.split('').map((ch, i) => (
                    <span
                      key={i}
                      className={
                        i === currentLetterPos ? 'tts-ctx-letter tts-ctx-letter--active' :
                        i <  currentLetterPos  ? 'tts-ctx-letter tts-ctx-letter--done'   :
                        'tts-ctx-letter'
                      }
                    >
                      {ch}
                    </span>
                  ))}
                </div>

                {/* Sentence word pills */}
                {words.length > 1 && (
                  <div className="tts-sentence-progress">
                    {words.map((w, i) => (
                      <span
                        key={i}
                        className={
                          i === currentWordIdx ? 'tts-pill tts-pill--active' :
                          i <  currentWordIdx  ? 'tts-pill tts-pill--done'   :
                          'tts-pill'
                        }
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Alphabet reference ────────────────────────────────────────────────── */}
      <div className="tts-alphabet">
        <div className="tts-alphabet-label">ASL Fingerspelling Alphabet</div>
        <div className="tts-alphabet-grid">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => (
            <div
              key={l}
              className={`tts-alpha-key${currentChar === l ? ' tts-alpha-key--active' : ''}`}
            >
              {l}
            </div>
          ))}
        </div>
        <p className="tts-alphabet-note">
          Each letter is fingerspelled individually.
          Word-level sign videos are on the roadmap.
        </p>
      </div>

    </div>
  )
}
