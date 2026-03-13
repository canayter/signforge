// ─── InfoSections — Below-the-fold informational panels ──────────────────────
//
// Three sections:
//   1. How It Works        — pipeline explanation
//   2. Performance Tips    — practical advice for better results
//   3. What's Coming       — public roadmap

interface RoadmapItem {
  label: string
  detail: string
  status: 'live' | 'in-progress' | 'planned'
}

const ROADMAP: RoadmapItem[] = [
  { label: 'ASL Fingerspelling A–Z',      detail: 'Static single-frame MLP classifier',         status: 'live'        },
  { label: 'ILY Sign',                    detail: 'Rule-based landmark geometry detection',      status: 'live'        },
  { label: 'J & Z Motion Letters',        detail: 'Trajectory-based detection via frame buffer', status: 'in-progress' },
  { label: 'BSL Fingerspelling',          detail: 'British Sign Language two-hand alphabet',     status: 'in-progress' },
  { label: 'Full ASL Vocabulary',         detail: '500+ common ASL word signs (sequence model)', status: 'planned'     },
  { label: 'Indian Sign Language (ISL)',  detail: 'ISL alphabet + common phrases',              status: 'planned'     },
  { label: 'Two-Hand Gesture Support',    detail: 'Simultaneous left + right hand recognition',  status: 'planned'     },
  { label: 'Offline PWA Mode',            detail: 'Works without network after first load',      status: 'planned'     },
]

const STATUS_LABEL: Record<RoadmapItem['status'], string> = {
  'live':        'Live',
  'in-progress': 'In Progress',
  'planned':     'Planned',
}

