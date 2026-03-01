import type { Landmark } from '../types'

/**
 * Sliding window frame buffer for temporal sign recognition.
 *
 * Maintains a fixed-size circular buffer of recent landmark frames.
 * When full, oldest frame is discarded as new ones arrive.
 */
export class FrameBuffer {
  private buffer: Landmark[][]
  private capacity: number

  constructor(capacity = 30) {
    this.capacity = capacity
    this.buffer = []
  }

  push(frame: Landmark[]): void {
    this.buffer.push(frame)
    if (this.buffer.length > this.capacity) {
      this.buffer.shift()
    }
  }

  get frames(): Landmark[][] {
    return [...this.buffer]
  }

  get length(): number {
    return this.buffer.length
  }

  get isFull(): boolean {
    return this.buffer.length >= this.capacity
  }

  /** Fill percentage 0–1, useful for UI progress indicator */
  get fillRatio(): number {
    return this.buffer.length / this.capacity
  }

  clear(): void {
    this.buffer = []
  }
}

/**
 * Debounce repeated identical predictions to avoid jitter.
 * Returns true when the same sign has been predicted
 * `requiredCount` consecutive times.
 */
export class PredictionStabilizer {
  private lastSign = ''
  private count = 0
  private requiredCount: number

  constructor(requiredCount = 8) {
    this.requiredCount = requiredCount
  }

  feed(sign: string): boolean {
    if (sign === this.lastSign) {
      this.count++
    } else {
      this.lastSign = sign
      this.count = 1
    }
    return this.count >= this.requiredCount
  }

  reset(): void {
    this.lastSign = ''
    this.count = 0
  }

  get currentSign(): string {
    return this.lastSign
  }

  get stability(): number {
    return Math.min(this.count / this.requiredCount, 1)
  }
}
