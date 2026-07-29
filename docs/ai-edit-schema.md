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

Provider credentials are sent to the selected provider through the Vibe Cut
server for that request only. They are not logged or stored server-side.
Custom provider origins must be listed in `VIBECUT_AI_ALLOWED_ORIGINS` to keep
the proxy from becoming an SSRF surface.
