import './style.css';
import { Energy, clamp, mapCameraPoint, type Collider, type Point } from './physics';
import { Renderer } from './renderer';
import type { NormalizedLandmark, Category } from '@mediapipe/tasks-vision';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = el<HTMLDivElement>('stage'), video = el<HTMLVideoElement>('camera');
const canvas = el<HTMLCanvasElement>('energy'), overlay = el<HTMLCanvasElement>('overlay');
const ctx = overlay.getContext('2d')!;
const start = el<HTMLButtonElement>('start'), status = el<HTMLParagraphElement>('status');
const pause = el<HTMLButtonElement>('pause'), skeleton = el<HTMLInputElement>('skeleton');
const energy = new Energy();
let renderer: Renderer | undefined;
let paused = false, stream: MediaStream | undefined, worker: Worker | undefined;
let ready = false, busy = false, session = 0, loading = false;
let cancelLoading: (() => void) | undefined;
let lastFrameTime = -1, lastSent = 0, lastResult = 0;
let tracked: Point[][] = [], handColliders: Collider[] = [];
let previousHands = new Map<string, { points: Point[]; timestamp: number }>();
let pointer: Collider | undefined, pointerTime = 0;
let lastAnimation = performance.now();
const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

function message(text: string, error = false) { status.textContent = text; status.classList.toggle('error', error); }
try { renderer = new Renderer(canvas); }
catch (error) { message(error instanceof Error ? error.message : String(error), true); start.disabled = true; }

