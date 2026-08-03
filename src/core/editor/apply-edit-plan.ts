import { editPlanSchema, type EditOperation, type EditPlan } from "@/core/schema/edit-plan";
import { projectSchema, type VibeClip, type VibeProject } from "@/core/schema/project";
import { EditPlanError } from "./errors";
import { createMutationReceipt, type MutationReceipt } from "./mutation-receipt";

const EPSILON = 1 / 1_000;

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function recalculateDuration(project: VibeProject): void {
  project.settings.duration = project.clips.reduce(
    (end, clip) => Math.max(end, clip.timelineStart + clip.duration),
    0,
  );
}

function getClip(project: VibeProject, clipId: string): VibeClip {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new EditPlanError(`Clip "${clipId}" does not exist.`);
  }
  return clip;
}

function assertTrackWritable(project: VibeProject, trackId: string): void {
  const track = project.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    throw new EditPlanError(`Track "${trackId}" does not exist.`);
  }
  if (track.locked) {
    throw new EditPlanError(`Track "${track.name}" is locked.`);
  }
}

function assertProjectInvariants(project: VibeProject): void {
  const tracks = new Map(project.tracks.map((track) => [track.id, track]));
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  const clips = new Set<string>();

  for (const clip of project.clips) {
    if (clips.has(clip.id)) {
      throw new EditPlanError(`Clip "${clip.id}" is duplicated.`);
    }
    clips.add(clip.id);
    const track = tracks.get(clip.trackId);
    if (!track) {
      throw new EditPlanError(
        `Clip "${clip.name}" references a missing track.`,
      );
    }
    if (clip.type === "text") {
      if (track.kind === "audio") {
        throw new EditPlanError(
          `Text clip "${clip.name}" cannot use an audio track.`,
        );
      }
      continue;
    }
    const asset = assets.get(clip.assetId);
    if (!asset) {
      throw new EditPlanError(
        `Clip "${clip.name}" references a missing asset.`,
      );
    }
    if (asset.kind === "audio" && track.kind !== "audio") {
      throw new EditPlanError(
        `Audio clip "${clip.name}" must use an audio track.`,
      );
    }
    if (asset.kind !== "audio" && track.kind === "audio") {
      throw new EditPlanError(
        `Visual clip "${clip.name}" cannot use an audio track.`,
      );
    }
    const sourceEnd = clip.sourceStart + clip.duration * clip.speed;
    if (sourceEnd > asset.duration + EPSILON) {
      throw new EditPlanError(
        `Clip "${clip.name}" extends beyond its source media.`,
      );
    }
  }

  for (const transition of project.transitions) {
    if (project.transitions.filter((candidate) => candidate.id === transition.id).length > 1) {
      throw new EditPlanError(`Transition "${transition.id}" is duplicated.`);
    }
    if (!clips.has(transition.fromClipId) || !clips.has(transition.toClipId)) {
      throw new EditPlanError(
        `Transition "${transition.id}" references a missing clip.`,
      );
    }
    if (transition.fromClipId === transition.toClipId) {
      throw new EditPlanError(`Transition "${transition.id}" cannot target the same clip.`);
    }
  }
}

function patchClip(clip: VibeClip, patch: Extract<EditOperation, { op: "updateClip" }>["patch"]): VibeClip {
  const next = {
    ...clip,
    ...patch,
    transform: patch.transform
      ? { ...clip.transform, ...patch.transform }
      : clip.transform,
    adjustments: patch.adjustments
      ? { ...clip.adjustments, ...patch.adjustments }
      : clip.adjustments,
    style:
      clip.type === "text" && patch.style
        ? { ...clip.style, ...patch.style }
        : clip.type === "text"
          ? clip.style
          : undefined,
  };

  if (clip.type === "media" && "volume" in patch && patch.volume !== undefined) {
    next.volume = patch.volume;
  }
  if (clip.type === "text" && "text" in patch && patch.text !== undefined) {
    next.text = patch.text;
  }
  if (clip.type === "text" && "role" in patch && patch.role !== undefined) {
    next.role = patch.role;
  }

  return next as VibeClip;
}