export default function InfoSections() {
  return (
    <div className="info-sections">

      {/* ── Divider ───────────────────────────────────────────────────────────── */}
      <div className="info-divider" />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HOW IT WORKS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="info-section">
        <div className="info-section-head">
          <h2 className="info-section-title">How It Works</h2>
          <p className="info-section-sub">
            Three stages run entirely in your browser — no video ever leaves your device.
          </p>
        </div>

        <div className="pipeline-grid">

          <div className="pipeline-card">
            <div className="pipeline-step">01</div>
            <div className="pipeline-icon">🤚</div>
            <h3 className="pipeline-card-title">Hand Tracking</h3>
            <p className="pipeline-card-body">
              Google MediaPipe runs at 30 fps and maps <strong>21 landmarks</strong> onto
              your hand — every knuckle, fingertip, and wrist joint — in real time using
              your device's GPU.
            </p>
            <div className="pipeline-tech">MediaPipe · WebGL</div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-card">
            <div className="pipeline-step">02</div>
            <div className="pipeline-icon">🧠</div>
            <h3 className="pipeline-card-title">Sign Recognition</h3>
            <p className="pipeline-card-body">
              A lightweight <strong>neural network</strong> (42 input features, trained on
              the Kaggle ASL Alphabet dataset) classifies each frame. Special signs like
              ILY are detected from landmark geometry directly — no model needed.
            </p>
            <div className="pipeline-tech">ONNX Runtime · WebAssembly</div>
          </div>

          <div className="pipeline-arrow">→</div>

          <div className="pipeline-card">
            <div className="pipeline-step">03</div>
            <div className="pipeline-icon">💬</div>
            <h3 className="pipeline-card-title">Natural Language</h3>
            <p className="pipeline-card-body">
              Stabilized signs are assembled into a <strong>gloss sequence</strong> and
              sent to Claude AI, which understands sign language grammar (topic-comment
              structure, no articles, etc.) and produces fluent English output.
            </p>
            <div className="pipeline-tech">Claude AI · FastAPI</div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — TIPS & LIMITATIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="info-section">
        <div className="info-section-head">
          <h2 className="info-section-title">Tips &amp; Limitations</h2>
          <p className="info-section-sub">
            SignForge is at an early stage. Here's how to get the best results —
            and what the model currently can't do.
          </p>
        </div>

        <div className="tips-grid">

          {/* Tips */}
          <div className="tips-col">
            <h3 className="tips-col-title">To Maximize Accuracy</h3>
            <ul className="tips-list">
              <li className="tips-item">
                <span className="tips-icon">💡</span>
                <div>
                  <strong>Good lighting</strong>
                  <p>Ensure your hand is well-lit. Side shadows from a single light source
                  cause the most recognition errors.</p>
                </div>
              </li>
              <li className="tips-item">
                <span className="tips-icon">🎨</span>
                <div>
                  <strong>Plain background</strong>
                  <p>A contrasting, clutter-free background makes hand segmentation more
                  reliable. Dark shirt on a light wall works great.</p>
                </div>
              </li>
              <li className="tips-item">
                <span className="tips-icon">📏</span>
                <div>
                  <strong>Camera distance</strong>
                  <p>Keep your hand <strong>30–60 cm</strong> from the camera. Too close clips
                  the palm; too far reduces landmark precision.</p>
                </div>
              </li>
              <li className="tips-item">
                <span className="tips-icon">🐢</span>
                <div>
                  <strong>Sign deliberately</strong>
                  <p>The model requires a sign to be held stable for ~10 frames before
                  committing. Fast transitions confuse the stabilizer.</p>
                </div>
              </li>
              <li className="tips-item">
                <span className="tips-icon">✋</span>
                <div>
                  <strong>Full hand in frame</strong>
                  <p>All 21 landmarks must be visible. Avoid signing near the frame edge
                  where fingertips get cut off.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Limitations */}
          <div className="tips-col">
            <h3 className="tips-col-title">Current Limitations</h3>
            <ul className="limits-list">
              <li className="limits-item">
                <span className="limits-badge limits-badge--scope">Scope</span>
                <div>
                  <strong>ASL fingerspelling only</strong>
                  <p>The current model covers the 26-letter ASL manual alphabet + ILY.
                  Full lexical signs (HELLO, THANK YOU, etc.) require a temporal sequence
                  model — see the roadmap.</p>
                </div>
              </li>
              <li className="limits-item">
                <span className="limits-badge limits-badge--scope">Scope</span>
                <div>
                  <strong>J and Z are unreliable</strong>
                  <p>These letters require motion trajectories (drawing a J or Z in the
                  air). The single-frame classifier cannot capture this. Motion-based
                  detection is in progress.</p>
                </div>
              </li>
              <li className="limits-item">
                <span className="limits-badge limits-badge--hand">Hand</span>
                <div>
                  <strong>Right hand performs better</strong>
                  <p>The training dataset skewed toward right-handed signers. Left-handed
                  fingerspelling is supported but accuracy is somewhat lower.</p>
                </div>
              </li>
              <li className="limits-item">
                <span className="limits-badge limits-badge--env">Environment</span>
                <div>
                  <strong>Lighting-sensitive</strong>
                  <p>Very low light or harsh direct backlight can cause landmark jitter
                  which propagates into classification noise. Good ambient light is the
                  single biggest factor you control.</p>
                </div>
              </li>
              <li className="limits-item">
                <span className="limits-badge limits-badge--model">Model</span>
                <div>
                  <strong>Single-hand only</strong>
                  <p>Multi-hand signs (common in BSL and many other sign languages) are
                  not yet supported. The pipeline currently uses the first detected hand.</p>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — ROADMAP
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="info-section">
        <div className="info-section-head">
          <h2 className="info-section-title">What's Coming</h2>
          <p className="info-section-sub">
            SignForge is actively developed. These are the features either live, in
            training, or queued for the next release.
          </p>
        </div>

        <div className="roadmap-grid">
          {ROADMAP.map((item) => (
            <div key={item.label} className={`roadmap-item roadmap-item--${item.status}`}>
              <div className="roadmap-item-top">
                <span className={`roadmap-badge roadmap-badge--${item.status}`}>
                  {item.status === 'live'        && '✓ '}
                  {item.status === 'in-progress' && '◐ '}
                  {item.status === 'planned'     && '○ '}
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <div className="roadmap-item-label">{item.label}</div>
              <div className="roadmap-item-detail">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — CONTRIBUTE / OPEN SOURCE NOTE
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="info-section info-section--tight">
        <div className="contribute-strip">
          <div className="contribute-text">
            <h3 className="contribute-title">Help improve SignForge</h3>
            <p>
              Accuracy improves directly with more training data. If you know ASL and
              want to contribute landmark recordings for under-represented signs or
              signer demographics, reach out.
            </p>
          </div>
          <div className="contribute-links">
            <a
              className="btn btn-ghost btn-sm"
              href="https://github.com/canayter/signforge"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href="https://ayter.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              ayter.com
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
