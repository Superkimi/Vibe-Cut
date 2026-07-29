# Reference research

Reference snapshots reviewed on 2026-07-29:

- OpenCut `4d8c49ed0706c4dc145361e01c6b1f1a87cbb863`
- OpenCut classic, official current-use branch at the time of review
- Clypra `c86ea26894661402b5f642aa939aa0799799c745`
- Local pi-web model configuration and provider test implementation

All three reference projects are MIT licensed. Vibe Cut is a new implementation
that adopts architectural lessons without copying product code.

## What Vibe Cut takes from OpenCut

- Browser-first media workflows and a deployable web product.
- A normalized, serializable project schema with scenes/tracks/elements.
- Command objects for reversible edits.
- MediaBunny and WebCodecs as the high-quality browser export path.
- Separate project settings, timeline view state, and media storage.

OpenCut's current `main` branch is an early rewrite, so the official classic
repository was also studied for its production editor structure.

## What Vibe Cut takes from Clypra

- Timeline state as the single editable source of truth.
- Render, playback, and export consume immutable snapshots.
- Explicit timeline epoch/revision for invalidation and stale-write protection.
- Source-time math, snapping, ripple intent, transition entities, and track
  locks.
- Waveform and filmstrip work stays away from the React render path.

Clypra is native-first and relies on Tauri, Rust FFmpeg, and a separate engine
package. Those parts are not portable to a hosted Web product.

## What Vibe Cut takes from pi-web

- Provider/model configuration as structured data.
- A connection test before the provider is used.
- Password-style API key fields with explicit reveal controls.
- Clear distinction between provider, base URL, API dialect, model, and
  reasoning controls.

Vibe Cut does not reuse pi sessions, its agent runtime, or its configuration
files. The assistant is purpose-built around the video edit-plan schema.

## Product benchmark

Current conversational editing products reinforce four requirements:

- Natural language must compile to editable timeline state, not just a rendered
  black box.
- AI edits need preview, explanation, warnings, undo, and manual refinement.
- Transcript, captions, silence removal, reframing, and social aspect ratios are
  high-value creator workflows.
- The manual editor must remain fully capable when AI is unavailable.
