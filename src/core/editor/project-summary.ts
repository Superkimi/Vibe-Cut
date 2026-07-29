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
  };
}
