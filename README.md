# SignForge

### *Your hands signify.*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision-0097A7?style=flat-square&logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Web-005CED?style=flat-square)](https://onnxruntime.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)
[![No Server Required](https://img.shields.io/badge/Backend-None-orange?style=flat-square)](#architecture)

---

**SignForge** is a real-time, browser-based sign language recognition and translation system. It interprets hand gestures through your webcam — directly in the browser, with no installation, no account, and no server. Built for the deaf and hard-of-hearing community and for sign language learners, SignForge puts interpretation in any browser tab.

---

## Table of Contents

1. [Overview](#overview)
2. [Demo](#demo)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Quick Start](#quick-start)
6. [Model Integration](#model-integration)
7. [Supported Sign Languages](#supported-sign-languages)
8. [Project Structure](#project-structure)
9. [Roadmap](#roadmap)
10. [Contributing](#contributing)
11. [Author](#author)

---

## Overview

An estimated 70 million deaf people worldwide use sign languages as their primary mode of communication. Access to real-time interpretation technology has historically required specialized hardware, proprietary software, or trained human interpreters. SignForge removes every one of those barriers.

Using **MediaPipe Hand Landmarker** for sub-millisecond landmark extraction and a lightweight **ONNX classifier** running entirely in WebAssembly, SignForge achieves real-time sign recognition at browser speed — on any device with a webcam and a modern browser.

**Key design principles:**

- **Privacy-first:** No video data ever leaves your device. All inference is local.
- **Zero-dependency runtime:** No backend, no cloud API, no account required.
- **Swappable models:** Any ONNX classifier trained on 42-float normalized hand landmarks drops straight in.
- **Extensible:** Architecture supports any sign language with a compatible landmark-based model.

---

## Demo

> Live demo coming soon.

To run locally, see [Quick Start](#quick-start).

---

## Architecture

SignForge processes each webcam frame through a four-stage client-side pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SIGNFORGE INFERENCE PIPELINE                     │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────────────────┐     ┌──────────────────────┐
  │  CAMERA  │────▶│     MEDIAPIPE        │────▶│    ONNX CLASSIFIER   │
  │          │     │  Hand Landmarker     │     │   (WebAssembly)      │
  │ Webcam   │     │                      │     │                      │
  │ feed @   │     │  21 landmarks/hand   │     │  Input:  [1, 42]     │
  │ 30fps    │     │  (x, y) coordinates  │     │  float32             │
  └──────────┘     │                      │     │                      │
                   │  Normalize:          │     │  Output: [1, N]      │
                   │  wrist → origin      │     │  softmax scores      │
                   │  scale to max abs=1  │     │                      │
                   └──────────────────────┘     └──────────┬───────────┘
                                                           │
                            ┌──────────────────────────────┘
                            ▼
                   ┌──────────────────────┐     ┌──────────────────────┐
                   │   STABILIZATION      │────▶│   TRANSLATION        │
                   │   BUFFER             │     │   LAYER              │
                   │                      │     │                      │
                   │  Hold sign for N     │     │  Sign sequence →     │
                   │  consistent frames   │     │  LLM / rule-based    │
                   │  before confirming   │     │  natural language    │
                   │                      │     │  output              │
                   │  Debounce flicker    │     │                      │
                   └──────────────────────┘     └──────────┬───────────┘
                                                           │
                            ┌──────────────────────────────┘
                            ▼
                   ┌──────────────────────┐
                   │   SIGN HISTORY       │
                   │   (UI / rendered)    │
                   │                      │
                   │  Scrollable session  │
                   │  log + confidence    │
                   │  meter + live text   │
                   └──────────────────────┘
```

### Stage Details

| Stage | Technology | Output |
|---|---|---|
| **Camera** | Browser `getUserMedia` API | Raw video frames |
| **Hand Landmarker** | `@mediapipe/tasks-vision` | 42 floats — 21 (x, y) landmark pairs per hand, normalized |
| **ONNX Classifier** | `onnxruntime-web` (WASM/WebGL) | Softmax score vector over N sign classes |
| **Stabilization** | Custom `useTranslation` hook | Debounced, confirmed sign events |
| **Translation** | Rule-based / LLM layer | Continuous natural language text |

### Custom Hooks

```
useMediaPipe        — MediaPipe Hand Landmarker lifecycle, frame loop
useONNXInference    — ONNX session creation, per-frame inference, model status
useTranslation      — Sign buffer management, stabilization logic, sequence translation
```

---

## Features

**Real-Time Hand Tracking**
MediaPipe Tasks Vision extracts 21 hand landmarks per frame at near-native speed. The wrist is normalized to the origin and the landmark cloud is scaled to a max absolute value of 1, making the input invariant to hand size and camera distance.

**In-Browser ONNX Inference**
`onnxruntime-web` runs the classifier in WebAssembly with optional WebGL acceleration. No GPU or server required. Inference runs on every captured frame.

**Sign Stabilization**
A dedicated buffer confirms a sign only after it has appeared for N consecutive frames above a confidence threshold. This eliminates flickering and transient false positives during hand motion.

**Confidence Meter**
A live softmax confidence bar visualizes model certainty for the current sign in real time, giving users immediate feedback on recognition quality.

**Sign History**
A scrollable, session-scoped log of all confirmed signs. Useful for review, debugging, and building sign sequences into sentences.

**Language Selector**
A UI picker to switch between supported sign language models. Selecting a language loads the corresponding ONNX model file.

**Model Status Indicator**
Explicit states — `idle` / `loading` / `ready` / `error` — keep the user informed of model load state at all times.

**Swappable Models**
Any ONNX classifier trained on the 42-float normalized landmark input format is plug-and-play. Bring your own model.

**Privacy-First**
Zero network calls during inference. All data stays on device.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A webcam
- A modern browser (Chrome or Edge recommended for best WebAssembly performance)

### Install and Run

```bash
git clone https://github.com/canayter/signforge.git
cd signforge
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Place a Model

SignForge requires an ONNX classifier at runtime. Place your model file here:

```
public/models/asl_fingerspell.onnx
```

See [Model Integration](#model-integration) for sourcing and training options.

### Build for Production

```bash
npm run build       # TypeScript compile + Vite bundle
npm run preview     # Preview production build at /signforge/
```

---

## Model Integration

### Required Model Format

| Property | Specification |
|---|---|
| **File format** | ONNX (`.onnx`) |
| **Input shape** | `[1, 42]` — float32 |
| **Input encoding** | Normalized (x, y) pairs for 21 hand landmarks; wrist at origin; max absolute value scaled to 1 |
| **Output shape** | `[1, N]` — float32 softmax scores |
| **N** | Number of sign classes in the model |

### Input Normalization

```
raw_landmarks = mediapipe output (21 points, x/y relative to image)

# translate wrist to origin
landmarks -= landmarks[0]

# flatten to [42] float vector
flat = [x0, y0, x1, y1, ..., x20, y20]

# scale
flat /= max(abs(flat))

# final input to ONNX: shape [1, 42]
```

### Model Placement

```
public/
└── models/
    ├── asl_fingerspell.onnx    ← ASL model (default)
    └── README.md               ← Sourcing and training instructions
```

### Sourcing a Model

- **Pre-trained:** A compatible ASL fingerspelling model (A–Z) can be sourced from the [MediaPipe Model Card repository](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) or community-trained ONNX exports.
- **Train your own:** Collect landmark data using the scripts in `scripts/`, label by sign class, train any classifier (MLP, LSTM, Transformer), and export to ONNX.
- **Extend:** Add models for BSL, ISL, or any sign language — see `public/models/README.md` for the naming convention and loader configuration.

---

## Supported Sign Languages

| Language | Code | Status | Coverage |
|---|---|---|---|
| American Sign Language | `ASL` | Planned — model pending | A–Z fingerspelling + common signs |
| British Sign Language | `BSL` | Roadmap | — |
| Indian Sign Language | `ISL` | Roadmap | — |
| Other | — | Extensible | Any ONNX landmark-based model |

Adding a new sign language requires only a compatible ONNX model and a corresponding entry in the language configuration. No code changes to the inference pipeline.

---

## Project Structure

```
signforge/
├── src/
│   ├── App.tsx                   # Root component — state orchestration
│   ├── components/
│   │   ├── Camera.tsx            # Webcam capture + MediaPipe canvas overlay
│   │   ├── ConfidenceMeter.tsx   # Live softmax confidence bar
│   │   ├── SignHistory.tsx       # Scrollable session sign log
│   │   └── LanguageSelector.tsx  # Sign language / model picker
│   ├── hooks/
│   │   ├── useMediaPipe.ts       # MediaPipe Hand Landmarker lifecycle
│   │   ├── useONNXInference.ts   # ONNX session load + per-frame inference
│   │   └── useTranslation.ts     # Sign buffer, stabilization, translation
│   └── types.ts                  # SignLanguage, Landmark, InferenceResult, etc.
├── public/
│   └── models/
│       └── README.md             # Model placement and sourcing guide
├── scripts/                      # Data collection and preprocessing utilities
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Roadmap

- [ ] ASL A–Z fingerspelling model (ONNX, landmark-based)
- [ ] Live demo deployment (GitHub Pages / Vercel)
- [ ] BSL model support
- [ ] ISL model support
- [ ] Sentence-level translation (sign sequence → natural language via LLM)
- [ ] Two-hand sign support (84-float input)
- [ ] Mobile / touch device support
- [ ] Offline PWA mode (service worker, local model caching)
- [ ] Data collection tool for community model training
- [ ] Accessibility audit (screen reader compatibility, keyboard navigation)
- [ ] Educator mode: practice mode with correct/incorrect feedback

---

## Contributing

Contributions are welcome — especially from the deaf and hard-of-hearing community, sign language linguists, and ML practitioners.

**Ways to contribute:**

- Train and share ONNX models for underrepresented sign languages
- Improve landmark normalization or stabilization logic
- Add sign languages to the language selector
- UI/UX improvements for accessibility
- Bug reports and feature requests via [GitHub Issues](https://github.com/canayter/signforge/issues)

**To contribute code:**

```bash
git checkout -b feature/your-feature
# make changes
git commit -m "feat: your feature description"
git push origin feature/your-feature
# open a pull request
```

Please ensure all submissions respect the privacy-first, no-server-required architecture.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Can Ayter**
[ayter.com](https://ayter.com) · [GitHub @canayter](https://github.com/canayter)

---

*SignForge is built with the conviction that communication is a universal right. By making sign language interpretation available in any browser — with no barriers to access — we hope to contribute, however small, to a more connected world for the deaf and hard-of-hearing community.*
