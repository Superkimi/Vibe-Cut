import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

const finiteNumber = z.number().finite();
const nonNegative = finiteNumber.min(0);
const positive = finiteNumber.positive();

export const transformSchema = z.object({
  x: finiteNumber.default(0),
  y: finiteNumber.default(0),
  width: positive,
  height: positive,
  rotation: finiteNumber.default(0),
  scaleX: positive.default(1),
  scaleY: positive.default(1),
});

export const colorAdjustmentsSchema = z.object({
  brightness: finiteNumber.min(-1).max(1).default(0),
  contrast: finiteNumber.min(-1).max(1).default(0),
  saturation: finiteNumber.min(-1).max(1).default(0),
  temperature: finiteNumber.min(-1).max(1).default(0),
  blur: nonNegative.max(40).default(0),
});

export const maskSchema = z.object({
  type: z.enum(["rect", "ellipse"]).default("rect"),
  x: finiteNumber.default(0),
  y: finiteNumber.default(0),
  width: positive,
  height: positive,
  feather: nonNegative.max(200).default(0),
});

export const keyframeSchema = z.object({
  time: nonNegative,
  interpolation: z.enum(["linear", "hold", "smooth"]).default("linear"),
  properties: z
    .object({
      x: finiteNumber.optional(),
      y: finiteNumber.optional(),
      width: positive.optional(),
      height: positive.optional(),
      rotation: finiteNumber.optional(),
      scaleX: positive.optional(),
      scaleY: positive.optional(),
      opacity: finiteNumber.min(0).max(1).optional(),
      brightness: finiteNumber.min(-1).max(1).optional(),
      contrast: finiteNumber.min(-1).max(1).optional(),
      saturation: finiteNumber.min(-1).max(1).optional(),
      blur: nonNegative.max(40).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, "A keyframe needs a property."),
});

export const effectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["vignette", "grayscale", "sepia", "sharpen", "drop-shadow"]),
  enabled: z.boolean().default(true),
  amount: finiteNumber.min(0).max(1).default(0.5),
});

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(240),
  kind: z.enum(["video", "audio", "image"]),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  duration: nonNegative.default(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  createdAt: z.number().int().nonnegative(),
  waveform: z.array(z.number().min(0).max(1)).max(2_048).optional(),
});

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  kind: z.enum(["video", "audio", "overlay", "text"]),
  muted: z.boolean().default(false),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});

const clipBaseSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  name: z.string().min(1).max(160),
  timelineStart: nonNegative,
  duration: positive,
  sourceStart: nonNegative.default(0),
  speed: positive.min(0.1).max(8).default(1),
  opacity: finiteNumber.min(0).max(1).default(1),
  enabled: z.boolean().default(true),
  locked: z.boolean().default(false),
  transform: transformSchema,
  adjustments: colorAdjustmentsSchema.default({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    blur: 0,
  }),
  blendMode: z
    .enum(["normal", "screen", "multiply", "overlay", "soft-light"])
    .optional(),
  mask: maskSchema.optional(),
  keyframes: z.array(keyframeSchema).max(256).optional(),
  effects: z.array(effectSchema).max(16).optional(),
});

export const mediaClipSchema = clipBaseSchema.extend({
  type: z.literal("media"),
  assetId: z.string().min(1),
  fit: z.enum(["contain", "cover", "fill"]).default("contain"),
  volume: finiteNumber.min(0).max(2).default(1),
  fadeIn: nonNegative.default(0),
  fadeOut: nonNegative.default(0),
});

export const textClipSchema = clipBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().max(2_000),
  style: z.object({
    fontFamily: z.string().min(1).default("Geist"),
    fontSize: positive.min(8).max(400).default(64),
    fontWeight: z.number().int().min(100).max(900).default(600),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f7f6fb"),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{8}$/).default("#00000000"),
    align: z.enum(["left", "center", "right"]).default("center"),
    lineHeight: positive.min(1).max(3).optional(),
    letterSpacing: finiteNumber.min(-20).max(100).optional(),
    outlineColor: z.string().regex(/^#[0-9a-fA-F]{8}$/).optional(),
    outlineWidth: nonNegative.max(32).optional(),
    shadow: z.boolean().optional(),
  }),
  role: z.enum(["title", "caption", "subtitle"]).optional(),
});

export const clipSchema = z.discriminatedUnion("type", [
  mediaClipSchema,
  textClipSchema,
]);

export const transitionSchema = z.object({
  id: z.string().min(1),
  fromClipId: z.string().min(1),
  toClipId: z.string().min(1),
  type: z.enum(["fade", "dissolve", "wipe-left", "wipe-right"]),
  duration: positive.max(5),
  easing: z.enum(["linear", "smooth"]).optional(),
});

export const markerSchema = z.object({
  id: z.string().min(1),
  time: nonNegative,
  label: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8c7ac4"),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  settings: z.object({
    width: z.number().int().min(16).max(7_680),
    height: z.number().int().min(16).max(7_680),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]),
    duration: nonNegative,
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  assets: z.array(assetSchema),
  tracks: z.array(trackSchema),
  clips: z.array(clipSchema),
  transitions: z.array(transitionSchema),
  markers: z.array(markerSchema),
});

export type VibeProject = z.infer<typeof projectSchema>;
export type VibeAsset = z.infer<typeof assetSchema>;
export type VibeTrack = z.infer<typeof trackSchema>;
export type VibeClip = z.infer<typeof clipSchema>;
export type MediaClip = z.infer<typeof mediaClipSchema>;
export type TextClip = z.infer<typeof textClipSchema>;

export function createEmptyProject(
  id = crypto.randomUUID(),
  now = Date.now(),
): VibeProject {
  return projectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id,
    name: "Untitled cut",
    revision: 0,
    createdAt: now,
    updatedAt: now,
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 0,
      background: "#121116",
    },
    assets: [],
    tracks: [
      {
        id: `${id}-video`,
        name: "Video 1",
        kind: "video",
        muted: false,
        hidden: false,
        locked: false,
        order: 0,
      },
      {
        id: `${id}-audio`,
        name: "Audio 1",
        kind: "audio",
        muted: false,
        hidden: false,
        locked: false,
        order: 1,
      },
    ],
    clips: [],
    transitions: [],
    markers: [],
  });
}
