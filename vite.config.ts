import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed at ayter.com/signforge/
export default defineConfig({
  base: '/signforge/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    // Required for SharedArrayBuffer (ONNX WASM multithreading)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Keep WASM files separate from main bundle
        manualChunks: {
          mediapipe: ['@mediapipe/tasks-vision'],
          onnx: ['onnxruntime-web'],
        },
      },
    },
  },
})
