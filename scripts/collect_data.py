"""
SignForge — Landmark Data Collector
Collects MediaPipe hand landmarks and saves them as NumPy arrays
so you can train custom sign models for any sign language.

Usage:
    pip install opencv-python mediapipe numpy
    python collect_data.py --sign A --samples 200

Output: data/<SIGN>/sample_<N>.npy  (each file = 42 floats: 21 landmarks × x,y)
"""

import argparse
import os
import time
import numpy as np
import cv2
import mediapipe as mp

def normalize_landmarks(landmarks):
    """
    Normalize 21 hand landmarks to origin + max-abs scale.
    Returns np.ndarray of shape (42,).
    """
    pts = np.array([[lm.x, lm.y] for lm in landmarks], dtype=np.float32)
    pts -= pts[0]                          # translate to wrist origin
    max_abs = np.abs(pts).max()
    if max_abs > 0:
        pts /= max_abs                     # scale
    return pts.flatten()


def collect(sign: str, n_samples: int, output_dir: str, delay: float = 0.05):
    sign = sign.upper()
    save_dir = os.path.join(output_dir, sign)
    os.makedirs(save_dir, exist_ok=True)

    mp_hands = mp.solutions.hands
    mp_draw  = mp.solutions.drawing_utils

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera")

    collected = 0
    print(f"\n[SignForge Collector] Sign: {sign}  Target: {n_samples} samples")
    print("Press SPACE to start collecting. Press Q to quit.\n")

    collecting = False

    with mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5,
    ) as hands:

        while collected < n_samples:
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hands.process(rgb)

            if result.multi_hand_landmarks:
                for hl in result.multi_hand_landmarks:
                    mp_draw.draw_landmarks(frame, hl, mp_hands.HAND_CONNECTIONS)

                if collecting:
                    lms = result.multi_hand_landmarks[0].landmark
                    vec = normalize_landmarks(lms)
                    path = os.path.join(save_dir, f"sample_{collected:04d}.npy")
                    np.save(path, vec)
                    collected += 1
                    time.sleep(delay)

            # UI overlay
            status = f"Collecting {sign}: {collected}/{n_samples}" if collecting else "Press SPACE to start"
            color  = (0, 200, 80) if collecting else (180, 60, 220)
            cv2.putText(frame, status, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

            cv2.imshow(f"SignForge Collector — {sign}", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord(' '):
                collecting = True
            elif key == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nSaved {collected} samples to {save_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SignForge landmark data collector")
    parser.add_argument("--sign",    required=True, help="Sign label, e.g. A or HELLO")
    parser.add_argument("--samples", type=int, default=200, help="Number of samples to collect")
    parser.add_argument("--output",  default="data", help="Output directory")
    parser.add_argument("--delay",   type=float, default=0.05, help="Seconds between samples")
    args = parser.parse_args()

    collect(args.sign, args.samples, args.output, args.delay)
