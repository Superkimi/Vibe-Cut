# Reference research

Reference snapshots reviewed on 2026-08-03:

- OpenCut `4d8c49ed0706c4dc145361e01c6b1f1a87cbb863`
- OpenCut classic, official current-use branch at the time of review
- Clypra `c86ea26894661402b5f642aa939aa0799799c745`
- Local pi-web model configuration and provider test implementation
- Timeline Studio / ai-video-editor `13221113cbb1222f4e0cd08fe7367e86bd70156b`
- Palmier Pro `8c0ae39ef7dfd0955514900da6dadafb945dd4f9`

Vibe Cut is a new implementation that adopts architectural lessons without
copying product code; license boundaries for each reference are listed below.

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

## What Vibe Cut takes from Timeline Studio

- Browser-native composition for captions, overlays/PIP, masks, keyframes,
  effects, transitions, and deterministic WebCodecs export.
- Portable project archives and local model/capability fallback patterns.
- A single visual scene model shared by preview and export.

Timeline Studio is MIT licensed at the repository level, but individual model
weights and third-party assets have their own licenses. Vibe Cut does not copy
its source or bundle those weights.

## What Vibe Cut takes from Palmier Pro

- Frame-oriented timing, compact timeline context, @-style object references,
  semantic media inspection, structured mutation deltas, and visual inspection
  frames after an AI edit.
- One domain mutation path for manual UI and agent tools, with undo and
  cancellation-aware jobs.

Palmier Pro is GPLv3 and is macOS/Swift-specific. Its source is not copied into
Vibe Cut's MIT codebase; only product and protocol ideas are independently
reimplemented. Palmier's generative AI backend and model licenses are also not
assumed by this project.

## Product benchmark

Current conversational editing products reinforce four requirements:

- Natural language must compile to editable timeline state, not just a rendered
  black box.
- AI edits need preview, explanation, warnings, undo, and manual refinement.
- Transcript, captions, silence removal, reframing, and social aspect ratios are
  high-value creator workflows.
- The manual editor must remain fully capable when AI is unavailable.
