import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/core/schema/project";
import { summarizeProject } from "../project-summary";

describe("summarizeProject", () => {
  it("removes render-only detail while preserving ids and timing", () => {
    const project = createEmptyProject("summary-project", 1);
    project.revision = 7;
    project.markers.push({
      id: "private-marker",
      time: 1,
      label: "Not needed by planner summary",
      color: "#8c7ac4",
    });

    const summary = summarizeProject(project, {
      currentTime: 1.25,
      selectedClipIds: ["missing-clip"],
    });

    expect(summary).toMatchObject({
      id: "summary-project",
      revision: 7,
      canvas: { width: 1920, height: 1080, fps: 30 },
    });
    expect(summary.tracks).toHaveLength(2);
    expect(summary.editor).toEqual({
      playheadTime: 1.25,
      selectedClipIds: [],
    });
    expect(summary).not.toHaveProperty("markers");
  });
});
