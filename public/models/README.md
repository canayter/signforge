# SignForge — Model Files

Place ONNX model files here. The frontend loads them at runtime.

## ASL Fingerspelling (A–Z)

**File expected:** `asl_fingerspell.onnx`

### Option 1 — Use the kinivi model (recommended for getting started)

1. Clone: https://github.com/kinivi/hand-gesture-recognition-mediapipe
2. Convert the Keras model to ONNX:

```bash
pip install tf2onnx tensorflow
python -m tf2onnx.convert \
  --saved-model keypoint_classifier/keypoint_classifier.tflite \
  --output asl_fingerspell.onnx
```

3. Place `asl_fingerspell.onnx` in this directory.

### Option 2 — Use a HuggingFace model

- https://huggingface.co/ColdSlim/ASL-TFLite-Edge
  (TFLite → convert to ONNX with tf2onnx)

### Option 3 — Train your own

Use `scripts/collect_data.py` to collect landmark data, then train a classifier.
See the training notebook (coming soon).

---

## Input specification

All models expect:
- **Input name:** (first input in graph)
- **Shape:** `[1, 42]` — float32
- **Values:** 42 normalized landmarks (21 hand points × x, y)
  - Normalized: wrist at origin, scaled to max absolute = 1

## Output specification

- **Shape:** `[1, N]` — float32 softmax scores
- **N:** number of sign classes
- **argmax** = predicted class index → looked up in labels array
