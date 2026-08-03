import { z } from "zod";
import {
  assetSchema,
  colorAdjustmentsSchema,
  mediaClipSchema,
  textClipSchema,
  trackSchema,
  transitionSchema,
  transformSchema,
} from "./project";

const clipPatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  timelineStart: z.number().finite().min(0).optional(),
  duration: z.number().finite().positive().optional(),
  sourceStart: z.number().finite().min(0).optional(),
  speed: z.number().finite().min(0.1).max(8).optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
  transform: transformSchema.partial().optional(),
  adjustments: colorAdjustmentsSchema.partial().optional(),
  volume: z.number().finite().min(0).max(2).optional(),
  fadeIn: z.number().finite().min(0).optional(),
  fadeOut: z.number().finite().min(0).optional(),
  text: z.string().max(2_000).optional(),
  role: z.enum(["title", "caption", "subtitle"]).optional(),
  style: textClipSchema.shape.style.partial().optional(),
  keyframes: textClipSchema.shape.keyframes,
  effects: textClipSchema.shape.effects,
  mask: textClipSchema.shape.mask,
  blendMode: textClipSchema.shape.blendMode,
});

export const editOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("addAsset"),
    asset: assetSchema,
  }),
  z.object({
    op: z.literal("addTrack"),
    track: trackSchema,
  }),
  z.object({
    op: z.literal("removeTrack"),
    trackId: z.string().min(1),
    removeClips: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("addMedia"),
    clip: mediaClipSchema,
  }),
  z.object({
    op: z.literal("addText"),
    clip: textClipSchema,
  }),
  z.object({
    op: z.literal("addTransition"),
    transition: transitionSchema,
  }),
  z.object({
    op: z.literal("updateTransition"),
    transitionId: z.string().min(1),
    patch: transitionSchema.partial().omit({ id: true }).optional(),
  }),
  z.object({
    op: z.literal("removeTransition"),
    transitionId: z.string().min(1),
  }),
  z.object({
    op: z.literal("duplicateClip"),
    clipId: z.string().min(1),
    duplicateId: z.string().min(1),
    timelineStart: z.number().finite().min(0).optional(),
  }),
  z.object({
    op: z.literal("updateClip"),
    clipId: z.string().min(1),
    patch: clipPatchSchema,
  }),
  z.object({
    op: z.literal("moveClip"),
    clipId: z.string().min(1),
    trackId: z.string().min(1).optional(),
    timelineStart: z.number().finite().min(0),
  }),
  z.object({
    op: z.literal("trimClip"),
    clipId: z.string().min(1),
    side: z.enum(["start", "end"]),
    time: z.number().finite().min(0),
  }),
  z.object({
    op: z.literal("splitClip"),
    clipId: z.string().min(1),
    time: z.number().finite().min(0),
    rightClipId: z.string().min(1),
  }),
  z.object({
    op: z.literal("removeClip"),
    clipId: z.string().min(1),
  }),
  z.object({
    op: z.literal("setCanvas"),
    width: z.number().int().min(16).max(7_680).optional(),
    height: z.number().int().min(16).max(7_680).optional(),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).optional(),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  z.object({
    op: z.literal("addMarker"),
    id: z.string().min(1),
    time: z.number().finite().min(0),
    label: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8c7ac4"),
  }),
]);

export const editPlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  explanation: z.string().min(1).max(2_000),
  operations: z.array(editOperationSchema).min(1).max(100),
  warnings: z.array(z.string().max(500)).max(20).default([]),
});

export type EditOperation = z.infer<typeof editOperationSchema>;
export type EditPlan = z.infer<typeof editPlanSchema>;
