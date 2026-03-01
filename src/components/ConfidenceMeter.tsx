interface ConfidenceMeterProps {
  confidence: number   // 0–1
  stability: number    // 0–1 (how many frames the sign has held)
  sign: string | null
}

function confidenceLabel(c: number): string {
  if (c >= 0.92) return 'High'
  if (c >= 0.75) return 'Medium'
  if (c >= 0.55) return 'Low'
  return 'Uncertain'
}

function confidenceColor(c: number): string {
  if (c >= 0.85) return 'var(--live)'
  if (c >= 0.65) return 'var(--warn)'
  return 'var(--error)'
}

export default function ConfidenceMeter({
  confidence,
  stability,
  sign,
}: ConfidenceMeterProps) {
  const pct = Math.round(confidence * 100)
  const color = confidenceColor(confidence)

  return (
    <div className="confidence-meter">
      <div className="confidence-header">
        <span className="confidence-label">Confidence</span>
        <span className="confidence-value" style={{ color }}>
          {sign && sign !== 'NOTHING' ? `${pct}%` : '—'}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="confidence-track">
        <div
          className="confidence-fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 8px ${color}44`,
          }}
        />
      </div>

      <div className="confidence-footer">
        <span className="confidence-quality" style={{ color }}>
          {sign && sign !== 'NOTHING' ? confidenceLabel(confidence) : 'No hand detected'}
        </span>

        {/* Stability indicator — fills as sign is held steady */}
        <div className="stability-track" title="Sign stability">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="stability-pip"
              style={{
                background: i < Math.round(stability * 10)
                  ? 'var(--signal-bright)'
                  : 'var(--void-border)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
