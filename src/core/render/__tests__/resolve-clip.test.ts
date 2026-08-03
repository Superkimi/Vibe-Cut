import { describe, expect, it } from "vitest";
import { resolveClipState, snapTimeToFrame, timeToFrame } from "../resolve-clip";
import { createEmptyProject, type TextClip } from "@/core/schema/project";

function clip(): TextClip {
  const project = createEmptyProject("animation-project", 1);
  return {
    id: "animated-title",
    type: "text",
    trackId: `${project.id}-video`,
    name: "Animated title",
    timelineStart: 2,
    duration: 4,
    sourceStart: 0,
    speed: 1,
    opacity: 1,
    enabled: true,
    locked: false,
    transform: { x: 0, y: 0, width: 400, height: 120, rotation: 0, scaleX: 1, scaleY: 1 },
    adjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, blur: 0 },
    keyframes: [
      { time: 0, interpolation: "smooth", properties: { x: 0, opacity: 0 } },
      { time: 2, interpolation: "linear", properties: { x: 200, opacity: 1 } },
    ],
    text: "Hello",
    style: { fontFamily: "Geist", fontSize: 48, fontWeight: 600, color: "#ffffff", backgroundColor: "#00000000", align: "center" },
  };
}

describe("resolveClipState", () => {
  it("interpolates clip-relative keyframes", () => {
    const state = resolveClipState(clip(), 3);
    expect(state.x).toBe(100);
    expect(state.opacity).toBe(0.5);
  });

  it("keeps frame snapping deterministic", () => {
    expect(timeToFrame(1.001, 30)).toBe(30);
    expect(snapTimeToFrame(1.016, 30)).toBe(1);
  });
});
