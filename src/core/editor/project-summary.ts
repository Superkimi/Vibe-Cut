import type { VibeProject } from "@/core/schema/project";

export interface ProjectSummary {
  id: string;
  revision: number;
  canvas: {
    width: number;
    height: number;
    fps: number;
    duration: number;
  };
  tracks: Array<{
    id: string;
    name: string;
    kind: string;
    locked: boolean;
  }>;
  clips: Array<{
    id: string;
    name: string;
    type: string;
    trackId: string;
    timelineStart: number;
    duration: number;
    sourceStart: number;
    text?: string;
    role?: string;
    keyframes?: number;
    effects?: string[];
  }>;
  assets: Array<{
    id: string;
    name: string;
    kind: string;
    duration: number;
  }>;
  editor: {
    playheadTime: number;
    selectedClipIds: string[];
  };
  transitions: Array<{
    id: string;
    fromClipId: string;
    toClipId: string;
    type: string;
    duration: number;
  }>;
}

export interface EditorContext {
  currentTime: number;
  selectedClipIds: string[];
}

export function summarizeProject(
  project: VibeProject,
  context: EditorContext = { currentTime: 0, selectedClipIds: [] },
): ProjectSummary {
  return {
    id: project.id,
    revision: project.revision,
    canvas: {
      width: project.settings.width,
      height: project.settings.height,
      fps: project.settings.fps,
      duration: project.settings.duration,
    },
    tracks: project.tracks.map(({ id, name, kind, locked }) => ({
      id,
      name,
      kind,
      locked,
    })),
    clips: project.clips.map((clip) => ({
      id: clip.id,
      name: clip.name,
      type: clip.type,
      trackId: clip.trackId,
      timelineStart: clip.timelineStart,
      duration: clip.duration,
      sourceStart: clip.sourceStart,
      ...(clip.type === "text" ? { text: clip.text } : {}),
      ...(clip.type === "text" && clip.role ? { role: clip.role } : {}),
      ...(clip.keyframes?.length ? { keyframes: clip.keyframes.length } : {}),
      ...(clip.effects?.length ? { effects: clip.effects.map((effect) => effect.type) } : {}),
    })),
    assets: project.assets.map(({ id, name, kind, duration }) => ({
      id,
      name,
      kind,
      duration,
    })),
    editor: {
      playheadTime: context.currentTime,
      selectedClipIds: context.selectedClipIds.filter((id) =>
        project.clips.some((clip) => clip.id === id),
      ),
    },
    transitions: project.transitions.map(({ id, fromClipId, toClipId, type, duration }) => ({
      id,
      fromClipId,
      toClipId,
      type,
      duration,
    })),
  };
}
