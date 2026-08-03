import type { EditOperation } from "@/core/schema/edit-plan";
import type { VibeProject } from "@/core/schema/project";

export interface MutationReceipt {
  operationCount: number;
  addedClipIds: string[];
  removedClipIds: string[];
  movedClipIds: string[];
  changedClipIds: string[];
  addedTrackIds: string[];
  removedTrackIds: string[];
  transitionCount: number;
  summary: string;
}

export function createMutationReceipt(
  before: VibeProject,
  after: VibeProject,
  operations: EditOperation[],
): MutationReceipt {
  const beforeClips = new Map(before.clips.map((clip) => [clip.id, clip]));
  const afterClips = new Map(after.clips.map((clip) => [clip.id, clip]));
  const addedClipIds = [...afterClips.keys()].filter((id) => !beforeClips.has(id));
  const removedClipIds = [...beforeClips.keys()].filter((id) => !afterClips.has(id));
  const changedClipIds = [...afterClips.keys()].filter((id) => {
    const previous = beforeClips.get(id);
    const next = afterClips.get(id);
    return Boolean(previous && next && JSON.stringify(previous) !== JSON.stringify(next));
  });
  const movedClipIds = changedClipIds.filter((id) => {
    const previous = beforeClips.get(id);
    const next = afterClips.get(id);
    return Boolean(
      previous &&
        next &&
        (previous.timelineStart !== next.timelineStart || previous.trackId !== next.trackId),
    );
  });
  const beforeTracks = new Set(before.tracks.map((track) => track.id));
  const afterTracks = new Set(after.tracks.map((track) => track.id));
  const addedTrackIds = [...afterTracks].filter((id) => !beforeTracks.has(id));
  const removedTrackIds = [...beforeTracks].filter((id) => !afterTracks.has(id));
  const summary = [
    addedClipIds.length ? `added ${addedClipIds.length} clip(s)` : "",
    removedClipIds.length ? `removed ${removedClipIds.length} clip(s)` : "",
    movedClipIds.length ? `moved ${movedClipIds.length} clip(s)` : "",
    changedClipIds.length && !movedClipIds.length ? `updated ${changedClipIds.length} clip(s)` : "",
    addedTrackIds.length ? `added ${addedTrackIds.length} track(s)` : "",
    removedTrackIds.length ? `removed ${removedTrackIds.length} track(s)` : "",
    after.transitions.length !== before.transitions.length
      ? `${after.transitions.length > before.transitions.length ? "added" : "removed"} ${Math.abs(after.transitions.length - before.transitions.length)} transition(s)`
      : "",
  ].filter(Boolean).join(", ") || "no visible changes";
  return {
    operationCount: operations.length,
    addedClipIds,
    removedClipIds,
    movedClipIds,
    changedClipIds,
    addedTrackIds,
    removedTrackIds,
    transitionCount: after.transitions.length - before.transitions.length,
    summary,
  };
}
