# Family Slideshow Maker — code/doc parity (2026-10-17)

**Reviewed:** `main` at `6e3c43bca3`, `slideshow-mvp/README.md`, `slideshow-mvp/index.html`, `slideshow-mvp/app.js`. Static review; no video rendering or browser test.

## Current architecture
- Single static web app rooted at `slideshow-mvp/index.html`; presentation in `styles.css`; local editor behavior in `app.js`.
- `app.js` holds slide selection, media/audio state, image crop/zoom, keyframe positions, preview, face-detector readiness, browser export progress/cache and save/load controls.
- README claims in-browser MP4 only where supported by the host browser, with WebM fallback. This is a capability-dependent contract, **not** a guarantee that every browser exports MP4.
- No separate build/deployment CI workflow or automated test suite is present in the inspected repository tree.

## Follow-up
Keep the MVP's README as the primary document; add a tested-browser compatibility matrix only after running real exports and reload tests. Verify preservation of local projects before changing storage. Do not delete media handlers, alternate exports, project state, or local assets based only on age.

Nothing executable was modified or deleted.
