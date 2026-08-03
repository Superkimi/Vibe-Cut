# Vibe Cut architecture

Vibe Cut is a browser-first, non-destructive video editor. The editor and the
AI assistant share one versioned project schema and one command history.

## Boundaries

- `src/core/schema`: versioned project and AI edit-plan contracts.
- `src/core/editor`: pure, atomic edit operations with reference validation.
- `src/core/media`: browser media metadata, object URL, waveform, and thumbnail
  services.
- `src/core/render`: deterministic canvas compositor used by preview and export.
- `src/core/render/resolve-clip.ts`: shared keyframe interpolation and frame
  snapping used by the timeline, preview, and export compositor.
- `src/core/export`: WebCodecs plus Mediabunny export, with capability checks.
- `src/store`: UI state and undo/redo history. Project documents stay serializable.
- `src/app/api/ai`: provider adapters. API keys are accepted per request and are
  never written to logs or server storage.

## Non-destructive timing

Every clip has a timeline placement (`timelineStart`, `duration`) and a source
window (`sourceStart`, `speed`). Trimming changes the window, splitting derives
both halves from one split point, and the original asset remains unchanged.

## AI transaction flow

1. The browser sends a compact project summary, current playhead/selection
   context, user request, and provider configuration to the AI planning route.
2. The provider is instructed to call a single `apply_edit_plan` tool.
3. The route parses and validates the result with the same Zod schema used by
   the editor.
4. The UI shows the plan, affected clips, and warnings.
5. Applying the plan checks `baseRevision`, executes all operations on a clone,
   validates the whole project, and commits one undoable history entry with a
   mutation receipt.
6. The browser can render a composited inspection frame from the same renderer
   that drives export, so AI changes are checked against the final layer order,
   transitions, masks, effects, and keyframes.

This prevents partial AI edits, stale-plan corruption, and stringly typed
commands.
