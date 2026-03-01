// ─── Landmark types (aligned with MediaPipe Tasks Vision output) ─────────────

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface HandLandmarks {
  landmarks: Landmark[]
  worldLandmarks: Landmark[]
  handedness: 'Left' | 'Right'
}

// ─── Model / Inference ────────────────────────────────────────────────────────

export interface Prediction {
  sign: string        // e.g. "A", "HELLO", "THANK_YOU"
  confidence: number  // 0–1
  isFingerSpell: boolean
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ModelInfo {
  id: string
  name: string
  language: SignLanguage
  type: 'fingerspell' | 'word'
  labelCount: number
  inputFrames: number  // 1 = static; 30 = sequence
  path: string         // relative to /signforge/models/
}

// ─── Sign Language registry ───────────────────────────────────────────────────

export type SignLanguage =
  | 'ASL'   // American
  | 'BSL'   // British
  | 'ISL'   // Indian
  | 'JSL'   // Japanese
  | 'CSL'   // Chinese
  | 'LSF'   // French
  | 'Auslan' // Australian

export interface SignLanguageOption {
  code: SignLanguage
  label: string
  region: string
  modelAvailable: boolean
}

export const SIGN_LANGUAGES: SignLanguageOption[] = [
  { code: 'ASL',    label: 'American Sign Language',   region: 'United States / Canada', modelAvailable: true  },
  { code: 'BSL',    label: 'British Sign Language',    region: 'United Kingdom',          modelAvailable: false },
  { code: 'ISL',    label: 'Indian Sign Language',     region: 'India',                   modelAvailable: false },
  { code: 'JSL',    label: 'Japanese Sign Language',   region: 'Japan',                   modelAvailable: false },
  { code: 'CSL',    label: 'Chinese Sign Language',    region: 'China',                   modelAvailable: false },
  { code: 'LSF',    label: 'Langue des Signes Française', region: 'France',               modelAvailable: false },
  { code: 'Auslan', label: 'Auslan',                   region: 'Australia',               modelAvailable: false },
]

// ─── Translation ──────────────────────────────────────────────────────────────

export interface TranslationEntry {
  id: string
  gloss: string           // raw signs, e.g. "ME WANT COFFEE PLEASE"
  translation: string     // natural language output
  language: SignLanguage
  timestamp: number
}

// ─── App state ────────────────────────────────────────────────────────────────

export type TrackingStatus = 'off' | 'searching' | 'tracking'

export interface AppState {
  trackingStatus: TrackingStatus
  modelStatus: ModelStatus
  activeLanguage: SignLanguage
  currentPrediction: Prediction | null
  signBuffer: string[]        // accumulated signs before translation
  history: TranslationEntry[]
}
