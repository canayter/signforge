import type { TranslationEntry } from '../types'

interface SignHistoryProps {
  history: TranslationEntry[]
  pendingSigns: string[]
  isTranslating: boolean
  onTranslateNow: () => void
  onClear: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function SignHistory({
  history,
  pendingSigns,
  isTranslating,
  onTranslateNow,
  onClear,
}: SignHistoryProps) {
  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">Translation Log</span>
        <div className="history-actions">
          {pendingSigns.length > 0 && (
            <button
              className="btn btn-sm btn-signal"
              onClick={onTranslateNow}
              disabled={isTranslating}
            >
              {isTranslating ? 'Translating…' : 'Translate now'}
            </button>
          )}
          {history.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Pending signs buffer */}
      {pendingSigns.length > 0 && (
        <div className="history-pending">
          <span className="history-pending-label">Signing:</span>
          <span className="history-pending-signs">
            {pendingSigns.join(' · ')}
          </span>
          {isTranslating && <span className="history-spinner" />}
        </div>
      )}

      {/* Translated entries */}
      <div className="history-list">
        {history.length === 0 && pendingSigns.length === 0 && (
          <div className="history-empty">
            <span>Start signing — translations will appear here.</span>
          </div>
        )}

        {history.map(entry => (
          <div key={entry.id} className="history-entry">
            <div className="history-entry-translation">
              {entry.translation}
            </div>
            <div className="history-entry-meta">
              <span className="history-entry-gloss">{entry.gloss}</span>
              <span className="history-entry-time">{formatTime(entry.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