function clearHands() { tracked = []; handColliders = []; previousHands.clear(); lastResult = 0; }
function resize() {
  const r = stage.getBoundingClientRect();
  energy.resize(r.width, r.height); renderer?.resize(r.width, r.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  overlay.width = Math.round(r.width * dpr); overlay.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clearHands(); pointer = undefined;
}
new ResizeObserver(resize).observe(stage);
resize();

stage.addEventListener('pointermove', (event) => {
  if (event.target instanceof Element && event.target.closest('button')) return;
  const rect = stage.getBoundingClientRect(), now = performance.now();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const prev = pointer && now - pointerTime < 150 ? pointer : undefined;
  const dt = Math.max(.008, (now - pointerTime) / 1000);
  pointer = { x, y, px: prev?.x ?? x, py: prev?.y ?? y, vx: prev ? clamp((x - prev.x) / dt, -1800, 1800) : 0, vy: prev ? clamp((y - prev.y) / dt, -1800, 1800) : 0, radius: 26 };
  pointerTime = now;
});
stage.addEventListener('pointerdown', event => {
  if (!(event.target instanceof Element && event.target.closest('button'))) stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointerleave', () => { pointer = undefined; });
stage.addEventListener('pointercancel', () => { pointer = undefined; });
stage.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') pointer = undefined; });

function updateHands(landmarks: NormalizedLandmark[][], handedness: Category[][], timestamp: number) {
  const next = new Map<string, { points: Point[]; timestamp: number }>();
  handColliders = [];
  tracked = landmarks.map((hand, index) => {
    const points = hand.map(p => mapCameraPoint(p, video.videoWidth, video.videoHeight, energy.width, energy.height));
    const key = handedness[index]?.[0]?.categoryName ?? String(index);
    const prev = previousHands.get(key);
    const valid = prev && timestamp - prev.timestamp < 200;
    const dt = valid ? Math.max(.01, (timestamp - prev.timestamp) / 1000) : 1;
    const palmRadius = clamp(Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y) * .42, 15, 65);
    // Finger joints cover the whole hand, rather than only five tiny tips.
    for (const id of [0,4,5,6,8,9,10,12,13,14,16,17,18,20]) {
      const p = points[id], old = valid ? prev.points[id] : p;
      handColliders.push({ ...p, px: old.x, py: old.y, vx: clamp((p.x - old.x) / dt, -1800, 1800), vy: clamp((p.y - old.y) / dt, -1800, 1800), radius: [0,5,9,13,17].includes(id) ? palmRadius * .65 : palmRadius * .32 });
    }
    const center = (list: Point[]) => ({ x: [0,5,9,13,17].reduce((a,id) => a+list[id].x,0)/5, y: [0,5,9,13,17].reduce((a,id) => a+list[id].y,0)/5 });
    const palm = center(points), oldPalm = valid ? center(prev.points) : palm;
    handColliders.push({ ...palm, px: oldPalm.x, py: oldPalm.y, vx: clamp((palm.x-oldPalm.x)/dt,-1800,1800), vy: clamp((palm.y-oldPalm.y)/dt,-1800,1800), radius: palmRadius });
    next.set(key, { points, timestamp });
    return points;
  });
  previousHands = next; lastResult = performance.now();
  el('hand-count').textContent = tracked.length ? `${tracked.length} hand${tracked.length === 1 ? "" : "s"} detected` : 'Bring your hands into view';
}

function stopCamera(showMessage = true) {
  session++; loading = false; ready = false; busy = false;
  cancelLoading?.(); cancelLoading = undefined;
  worker?.terminate(); worker = undefined;
  stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  video.pause(); video.srcObject = null; clearHands();
  stage.classList.remove('camera-on');
  start.disabled = !renderer; start.innerHTML = 'Enable camera <span>↗</span>';
  el('mode').textContent = 'Mouse mode'; el('indicator').classList.remove('active');
  el('hand-count').textContent = 'Move your pointer to push';
  el('hint').textContent = 'Move to push · Swipe on touchscreens';
  if (showMessage) message('Camera off. You can keep playing with your mouse or touchscreen.');
}

async function startCamera() {
  if (stream || loading) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia) { message('Camera unavailable. Use Chrome on localhost or HTTPS. Mouse mode is still available.', true); return; }
  loading = true; start.disabled = true;
  const token = ++session;
  message('Requesting camera permission…');
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
    if (token !== session) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired; video.srcObject = acquired;
    await video.play();
    if (token !== session) return;
    stage.classList.add('camera-on');
    message('Loading hand tracking. The first startup may take a moment…');
    start.disabled = false; start.textContent = 'Disable camera';
    const currentWorker = new Worker(new URL(`${import.meta.env.BASE_URL}tracking.worker.js`, window.location.href));
    worker = currentWorker;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Hand tracking took too long to load. Disable the camera and try again. If this persists, run npm run setup.')), 45000);
      cancelLoading = () => { clearTimeout(timer); resolve(); };
      currentWorker.onerror = () => {
        clearTimeout(timer);
        if (token !== session) return;
        if (!ready) reject(new Error('Could not start hand tracking. Run npm run setup, then restart.'));
        else { stopCamera(false); message('The hand tracking worker stopped. Re-enable the camera or continue with your mouse.', true); }
      };
      currentWorker.onmessage = ({ data }) => {
        if (token !== session) { clearTimeout(timer); resolve(); return; }
        if (data.type === 'ready') { clearTimeout(timer); ready = true; resolve(); }
        else if (data.type === 'result') { busy = false; updateHands(data.landmarks, data.handedness, data.timestamp); }
        else if (data.type === 'error') {
          clearTimeout(timer);
          if (!ready) reject(new Error('Could not load the hand tracking model. Run npm run setup, then restart.'));
          else { stopCamera(false); message('Hand tracking stopped. Re-enable the camera or continue with your mouse.', true); }
          console.error('Hand tracking:', data.message);
        }
      };
      currentWorker.postMessage({ type: 'init', base: new URL(import.meta.env.BASE_URL, window.location.href).href });
    });
    if (token !== session) return;
    cancelLoading = undefined; loading = false; lastFrameTime = -1; lastSent = 0;
    el('mode').textContent = 'Camera on'; el('indicator').classList.add('active');
    el('hint').textContent = 'Keep your whole hand in view · Push slowly, swipe quickly';
    message('Hand tracking is ready. Reach out and touch the energy with your fingertips or palm.');
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (token === session) stopCamera(); });
  } catch (error) {
    if (token !== session) return;
    stopCamera(false);
    const name = error instanceof Error ? error.name : '';
    message(name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access and try again, or continue with your mouse.' : name === 'NotFoundError' ? 'No camera found. Connect one and try again, or continue with your mouse.' : name === 'NotReadableError' ? 'Your camera may be in use. Close other apps using it, then try again.' : error instanceof Error ? error.message : 'Could not start the camera. Please try again.', true);
  }
}

