import { describe, expect, it } from "vitest";
import { applyEditPlan } from "../apply-edit-plan";
import { EditPlanError } from "../errors";
import { createEmptyProject, type TextClip } from "@/core/schema/project";
import type { EditPlan } from "@/core/schema/edit-plan";

function textClip(projectId: string): TextClip {
  return {
    id: "title-1",
    type: "text",
    trackId: `${projectId}-video`,
    name: "Opening title",
    timelineStart: 0,
    duration: 4,
    sourceStart: 0,
    speed: 1,
    opacity: 1,
    enabled: true,
    locked: false,
    transform: {
      x: 560,
      y: 420,
      width: 800,
      height: 240,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      blur: 0,
    },
    text: "Make the first frame count",
    style: {
      fontFamily: "Geist",
      fontSize: 72,
      fontWeight: 600,
      color: "#f7f6fb",
      backgroundColor: "#00000000",
      align: "center",
    },
  };
}

function plan(projectId: string, operations: EditPlan["operations"]): EditPlan {
  return {
    schemaVersion: 1,
    id: "plan-1",
    baseRevision: 0,
    title: "Add title",
    explanation: "Adds and adjusts the opening title.",
    warnings: [],
    operations,
  };
}

describe("applyEditPlan", () => {
  it("applies a validated multi-operation plan atomically", () => {
    const project = createEmptyProject("project-1", 1);
    const result = applyEditPlan(
      project,
      plan(project.id, [
        { op: "addText", clip: textClip(project.id) },
        {
          op: "updateClip",
          clipId: "title-1",
          patch: { opacity: 0.86, transform: { y: 360 } },
        },
        {
          op: "addMarker",
          id: "marker-1",
          time: 2,
          label: "Title beat",
          color: "#8c7ac4",
        },
      ]),
      2,
    );

    expect(result.appliedOperations).toBe(3);
    expect(result.project.revision).toBe(1);
    expect(result.project.settings.duration).toBe(4);
    expect(result.project.clips[0].opacity).toBe(0.86);
    expect(result.project.clips[0].transform.y).toBe(360);
    expect(result.project.markers).toHaveLength(1);
    expect(project.clips).toHaveLength(0);
  });

  it("splits a clip without changing the visible source span", () => {
    const project = createEmptyProject("project-2", 1);
    project.clips.push(textClip(project.id));

    const result = applyEditPlan(
      project,
      plan(project.id, [
        {
          op: "splitClip",
          clipId: "title-1",
          time: 1.5,
          rightClipId: "title-2",
        },
      ]),
      2,
    );

    expect(result.project.clips).toHaveLength(2);
    expect(result.project.clips[0].duration).toBe(1.5);
    expect(result.project.clips[1]).toMatchObject({
      id: "title-2",
      timelineStart: 1.5,
      duration: 2.5,
      sourceStart: 1.5,
    });
  });

  it("rejects stale plans before applying any operation", () => {
    const project = createEmptyProject("project-3", 1);
    project.revision = 4;
    const stalePlan = plan(project.id, [{ op: "addText", clip: textClip(project.id) }]);

    expect(() => applyEditPlan(project, stalePlan, 2)).toThrow(EditPlanError);
    expect(project.clips).toHaveLength(0);
  });

  it("reports the failing operation and keeps the input untouched", () => {
    const project = createEmptyProject("project-4", 1);
    const invalid = plan(project.id, [
      { op: "addText", clip: textClip(project.id) },
      { op: "removeClip", clipId: "missing" },
    ]);

    try {
      applyEditPlan(project, invalid, 2);
      throw new Error("Expected plan to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EditPlanError);
      expect((error as EditPlanError).operationIndex).toBe(1);
      expect(project.clips).toHaveLength(0);
    }
  });

  it("rejects a media clip that extends beyond its source asset", () => {
    const project = createEmptyProject("project-5", 1);
    const invalid = plan(project.id, [
      {
        op: "addAsset",
        asset: {
          id: "asset-1",
          name: "short-shot.mp4",
          kind: "video",
          mimeType: "video/mp4",
          size: 1_024,
          duration: 2,
          width: 1920,
          height: 1080,
          createdAt: 1,
        },
      },
      {
        op: "addMedia",
        clip: {
          id: "clip-1",
          type: "media",
          assetId: "asset-1",
          trackId: `${project.id}-video`,
          name: "Too long",
          timelineStart: 0,
          duration: 3,
          sourceStart: 0,
          speed: 1,
          opacity: 1,
          enabled: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          adjustments: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            temperature: 0,
            blur: 0,
          },
          fit: "contain",
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
      },
    ]);

    expect(() => applyEditPlan(project, invalid, 2)).toThrow(
      "extends beyond its source media",
    );
    expect(project.assets).toHaveLength(0);
    expect(project.clips).toHaveLength(0);
  });
});
