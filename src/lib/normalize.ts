import type { Landmark } from '../types'

/**
 * Normalize hand landmarks for model input.
 *
 * Steps:
 *   1. Translate so wrist (landmark 0) is at origin
 *   2. Flatten to [x0,y0,z0, x1,y1,z1, ..., x20,y20,z20]
 *   3. Scale so max absolute value = 1
 *
 * This makes the representation invariant to:
 *   - Camera distance (scale)
 *   - Hand position in frame (translation)
 *
 * Output: Float32Array of length 63 (21 points × x,y,z)
 */
export function normalizeLandmarks(landmarks: Landmark[]): Float32Array {
  if (landmarks.length !== 21) {
    throw new Error(`Expected 21 hand landmarks, got ${landmarks.length}`)
  }

  const wrist = landmarks[0]

  // Translate to origin
  const relative = landmarks.map(lm => [
    lm.x - wrist.x,
    lm.y - wrist.y,
    (lm.z ?? 0) - (wrist.z ?? 0),
  ])

  const flat = relative.flat()

  // Scale
  const maxAbs = Math.max(...flat.map(Math.abs))
  const scaled = flat.map(v => (maxAbs > 0 ? v / maxAbs : 0))

  return new Float32Array(scaled)
}

/**
 * Normalize a sequence of frames for temporal models.
 * Returns Float32Array of shape [frames × 42].
 */
export function normalizeSequence(
  frameList: Landmark[][],
  targetFrames = 30
): Float32Array {
  const padded = padOrTrimFrames(frameList, targetFrames)
  const result = new Float32Array(targetFrames * 42)

  padded.forEach((frame, i) => {
    const norm = normalizeLandmarks(frame)
    result.set(norm, i * 42)
  })

  return result
}

/**
 * Pad (repeat last frame) or trim a frame sequence to exactly targetFrames.
 */
function padOrTrimFrames(frames: Landmark[][], target: number): Landmark[][] {
  if (frames.length === 0) {
    return Array(target).fill(Array(21).fill({ x: 0, y: 0, z: 0 }))
  }
  if (frames.length >= target) {
    return frames.slice(frames.length - target)
  }
  const last = frames[frames.length - 1]
  const pad = Array(target - frames.length).fill(last)
  return [...frames, ...pad]
}
