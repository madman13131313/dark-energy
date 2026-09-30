# Dark Energy

An interactive experiment in living digital matter. Push a floating mass of dark energy with your palms and fingertips, or explore it with your mouse. Slow contact deforms its surface; a fast swipe sends it drifting before it gathers again.

Built with **Vite, TypeScript, MediaPipe, and native WebGL**. The first prototype focuses on flow, weight, and tactile feedback.

## Run locally

Use Chrome, Git, and **Node.js 22.12 or a newer LTS release**:

```sh
git clone https://github.com/madman13131313/dark-energy.git
cd dark-energy
npm install
npm run dev
```

If the repository is private, cloning requires a GitHub account with access. You can also use **Code → Download ZIP**, extract it, and run the npm commands in the project directory.

Open the address printed by Vite in Chrome, normally **http://localhost:5173**. If that port is occupied, use the address shown in your terminal.

1. Move your mouse to push the energy. No click or camera is required.
2. Select **Enable camera** and allow camera access.
3. Keep your whole hand in view. Touch the energy with your fingertips or palm; up to two hands are supported.
4. Push slowly to deform it, or swipe quickly to send it away. Stop and watch it gather and float again.
5. Adjust **Flow** and **Push strength**, pause, reset, toggle hand tracking, or enter fullscreen.
6. **Disable camera** stops the video tracks and terminates the tracking worker. Mouse mode remains available.

The first installation copies the pinned MediaPipe SDK / WASM and downloads the approximately 7.5 MB hand model from Google’s official model storage. Setup requires internet access; inference then runs locally with no remote inference service.

If the model download fails, mouse mode still works. Once your connection is available, run:

```sh
npm run setup
```

## Features and limitations

- Mirrored camera preview with the complete video frame preserved; hand coordinates map to the actual displayed video area.
- Two-hand MediaPipe tracking, with fingertips, finger joints, and palms forming contact regions.
- An elastic particle cluster with a continuous WebGL metaball surface: a dark core, subtle oil-like edges, and a moving silhouette.
- Contact repulsion, swipe momentum, boundary bounce, and regrouping after deformation.
- Mouse and touchscreen interaction, with recovery messages for camera or model failures.
- Finger snaps, merging, cutting, grabbing, and stretching are future directions and are not implemented.

This is a **2D camera-overlay experiment**. It does not model physical depth or hand occlusion: overlapping positions in the image create contact. Tracking stability and interaction feel still need real-camera testing and tuning. Desktop Chrome is the primary target; real iPhone / iPad camera compatibility has not been verified.

## Privacy

Camera access is requested only after you select **Enable camera**. The app does not request microphone access, record, save, or upload camera video. There is no analytics or backend service. The SDK, WASM, and model are downloaded during setup and served locally during development. On a hosted demo, these assets are served by the website; camera processing still happens in the visitor’s browser.

## Development

The prototype uses separate physics and rendering modules without React, Next.js, or Three.js.

```sh
npm test       # Coordinate mapping, swept contact, simulation stability and regrouping
npm run build  # TypeScript checks and production build
npm run preview
```

Hand inference runs in a classic Web Worker. At most 20 frames are sent per second, with only one frame in flight. Rendering runs independently, stale hand positions are cleared, and returning to the foreground does not replay accumulated simulation time.

```text
src/main.ts                Camera, interaction, UI, and lifecycle
src/physics.ts             Elastic particles, contact forces, and mirrored coordinates
src/renderer.ts            Continuous WebGL surface
public/tracking.worker.js  MediaPipe background inference
scripts/setup-assets.mjs   Local SDK and model preparation
```

## Sharing a demo

A resume demo needs a public HTTPS address. This project can be hosted as a static website: install dependencies, ensure the hand model is present, run `npm run build`, and publish the complete `dist/` directory, including the tracking worker, SDK, WASM, and model assets. Visitors can try mouse mode immediately and opt into camera access.

GitHub Pages is one option. For a project URL under `/dark-energy/`, Vite needs that base path configured, and the home link must respect it. A GitHub Actions workflow can install dependencies and publish the build. No deployment has been configured yet. See the [Vite deployment guide](https://vite.dev/guide/static-deploy.html) and [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Troubleshooting

- **Camera unavailable:** Use localhost or HTTPS and allow camera access in Chrome. Plain HTTP on a local network usually cannot access the camera.
- **Camera in use:** Close video-call apps or other tabs using your camera.
- **Model loading failed:** Run `npm run setup` and restart. Do not open `index.html` directly from disk.
- **Unstable tracking:** Use good lighting, keep your hand distinct from the background, avoid moving too close to the lens, and begin with slow gestures.
- **Energy invisible / WebGL unavailable:** Check Chrome’s hardware acceleration setting. This prototype requires WebGL.
- **Push too strong or weak:** Adjust **Push strength**. Interaction is not calibrated; distance from the camera affects the palm contact area.

Reference: [Google MediaPipe Hand Landmarker guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Dependencies and model assets retain their respective licenses. This project does not currently grant an additional open-source license.