start.addEventListener('click', () => { void startCamera(); });
pause.addEventListener('click', () => {
  paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(paused));
  clearHands(); pointer = undefined;
});
el('reset').addEventListener('click', () => { energy.reset(); });
for (const name of ['flow','strength'] as const) {
  el<HTMLInputElement>(name).addEventListener('input', event => {
    const value = Number((event.target as HTMLInputElement).value);
    energy[name] = value; el<HTMLOutputElement>(`${name}-value`).value = value.toFixed(1);
  });
}
el('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.requestFullscreen) await stage.requestFullscreen();
    else message('Fullscreen is unavailable in this browser. Rotate your device or enlarge the window.');
  } catch { message('Could not enter fullscreen. Try your browser’s fullscreen option.'); }
});
document.addEventListener('visibilitychange', () => { clearHands(); pointer = undefined; lastAnimation = performance.now(); });
window.addEventListener('pagehide', () => stopCamera(false));

async function sendFrame(now: number) {
  if (!ready || !worker || busy || paused || document.hidden || video.readyState < 2 || video.currentTime === lastFrameTime || now - lastSent < 50) return;
  const token = session, currentWorker = worker;
  busy = true; lastSent = now; lastFrameTime = video.currentTime;
  try {
    const bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeHeight: Math.max(1, Math.round(640 * video.videoHeight / video.videoWidth)) });
    if (token !== session || worker !== currentWorker) { bitmap.close(); return; }
    currentWorker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
  } catch { if (token === session) { stopCamera(false); message('This browser could not process the camera video. Use the latest Chrome or continue with your mouse.', true); } }
}

function animate(now: number) {
  const dt = Math.min((now - lastAnimation) / 1000, 1 / 30); lastAnimation = now;
  if (now - lastResult > 200) { tracked = []; handColliders = []; if (ready) el('hand-count').textContent = 'Bring your hands into view'; }
  const pointerAge = now - pointerTime;
  const mouse = pointer && pointerAge < 220 ? [{ ...pointer, px: pointerAge < 40 ? pointer.px : pointer.x, py: pointerAge < 40 ? pointer.py : pointer.y, vx: pointerAge < 40 ? pointer.vx : 0, vy: pointerAge < 40 ? pointer.vy : 0 }] : [];
  // Decay stale velocity between inference frames to avoid continually applying old impulses.
  const handAge = now - lastResult;
  const hands = handColliders.map(c => handAge < 65 ? c : { ...c, px:c.x, py:c.y, vx:0, vy:0 });
  if (!paused && !document.hidden) energy.step(dt, [...hands, ...mouse]);
  renderer?.draw(energy);
  ctx.clearRect(0,0,energy.width,energy.height);
  if (skeleton.checked && !paused) {
    ctx.strokeStyle = '#ddf4deaa'; ctx.fillStyle = '#edfbed'; ctx.lineWidth = 1.5;
    for (const points of tracked) {
      ctx.beginPath();
      for (const [a,b] of bones) { ctx.moveTo(points[a].x,points[a].y); ctx.lineTo(points[b].x,points[b].y); }
      ctx.stroke();
      for (const id of [4,8,12,16,20]) { ctx.beginPath(); ctx.arc(points[id].x,points[id].y,4,0,Math.PI*2); ctx.fill(); }
    }
  }
  if (mouse.length && !paused) {
    ctx.strokeStyle = '#687b6890'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(mouse[0].x,mouse[0].y,26,0,Math.PI*2); ctx.stroke();
  }
  void sendFrame(now);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
