import { describe, expect, it } from "vitest";
import { applyEditPlan } from "../apply-edit-plan";
import { createEmptyProject } from "@/core/schema/project";

describe("advanced edit operations", () => {
  it("adds transitions and reports a mutation receipt", () => {
    const project = createEmptyProject("transition-project", 1);
    project.assets.push({
      id: "asset-1", name: "shot.mp4", kind: "video", mimeType: "video/mp4", size: 1,
      duration: 8, width: 1920, height: 1080, createdAt: 1,
    });
    project.clips.push(
      { id: "clip-a", type: "media", assetId: "asset-1", trackId: `${project.id}-video`, name: "A", timelineStart: 0, duration: 3, sourceStart: 0, speed: 1, opacity: 1, enabled: true, locked: false, transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scaleX: 1, scaleY: 1 }, adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, blur: 0 }, fit: "contain", volume: 1, fadeIn: 0, fadeOut: 0 },
      { id: "clip-b", type: "media", assetId: "asset-1", trackId: `${project.id}-video`, name: "B", timelineStart: 3, duration: 3, sourceStart: 3, speed: 1, opacity: 1, enabled: true, locked: false, transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0, scaleX: 1, scaleY: 1 }, adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, blur: 0 }, fit: "contain", volume: 1, fadeIn: 0, fadeOut: 0 },
    );
    const result = applyEditPlan(project, {
      schemaVersion: 1, id: "plan", baseRevision: 0, title: "Transition", explanation: "Add dissolve", warnings: [],
      operations: [{ op: "addTransition", transition: { id: "transition-1", fromClipId: "clip-a", toClipId: "clip-b", type: "dissolve", duration: 0.5, easing: "smooth" } }],
    });
    expect(result.project.transitions[0].type).toBe("dissolve");
    expect(result.receipt.transitionCount).toBe(1);
    expect(result.receipt.summary).toContain("added 1 transition");
  });
});
