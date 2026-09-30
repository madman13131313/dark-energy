# Changelog

Newest entries appear first.

## 2026-09-30 · GitHub Pages path preparation

- Set Vite's base path to `/dark-energy/` and made the wordmark home link follow the configured base.
- Validation: all three physics tests, TypeScript checks, and the production build passed. Built HTML uses the project prefix for scripts, styles, and the home link; the tracking worker and hand model are included in `dist/`.
- This prepares paths only. No deployment workflow was added and no site was published; hosted camera behavior remains unverified.

## 2026-09-30 · English interface and documentation

- Translated the full app interface into English, including controls, instructions, status messages, camera recovery prompts, WebGL errors, page metadata, and accessibility labels.
- Set the document language to English and translated the README and existing changelog for an English-speaking audience.
- Added guidance for sharing a public HTTPS resume demo; no hosting or deployment was configured.
- Preserved the existing physics, rendering, tracking, and camera behavior.
- Validation: all three physics tests, TypeScript checks, and the production build passed. Browser inspection confirmed English desktop and 390px layouts and Pause / Resume labels; no Chinese text remains in the app source or documentation.
- Real-camera interaction remains subject to user testing; translation checks do not establish device compatibility or interaction quality.

## 2026-09-30 · v0.1.0 · First runnable prototype

- Initialized the Vite / TypeScript project with pinned dependencies and a committed lockfile.
- Added mirrored camera preview, two-hand tracking, and a hand-overlay toggle.
- Moved hand inference into a Worker with locally served assets and no video uploads.
- Added an elastic particle cluster and WebGL metaball surface with floating, silhouette variation, contact deformation, pushing, bounce, and regrouping.
- Added mouse / touchscreen interaction, pause, reset, fullscreen, and two interaction controls.
- Added resource cleanup on camera shutdown and page exit, camera restart, and permission / model recovery prompts.
- Added setup and usage documentation, an asset setup script, and physics tests.
- Original prototype validation: TypeScript / production build; three physics tests; standalone Chromium with a simulated camera, official hand-sample inference, shutdown / restart, and desktop / 390px mobile layouts.
- Pending: user testing with a real camera and interaction feedback. Finger snaps, cutting, and merging are deferred.
