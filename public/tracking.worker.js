/* Classic worker: MediaPipe's WASM loader uses importScripts. */
let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      if (typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas is unavailable in this browser worker.');
      }
      importScripts(data.base + 'assets/vision_bundle.js');
      const files = await Vision.FilesetResolver.forVisionTasks(data.base + 'assets/wasm');
      tracker = await Vision.HandLandmarker.createFromOptions(files, {
        canvas: new OffscreenCanvas(1, 1),
        baseOptions: { modelAssetPath: data.base + 'assets/hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .55,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        if (!tracker) throw new Error('Tracker is not ready');
        const result = tracker.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({ type: 'result', landmarks: result.landmarks, handedness: result.handedness, timestamp: data.timestamp });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    console.error('Hand tracking worker:', error);
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};
