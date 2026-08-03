# AI edit contract

The assistant never writes editor state directly. It returns one versioned
`EditPlan` and the editor applies it through the same transaction boundary used
by manual edits.

Supported operations:

- `addAsset`
- `addTrack`
- `removeTrack`
- `addMedia`
- `addText`
- `addTransition`
- `updateTransition`
- `removeTransition`
- `duplicateClip`
- `updateClip`
- `moveClip`
- `trimClip`
- `splitClip`
- `removeClip`
- `setCanvas`
- `addMarker`

Every plan includes `baseRevision`. A plan generated against an earlier
revision is rejected and must be regenerated. Operations are applied to a clone
and the resulting project is validated before it replaces live state. If any
operation fails, no part of the plan is committed.

`updateClip` can change transform values, text style/role, masks, blend mode,
effects, and clip-relative keyframes. Keyframe times are snapped to the project
frame rate at the UI boundary. After a successful commit the editor emits a
mutation receipt listing added, removed, moved, and changed objects; the Vibe
panel also renders a local composited inspection frame before the user continues
the conversation.

Provider credentials are sent to the selected provider through the Vibe Cut
server for that request only. They are not logged or stored server-side.
Custom provider origins must be listed in `VIBECUT_AI_ALLOWED_ORIGINS` to keep
the proxy from becoming an SSRF surface.
