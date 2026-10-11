// recognizer.js — loads the MNIST MLP (TensorFlow.js GraphModel) and classifies
// talisman handwriting. Runs entirely in the browser — no server needed.
import { preprocessToMNIST, tensorFrom28x28 } from './processing.js';
import { softmax } from './utils.js';

const MODEL_URL = new URL('../../mnist_tfjs_model/model.json', import.meta.url).href;

let model = null;
export const aiInfo = { backend: '—', ready: false, latency: 0 };

// Prefer WASM (keeps the GPU free for Three.js), then WebGL, then CPU
async function setupBackend() {
  for (const name of ['wasm', 'webgl', 'cpu']) {
    try {
      if (await tf.setBackend(name)) break;
    } catch { /* try the next backend */ }
  }
  await tf.ready();
  aiInfo.backend = tf.getBackend();
}

async function run(x) {
  try {
    const y = model.predict(x);
    return Array.isArray(y) ? y[0] : y;
  } catch {
    const y = await model.executeAsync({ keras_tensor: x }, 'Identity');
    return Array.isArray(y) ? y[0] : y;
  }
}

export async function initRecognizer() {
  await setupBackend();
  model = await tf.loadGraphModel(MODEL_URL);
  // one full reading (preprocessing + model) of a made-up stroke, so the first
  // real one is as quick as all the others
  const size = 280, stroke = new Uint8ClampedArray(size * size * 4);
  for (let y = 60; y < 220; y++) for (let x = 130; x < 150; x++) stroke.fill(255, (y * size + x) * 4, (y * size + x) * 4 + 4);
  await classify(stroke, size);
  aiInfo.ready = true;
}

// rgba: Uint8ClampedArray of a size×size white-on-black image
// → { probs: number[10], img28: Float32Array(784) }
export async function classify(rgba, size) {
  const { img28 } = preprocessToMNIST(rgba, { srcW: size, srcH: size, roi: 'all', center: true, blur: false });
  const x = tensorFrom28x28(img28);
  const t0 = performance.now();
  const y = await run(x);
  const raw = Array.from(await y.data());
  aiInfo.latency = performance.now() - t0;
  tf.dispose([x, y]);
  const isProb = raw.every((v) => v >= 0) && Math.abs(raw.reduce((a, b) => a + b, 0) - 1) < 1e-3;
  return { probs: isProb ? raw : softmax(raw), img28 };
}
