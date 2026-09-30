import { mkdir, cp, access, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assets = path.join(root, 'public/assets');
await mkdir(assets, { recursive: true });
await cp(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), path.join(assets, 'wasm'), { recursive: true });
await cp(path.join(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.js'), path.join(assets, 'vision_bundle.js'));
const model = path.join(assets, 'hand_landmarker.task');
try { await access(model); }
catch {
  console.log('Downloading the official MediaPipe hand model (one-time setup)…');
  try {
    const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`Model download returned ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(model + '.tmp'));
    await rename(model + '.tmp', model);
  } catch (error) {
    await rm(model + '.tmp', { force: true });
    console.warn('Hand model setup failed. Mouse mode still works. Run npm run setup when connected to the internet.');
    console.warn(error.message);
  }
}
