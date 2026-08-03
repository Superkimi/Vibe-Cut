import type { VibeProject } from "@/core/schema/project";
import { ProjectFrameRenderer } from "@/core/render/frame-renderer";

export interface ProjectInspection {
  ok: boolean;
  issues: Array<{ severity: "warning" | "error"; message: string; clipId?: string }>;
  checkedClips: number;
}

export function inspectProject(project: VibeProject): ProjectInspection {
  const issues: ProjectInspection["issues"] = [];
  const tracks = new Map(project.tracks.map((track) => [track.id, track]));
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  for (const clip of project.clips) {
    const track = tracks.get(clip.trackId);
    if (!track) {
      issues.push({ severity: "error", message: "A clip references a missing track.", clipId: clip.id });
      continue;
    }
    if (clip.type === "media" && !assets.has(clip.assetId)) {
      issues.push({ severity: "error", message: "A media clip references a missing asset.", clipId: clip.id });
    }
    if (clip.type === "text" && clip.text.trim().length === 0) {
      issues.push({ severity: "warning", message: "A text layer is empty.", clipId: clip.id });
    }
    if (clip.transform.x + clip.transform.width < 0 || clip.transform.y + clip.transform.height < 0 || clip.transform.x > project.settings.width || clip.transform.y > project.settings.height) {
      issues.push({ severity: "warning", message: "A layer is completely outside the canvas.", clipId: clip.id });
    }
    if (clip.opacity === 0) {
      issues.push({ severity: "warning", message: "A layer is fully transparent.", clipId: clip.id });
    }
  }
  for (const transition of project.transitions) {
    const from = project.clips.find((clip) => clip.id === transition.fromClipId);
    const to = project.clips.find((clip) => clip.id === transition.toClipId);
    if (!from || !to) {
      issues.push({ severity: "error", message: "A transition references a missing clip." });
    } else if (transition.duration > from.duration || transition.duration > to.duration) {
      issues.push({ severity: "error", message: "A transition is longer than one of its clips." });
    }
  }
  return { ok: !issues.some((issue) => issue.severity === "error"), issues, checkedClips: project.clips.length };
}

export async function renderInspectionFrame(
  project: VibeProject,
  assetUrls: Record<string, string>,
  time = 0,
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(project.settings.width, 960);
  canvas.height = Math.max(1, Math.round(canvas.width * project.settings.height / project.settings.width));
  const renderer = new ProjectFrameRenderer(project, assetUrls);
  try {
    await renderer.prepare();
    await renderer.render(canvas, Math.max(0, Math.min(time, project.settings.duration)));
    return canvas.toDataURL("image/png");
  } finally {
    renderer.dispose();
  }
}
