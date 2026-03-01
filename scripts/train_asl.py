"""
SignForge — ASL Fingerspelling Model Trainer
=============================================
Trains a small MLP on the Kaggle ASL Alphabet dataset using MediaPipe
hand landmarks. You do NOT need to know sign language — the dataset
was filmed by other people.

Requirements (run once in Anaconda Prompt):
    pip install mediapipe opencv-python numpy scikit-learn skl2onnx

Dataset:
    1. Go to: https://www.kaggle.com/datasets/grassknoted/asl-alphabet
    2. Click Download (~1 GB)
    3. Extract the zip — you'll have a folder called asl_alphabet_train
       containing another asl_alphabet_train/ with A/, B/, C/ ... Z/ folders.

Usage:
    cd "c:/Users/canay/OneDrive/Documents/Work/Codegoat/signforge"
    python scripts/train_asl.py --data path/to/asl_alphabet_train/asl_alphabet_train

    Quick test (faster, ~80% acc):
    python scripts/train_asl.py --data path/to/... --max 200

Output:
    ../ayter_com/signforge/models/asl_fingerspell.onnx
    → FTP this file to signforge/models/asl_fingerspell.onnx on the server.
"""

import argparse
import os
import glob
import time
import urllib.request
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import skl2onnx
from skl2onnx.common.data_types import FloatTensorType

LANDMARKER_MODEL = os.path.join(os.path.dirname(__file__), 'hand_landmarker.task')
LANDMARKER_URL   = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

def _ensure_model():
    if not os.path.exists(LANDMARKER_MODEL):
        print('  Downloading MediaPipe hand landmarker model (~8 MB)...')
        urllib.request.urlretrieve(LANDMARKER_URL, LANDMARKER_MODEL)
        print(f'  Saved: {LANDMARKER_MODEL}')


# ── Label order MUST match ASL_LABELS in SignForge index.html ─────────────────
LABEL_ORDER = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + ['SPACE', 'NOTHING', 'DEL']
LABEL_TO_IDX = {label: i for i, label in enumerate(LABEL_ORDER)}

# Kaggle folder names → our label names
FOLDER_MAP = {letter: letter for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}
FOLDER_MAP.update({'del': 'DEL', 'nothing': 'NOTHING', 'space': 'SPACE'})


# ── MediaPipe landmark extraction ─────────────────────────────────────────────

def normalize_landmarks(landmarks):
    """
    Translate wrist to origin, scale by max absolute value.
    Returns float32 array of shape (42,) — matches collect_data.py exactly.
    """
    pts = np.array([[lm.x, lm.y] for lm in landmarks], dtype=np.float32)
    pts -= pts[0]                       # wrist at (0, 0)
    max_abs = np.abs(pts).max()
    if max_abs > 0:
        pts /= max_abs                  # scale to [-1, 1]
    return pts.flatten()


def extract_features(detector, image_path):
    """Run MediaPipe Tasks HandLandmarker on one image and return normalized landmarks, or None."""
    img = cv2.imread(image_path)
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)
    if result.hand_landmarks:
        return normalize_landmarks(result.hand_landmarks[0])
    return None


# ── Training pipeline ─────────────────────────────────────────────────────────

