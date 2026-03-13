"""
SignForge — ASL Fingerspelling Model Trainer (PyTorch)
======================================================
Uses PyTorch MLP + torch.onnx.export for guaranteed onnxruntime-web
browser compatibility. Replaces the old skl2onnx approach which had
WASM backend operator compatibility issues.

Requirements (in the 'signforge' conda env):
    pip install torch opencv-python mediapipe scikit-learn

Usage:
    python scripts/train_asl.py --data path/to/asl_alphabet_train/asl_alphabet_train

Dataset:
    https://www.kaggle.com/datasets/grassknoted/asl-alphabet  (~1 GB)
    Extract → use the inner asl_alphabet_train/ folder (has A/, B/ ... Z/)

Output:
    public/models/asl_fingerspell.onnx
    FTP this file to signforge/models/asl_fingerspell.onnx on the server.
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
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import torch
import torch.nn as nn


# ── Config ────────────────────────────────────────────────────────────────────
LANDMARKER_MODEL = os.path.join(os.path.dirname(__file__), 'hand_landmarker.task')
LANDMARKER_URL   = ('https://storage.googleapis.com/mediapipe-models/'
                    'hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task')

# Label order MUST match ASL_LABELS in src/hooks/useONNXInference.ts
LABEL_ORDER  = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + ['SPACE', 'NOTHING', 'DEL']
LABEL_TO_IDX = {label: i for i, label in enumerate(LABEL_ORDER)}

FOLDER_MAP = {letter: letter for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'}
FOLDER_MAP.update({'del': 'DEL', 'nothing': 'NOTHING', 'space': 'SPACE'})


# ── MediaPipe feature extraction ──────────────────────────────────────────────

def _ensure_landmarker():
    if not os.path.exists(LANDMARKER_MODEL):
        print('  Downloading MediaPipe hand landmarker (~8 MB)...')
        urllib.request.urlretrieve(LANDMARKER_URL, LANDMARKER_MODEL)
        print(f'  Saved: {LANDMARKER_MODEL}')


def normalize_landmarks(landmarks):
    """Translate wrist to origin, scale by max abs. Returns float32 (63,)."""
    pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
    pts -= pts[0]
    max_abs = np.abs(pts).max()
    if max_abs > 0:
        pts /= max_abs
    return pts.flatten()  # (63,)


def extract_features(detector, image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)
    if result.hand_landmarks:
        return normalize_landmarks(result.hand_landmarks[0])
    return None


def collect_features(data_dir, max_per_class):
    _ensure_landmarker()
    options = mp_vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=LANDMARKER_MODEL),
        num_hands=1,
        min_hand_detection_confidence=0.3,
        running_mode=mp_vision.RunningMode.IMAGE,
    )
    detector = mp_vision.HandLandmarker.create_from_options(options)

    features, labels = [], []
    total_ok = total_fail = 0

    for folder in sorted(os.listdir(data_dir)):
        if folder not in FOLDER_MAP:
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
    print(f'\n  Total: {total_ok} samples  ({total_fail} images had no detectable hand)')
    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.int64)


# ── Model ─────────────────────────────────────────────────────────────────────

class ASLNet(nn.Module):
    """Small MLP: 63 → 512 → 256 → 128 → 64 → n_classes → Softmax"""
    def __init__(self, n_classes: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(63,  512), nn.ReLU(), nn.Dropout(0.30),
            nn.Linear(512, 256), nn.ReLU(), nn.Dropout(0.20),
            nn.Linear(256, 128), nn.ReLU(), nn.Dropout(0.10),
            nn.Linear(128,  64), nn.ReLU(),
            nn.Linear(64, n_classes),
            nn.Softmax(dim=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Training ──────────────────────────────────────────────────────────────────

def train(X: np.ndarray, y: np.ndarray, n_classes: int) -> ASLNet:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    print(f'  Train: {len(X_train)}  Test: {len(X_test)}\n')

    model     = ASLNet(n_classes)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=8, factor=0.5)
    criterion = nn.CrossEntropyLoss()

    X_tr = torch.FloatTensor(X_train)
    y_tr = torch.LongTensor(y_train)
    X_te = torch.FloatTensor(X_test)
    y_te = torch.LongTensor(y_test)

    loader = torch.utils.data.DataLoader(
        torch.utils.data.TensorDataset(X_tr, y_tr),
        batch_size=256, shuffle=True
    )

    best_acc   = 0.0
    best_state = None
    no_improve = 0

    for epoch in range(300):
        model.train()
        for xb, yb in loader:
            optimizer.zero_grad()
            # Use raw logits (before softmax) for CrossEntropyLoss
            logits = model.net[:-1](xb)  # skip Softmax layer for loss
            loss   = criterion(logits, yb)
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            probs     = model(X_te)
            preds     = probs.argmax(1)
            acc       = (preds == y_te).float().mean().item()

        scheduler.step(1.0 - acc)

        if acc > best_acc:
            best_acc   = acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1

        if (epoch + 1) % 20 == 0:
            print(f'  Epoch {epoch+1:3d}  val_acc={acc:.4f}  best={best_acc:.4f}')

        if no_improve >= 25:
            print(f'  Early stop at epoch {epoch + 1}')
            break

    model.load_state_dict(best_state)
    model.eval()

    with torch.no_grad():
        final_preds = model(X_te).argmax(1).numpy()

    print(f'\n  Final test accuracy: {best_acc:.4f}  ({best_acc * 100:.1f}%)\n')
    print(classification_report(
        y_te.numpy(), final_preds,
        target_names=LABEL_ORDER[:n_classes],
        zero_division=0,
    ))

    return model


# ── ONNX export ───────────────────────────────────────────────────────────────

def export_onnx(model: ASLNet, output_path: str, n_classes: int):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    dummy = torch.zeros(1, 63)

    torch.onnx.export(
        model,
        dummy,
        output_path,
        input_names=['float_input'],
        output_names=['output_probability'],
        dynamic_axes={
            'float_input':        {0: 'batch'},
            'output_probability': {0: 'batch'},
        },
        opset_version=12,
        do_constant_folding=True,
    )

    print(f'\n{"="*60}')
    print(f'  Model saved → {output_path}')
    print(f'  Input:   float_input        float32[1, 63]')
    print(f'  Output:  output_probability float32[1, {n_classes}]')
    print(f'  Label order: {LABEL_ORDER[:n_classes]}')
    print(f'{"="*60}')
    print(f'\nNext step: FTP this file to signforge/models/asl_fingerspell.onnx\n')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='SignForge ASL trainer (PyTorch)')
    parser.add_argument(
        '--data',
        default=os.path.join('asl_alphabet_train', 'asl_alphabet_train'),
        help='Path to the inner asl_alphabet_train folder (contains A/, B/ ... folders)',
    )
    parser.add_argument(
        '--max', type=int, default=500,
        help='Max images per class (500=full, 200=fast test)',
    )
    parser.add_argument(
        '--output',
        default=os.path.join('public', 'models', 'asl_fingerspell.onnx'),
        help='Output path for the ONNX model file',
    )
    args = parser.parse_args()

    print(f'\n{"="*60}')
    print(f'  SignForge ASL Trainer (PyTorch)')
    print(f'{"="*60}')
    print(f'  Dataset:   {args.data}')
    print(f'  Max/class: {args.max}')
    print(f'  Output:    {args.output}')
    print(f'{"="*60}\n')

    # Step 1: Extract landmarks
    print('STEP 1 / 3 — Extracting MediaPipe landmarks...\n')
    t0 = time.time()
    X, y = collect_features(args.data, args.max)
    print(f'\n  Done in {time.time() - t0:.0f}s')

    if len(X) == 0:
        print('\nERROR: No features extracted. Check --data path.')
        return

    n_classes = len(set(y.tolist()))

    # Step 2: Train
    print(f'\nSTEP 2 / 3 — Training PyTorch MLP ({n_classes} classes)...\n')
    model = train(X, y, n_classes)

    # Step 3: Export
    print('STEP 3 / 3 — Exporting to ONNX (opset 12)...')
    export_onnx(model, args.output, n_classes)


if __name__ == '__main__':
    main()
