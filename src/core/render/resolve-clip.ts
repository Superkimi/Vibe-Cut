import type { VibeClip } from "@/core/schema/project";

export interface ResolvedClipState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

const DEFAULT_STATE: ResolvedClipState = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};

type NumericProperty = keyof ResolvedClipState;

function valueAt(
  clip: VibeClip,
  time: number,
  property: NumericProperty,
  fallback: number,
): number {
  const keyframes = clip.keyframes ?? [];
  if (!keyframes.length) return fallback;
  const points = keyframes
    .filter((keyframe) => keyframe.properties[property] !== undefined)
    .sort((a, b) => a.time - b.time);
  if (!points.length) return fallback;
  const first = points[0];
  const last = points[points.length - 1];
  if (time <= first.time) return Number(first.properties[property]);
  if (time >= last.time) return Number(last.properties[property]);
  const nextIndex = points.findIndex((point) => point.time > time);
  const next = points[nextIndex];
  const previous = points[nextIndex - 1];
  if (!next || !previous) return fallback;
  const start = Number(previous.properties[property]);
  const end = Number(next.properties[property]);
  if (previous.interpolation === "hold") return start;
  const span = Math.max(0.0001, next.time - previous.time);
  let amount = Math.max(0, Math.min(1, (time - previous.time) / span));
  if (previous.interpolation === "smooth" || next.interpolation === "smooth") {
    amount = amount * amount * (3 - 2 * amount);
  }
  return start + (end - start) * amount;
}

export function resolveClipState(clip: VibeClip, timelineTime: number): ResolvedClipState {
  const localTime = Math.max(0, timelineTime - clip.timelineStart);
  return {
    x: valueAt(clip, localTime, "x", clip.transform.x),
    y: valueAt(clip, localTime, "y", clip.transform.y),
    width: valueAt(clip, localTime, "width", clip.transform.width),
    height: valueAt(clip, localTime, "height", clip.transform.height),
    rotation: valueAt(clip, localTime, "rotation", clip.transform.rotation),
    scaleX: valueAt(clip, localTime, "scaleX", clip.transform.scaleX),
    scaleY: valueAt(clip, localTime, "scaleY", clip.transform.scaleY),
    opacity: valueAt(clip, localTime, "opacity", clip.opacity),
    brightness: valueAt(clip, localTime, "brightness", clip.adjustments.brightness),
    contrast: valueAt(clip, localTime, "contrast", clip.adjustments.contrast),
    saturation: valueAt(clip, localTime, "saturation", clip.adjustments.saturation),
    blur: valueAt(clip, localTime, "blur", clip.adjustments.blur),
  };
}

export function frameToTime(frame: number, fps: number): number {
  return Math.max(0, Math.round(frame)) / fps;
}

export function timeToFrame(time: number, fps: number): number {
  return Math.max(0, Math.round(time * fps));
}

export function snapTimeToFrame(time: number, fps: number): number {
  return frameToTime(timeToFrame(time, fps), fps);
}

export { DEFAULT_STATE };
