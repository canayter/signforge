import { SIGN_LANGUAGES } from '../types'
import type { SignLanguage } from '../types'

interface LanguageSelectorProps {
  value: SignLanguage
  onChange: (lang: SignLanguage) => void
  disabled?: boolean
}

export default function LanguageSelector({
  value,
  onChange,
  disabled,
}: LanguageSelectorProps) {
  return (
    <div className="lang-selector">
      <label className="lang-label">Sign Language</label>
      <div className="lang-options">
        {SIGN_LANGUAGES.map(sl => (
          <button
            key={sl.code}
            className={[
              'lang-option',
              value === sl.code ? 'lang-option--active' : '',
              !sl.modelAvailable ? 'lang-option--soon' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => sl.modelAvailable && onChange(sl.code)}
            disabled={disabled || !sl.modelAvailable}
            title={
              sl.modelAvailable
                ? sl.region
                : `${sl.label} — model coming soon`
            }
          >
            <span className="lang-code">{sl.code}</span>
            {!sl.modelAvailable && (
              <span className="lang-soon">soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