function applyOperation(project: VibeProject, operation: EditOperation): void {
  switch (operation.op) {
    case "addAsset": {
      if (project.assets.some((asset) => asset.id === operation.asset.id)) {
        throw new EditPlanError(`Asset "${operation.asset.id}" already exists.`);
      }
      project.assets.push(operation.asset);
      return;
    }
    case "addTrack": {
      if (project.tracks.some((track) => track.id === operation.track.id)) {
        throw new EditPlanError(`Track "${operation.track.id}" already exists.`);
      }
      project.tracks.push(operation.track);
      project.tracks.sort((a, b) => a.order - b.order);
      return;
    }
    case "removeTrack": {
      const clipCount = project.clips.filter((clip) => clip.trackId === operation.trackId).length;
      if (clipCount > 0 && !operation.removeClips) {
        throw new EditPlanError(`Track "${operation.trackId}" is not empty.`);
      }
      project.tracks = project.tracks.filter((track) => track.id !== operation.trackId);
      if (operation.removeClips) {
        const removedIds = new Set(
          project.clips
            .filter((clip) => clip.trackId === operation.trackId)
            .map((clip) => clip.id),
        );
        project.clips = project.clips.filter((clip) => !removedIds.has(clip.id));
        project.transitions = project.transitions.filter(
          (transition) =>
            !removedIds.has(transition.fromClipId) &&
            !removedIds.has(transition.toClipId),
        );
      }
      return;
    }
    case "addText": {
      assertTrackWritable(project, operation.clip.trackId);
      if (project.clips.some((clip) => clip.id === operation.clip.id)) {
        throw new EditPlanError(`Clip "${operation.clip.id}" already exists.`);
      }
      project.clips.push(operation.clip);
      return;
    }
    case "addMedia": {
      assertTrackWritable(project, operation.clip.trackId);
      if (project.clips.some((clip) => clip.id === operation.clip.id)) {
        throw new EditPlanError(`Clip "${operation.clip.id}" already exists.`);
      }
      if (!project.assets.some((asset) => asset.id === operation.clip.assetId)) {
        throw new EditPlanError(`Asset "${operation.clip.assetId}" does not exist.`);
      }
      project.clips.push(operation.clip);
      return;
    }
    case "addTransition": {
      if (project.transitions.some((transition) => transition.id === operation.transition.id)) {
        throw new EditPlanError(`Transition "${operation.transition.id}" already exists.`);
      }
      if (!project.clips.some((clip) => clip.id === operation.transition.fromClipId)) {
        throw new EditPlanError(`Transition source clip does not exist.`);
      }
      if (!project.clips.some((clip) => clip.id === operation.transition.toClipId)) {
        throw new EditPlanError(`Transition destination clip does not exist.`);
      }
      project.transitions.push(operation.transition);
      return;
    }
    case "updateTransition": {
      const index = project.transitions.findIndex((transition) => transition.id === operation.transitionId);
      if (index < 0) throw new EditPlanError(`Transition "${operation.transitionId}" does not exist.`);
      project.transitions[index] = {
        ...project.transitions[index],
        ...(operation.patch ?? {}),
      };
      return;
    }
    case "removeTransition": {
      if (!project.transitions.some((transition) => transition.id === operation.transitionId)) {
        throw new EditPlanError(`Transition "${operation.transitionId}" does not exist.`);
      }
      project.transitions = project.transitions.filter((transition) => transition.id !== operation.transitionId);
      return;
    }
    case "duplicateClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      if (project.clips.some((candidate) => candidate.id === operation.duplicateId)) {
        throw new EditPlanError(`Clip "${operation.duplicateId}" already exists.`);
      }
      const duplicate = deepClone(clip);
      duplicate.id = operation.duplicateId;
      duplicate.name = `${clip.name} copy`;
      duplicate.timelineStart = operation.timelineStart ?? clip.timelineStart + clip.duration;
      project.clips.push(duplicate);
      return;
    }
    case "updateClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      const index = project.clips.findIndex((candidate) => candidate.id === operation.clipId);
      project.clips[index] = patchClip(clip, operation.patch);
      return;
    }
    case "moveClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      const nextTrackId = operation.trackId ?? clip.trackId;
      assertTrackWritable(project, nextTrackId);
      clip.trackId = nextTrackId;
      clip.timelineStart = operation.timelineStart;
      return;
    }
    case "trimClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      const clipEnd = clip.timelineStart + clip.duration;
      if (operation.side === "start") {
        if (operation.time < clip.timelineStart || operation.time >= clipEnd - EPSILON) {
          throw new EditPlanError("Start trim must remain inside the clip.");
        }
        const delta = operation.time - clip.timelineStart;
        clip.timelineStart = operation.time;
        clip.sourceStart += delta * clip.speed;
        clip.duration -= delta;
      } else {
        if (operation.time <= clip.timelineStart + EPSILON || operation.time > clipEnd) {
          throw new EditPlanError("End trim must remain inside the clip.");
        }
        clip.duration = operation.time - clip.timelineStart;
      }
      return;
    }
    case "splitClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      const clipEnd = clip.timelineStart + clip.duration;
      if (operation.time <= clip.timelineStart + EPSILON || operation.time >= clipEnd - EPSILON) {
        throw new EditPlanError("Split time must remain inside the clip.");
      }
      if (project.clips.some((candidate) => candidate.id === operation.rightClipId)) {
        throw new EditPlanError(`Clip "${operation.rightClipId}" already exists.`);
      }
      const leftDuration = operation.time - clip.timelineStart;
      const right = deepClone(clip);
      right.id = operation.rightClipId;
      right.name = `${clip.name} right`;
      right.timelineStart = operation.time;
      right.duration = clip.duration - leftDuration;
      right.sourceStart = clip.sourceStart + leftDuration * clip.speed;
      clip.duration = leftDuration;
      project.clips.push(right);
      return;
    }
    case "removeClip": {
      const clip = getClip(project, operation.clipId);
      assertTrackWritable(project, clip.trackId);
      project.clips = project.clips.filter((candidate) => candidate.id !== operation.clipId);
      project.transitions = project.transitions.filter(
        (transition) =>
          transition.fromClipId !== operation.clipId &&
          transition.toClipId !== operation.clipId,
      );
      return;
    }
    case "setCanvas": {
      project.settings = { ...project.settings, ...operation };
      delete (project.settings as Record<string, unknown>).op;
      return;
    }
    case "addMarker": {
      if (project.markers.some((marker) => marker.id === operation.id)) {
        throw new EditPlanError(`Marker "${operation.id}" already exists.`);
      }
      project.markers.push({
        id: operation.id,
        time: operation.time,
        label: operation.label,
        color: operation.color,
      });
      return;
    }
  }
}

export interface ApplyEditPlanResult {
  project: VibeProject;
  appliedOperations: number;
  receipt: MutationReceipt;
}

export function applyEditPlan(
  inputProject: VibeProject,
  inputPlan: EditPlan,
  now = Date.now(),
): ApplyEditPlanResult {
  const project = projectSchema.parse(inputProject);
  const plan = editPlanSchema.parse(inputPlan);

  if (plan.baseRevision !== project.revision) {
    throw new EditPlanError(
      `Plan targets revision ${plan.baseRevision}, but the project is at revision ${project.revision}.`,
    );
  }

  const next = deepClone(project);
  for (const [index, operation] of plan.operations.entries()) {
    try {
      applyOperation(next, operation);
    } catch (error) {
      if (error instanceof EditPlanError) {
        throw new EditPlanError(error.message, index);
      }
      throw error;
    }
  }

  assertProjectInvariants(next);
  recalculateDuration(next);
  next.revision += 1;
  next.updatedAt = now;

  return {
    project: projectSchema.parse(next),
    appliedOperations: plan.operations.length,
    receipt: createMutationReceipt(project, next, plan.operations),
  };
}