def collect_features(data_dir, max_per_class):
    _ensure_model()
    options = mp_vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=LANDMARKER_MODEL),
        num_hands=1,
        min_hand_detection_confidence=0.3,
        running_mode=mp_vision.RunningMode.IMAGE,
    )
    detector = mp_vision.HandLandmarker.create_from_options(options)

    features, labels = [], []
    total_ok = total_fail = 0

    folders = sorted(os.listdir(data_dir))
    for folder in folders:
        if folder not in FOLDER_MAP:
            print(f'  Skipping unknown folder: {folder}')
            continue
        label     = FOLDER_MAP[folder]
        label_idx = LABEL_TO_IDX[label]
        class_dir = os.path.join(data_dir, folder)

        image_files = (
            glob.glob(os.path.join(class_dir, '*.jpg')) +
            glob.glob(os.path.join(class_dir, '*.JPG')) +
            glob.glob(os.path.join(class_dir, '*.png'))
        )[:max_per_class]

        ok = fail = 0
        for img_path in image_files:
            feat = extract_features(detector, img_path)
            if feat is not None:
                features.append(feat)
                labels.append(label_idx)
                ok += 1
            else:
                fail += 1

        total_ok   += ok
        total_fail += fail
        bar = '█' * (ok // 20)
        print(f'  {label:8s}  {ok:4d} ok  {fail:3d} no-hand  {bar}')

    detector.close()
    print(f'\n  Total: {total_ok} samples extracted  ({total_fail} images had no detectable hand)')
    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.int64)


def train_and_export(data_dir, max_per_class, output_path):
    print(f'\n{"="*60}')
    print(f'  SignForge ASL Trainer')
    print(f'{"="*60}')
    print(f'  Dataset:     {data_dir}')
    print(f'  Max/class:   {max_per_class}')
    print(f'  Output:      {output_path}')
    print(f'{"="*60}\n')

    # ── Step 1: Extract landmarks ──────────────────────────────────────────
    print('STEP 1 / 3 — Extracting MediaPipe landmarks from images...\n')
    t0 = time.time()
    X, y = collect_features(data_dir, max_per_class)
    print(f'\n  Done in {time.time()-t0:.0f}s')

    if len(X) == 0:
        print('\nERROR: No features extracted. Check --data path.')
        return

    # ── Step 2: Train MLP ──────────────────────────────────────────────────
    print('\nSTEP 2 / 3 — Training MLP classifier...\n')
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y,
    )
    print(f'  Train: {len(X_train)}  Test: {len(X_test)}\n')

    clf = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        activation='relu',
        solver='adam',
        max_iter=500,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1,
        verbose=True,
    )
    clf.fit(X_train, y_train)

    acc = clf.score(X_test, y_test)
    print(f'\n  Test accuracy: {acc:.4f}  ({acc*100:.1f}%)')
    print()
    print(classification_report(
        y_test, clf.predict(X_test),
        target_names=LABEL_ORDER[:len(set(y))],
        zero_division=0,
    ))

    # ── Step 3: Export to ONNX ─────────────────────────────────────────────
    print('STEP 3 / 3 — Exporting to ONNX...')
    initial_type = [('float_input', FloatTensorType([None, 42]))]
    onx = skl2onnx.convert_sklearn(
        clf,
        initial_types=initial_type,
        options={id(clf): {'zipmap': False}},  # get flat float array, not dict
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(onx.SerializeToString())

    print(f'\n{"="*60}')
    print(f'  Model saved → {output_path}')
    print(f'  Input shape:  float32[1, 42]')
    print(f'  Outputs:      output_label (int64[1])')
    print(f'                output_probability (float32[1, {len(set(y))}])')
    print(f'  Label order:  {LABEL_ORDER[:len(set(y))]}')
    print(f'{"="*60}')
    print(f'\nNext step: FTP this file to signforge/models/asl_fingerspell.onnx')
    print(f'The site will automatically activate sign classification.\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SignForge ASL fingerspelling model trainer')
    parser.add_argument(
        '--data',
        default=os.path.join('asl_alphabet_train', 'asl_alphabet_train'),
        help='Path to the inner asl_alphabet_train folder (contains A/, B/, ... folders)',
    )
    parser.add_argument(
        '--max', type=int, default=500,
        help='Max images per class to process. 500=full quality, 200=fast test (default: 500)',
    )
    parser.add_argument(
        '--output',
        default=os.path.join('..', 'ayter_com', 'signforge', 'models', 'asl_fingerspell.onnx'),
        help='Output path for the ONNX model file',
    )
    args = parser.parse_args()
    train_and_export(args.data, args.max, args.output)
