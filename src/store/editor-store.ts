"use client";

import { create } from "zustand";
import { applyEditPlan } from "@/core/editor/apply-edit-plan";
import type { MutationReceipt } from "@/core/editor/mutation-receipt";
import type { EditOperation, EditPlan } from "@/core/schema/edit-plan";
import {
  createEmptyProject,
  projectSchema,
  type VibeAsset,
  type VibeProject,
} from "@/core/schema/project";
import { getAssetUrl, registerAssetFile } from "@/core/media/asset-registry";
import { probeMediaFile } from "@/core/media/probe-media";
import { loadLatestProject, saveProject } from "@/core/storage/project-db";
import { createProjectArchive, readProjectArchive } from "@/core/storage/project-archive";
import { translate } from "@/i18n";
import { snapTimeToFrame } from "@/core/render/resolve-clip";

interface HistoryEntry {
  label: string;
  project: VibeProject;
}

interface EditorStore {
  project: VibeProject;
  ready: boolean;
  currentTime: number;
  playing: boolean;
  zoom: number;
  snapEnabled: boolean;
  rippleEnabled: boolean;
  selectedClipIds: string[];
  assetUrls: Record<string, string>;
  past: HistoryEntry[];
  future: HistoryEntry[];
  pendingPlan: EditPlan | null;
  notice: string | null;
  lastReceipt: MutationReceipt | null;
  initialize: () => Promise<void>;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  toggleRipple: () => void;
  selectClip: (clipId: string | null, additive?: boolean) => void;
  commitOperations: (label: string, operations: EditOperation[]) => void;
  applyPlan: (plan: EditPlan) => void;
  setPendingPlan: (plan: EditPlan | null) => void;
  undo: () => void;
  redo: () => void;
  importFiles: (files: File[]) => Promise<void>;
  addAssetToTimeline: (assetId: string) => void;
  addTextClip: (text?: string, role?: "title" | "caption" | "subtitle") => void;
  exportProjectArchive: () => Promise<Blob>;
  importProjectArchive: (file: File) => Promise<void>;
  hydrateAssetUrls: () => Promise<void>;
  setNotice: (notice: string | null) => void;
}

const HISTORY_LIMIT = 100;

function persist(project: VibeProject): void {
  void saveProject(project).catch(() => {
    // Persistence failure is non-fatal for the current editing session.
  });
}

function fitTransform(asset: VibeAsset, project: VibeProject) {
  const sourceWidth = asset.width ?? project.settings.width;
  const sourceHeight = asset.height ?? project.settings.height;
  const scale = Math.min(
    project.settings.width / sourceWidth,
    project.settings.height / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (project.settings.width - width) / 2,
    y: (project.settings.height - height) / 2,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

function baseAdjustments() {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    blur: 0,
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: createEmptyProject(),
  ready: false,
  currentTime: 0,
  playing: false,
  zoom: 72,
  snapEnabled: true,
  rippleEnabled: false,
  selectedClipIds: [],
  assetUrls: {},
  past: [],
  future: [],
  pendingPlan: null,
  notice: null,
  lastReceipt: null,

  initialize: async () => {
    const existing = await loadLatestProject().catch(() => null);
    if (existing) {
      set({ project: existing });
    } else {
      await saveProject(get().project).catch(() => {
        // The editor can still run in-memory when persistence is unavailable.
      });
    }
    await get().hydrateAssetUrls();
    set({ ready: true });
  },
  setCurrentTime: (time) => {
    const duration = get().project.settings.duration;
    const clamped = Math.max(0, Math.min(time, duration || 0));
    set({ currentTime: snapTimeToFrame(clamped, get().project.settings.fps) });
  },
  setPlaying: (playing) => set({ playing }),
  setZoom: (zoom) => set({ zoom: Math.max(24, Math.min(240, zoom)) }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleRipple: () => set((state) => ({ rippleEnabled: !state.rippleEnabled })),
  selectClip: (clipId, additive = false) =>
    set((state) => {
      if (!clipId) {
        return { selectedClipIds: [] };
      }
      if (!additive) {
        return { selectedClipIds: [clipId] };
      }
      return {
        selectedClipIds: state.selectedClipIds.includes(clipId)
          ? state.selectedClipIds.filter((id) => id !== clipId)
          : [...state.selectedClipIds, clipId],
      };
    }),
  commitOperations: (label, operations) => {
    const state = get();
    const plan: EditPlan = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      baseRevision: state.project.revision,
      title: label,
      explanation: label,
      operations,
      warnings: [],
    };
    state.applyPlan(plan);
  },
  applyPlan: (plan) => {
    const state = get();
    const result = applyEditPlan(state.project, plan);
    const past = [
      ...state.past,
      { label: plan.title, project: state.project },
    ].slice(-HISTORY_LIMIT);
    set({
      project: result.project,
      past,
      future: [],
      pendingPlan: null,
      lastReceipt: result.receipt,
      notice: translate("notice.applied", { label: plan.title }),
    });
    persist(result.project);
  },
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  undo: () => {
    const state = get();
    const previous = state.past.at(-1);
    if (!previous) {
      return;
    }
    const restored = projectSchema.parse(previous.project);
    set({
      project: restored,
      past: state.past.slice(0, -1),
      future: [{ label: previous.label, project: state.project }, ...state.future],
      pendingPlan: null,
      lastReceipt: null,
      notice: translate("notice.undid", { label: previous.label }),
    });
    persist(restored);
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) {
      return;
    }
    const restored = projectSchema.parse(next.project);
    set({
      project: restored,
      past: [...state.past, { label: next.label, project: state.project }],
      future: state.future.slice(1),
      pendingPlan: null,
      lastReceipt: null,
      notice: translate("notice.redid", { label: next.label }),
    });
    persist(restored);
  },
  importFiles: async (files) => {
    for (const file of files) {
      const state = get();
      let asset: VibeAsset;
      try {
        asset = await probeMediaFile(file);
      } catch (error) {
        throw new Error(translate("error.readFile", { name: file.name }), { cause: error });
      }
      let url: string;
      try {
        url = await registerAssetFile(asset.id, file);
      } catch (error) {
        throw new Error(translate("error.storeFile", { name: file.name }), {
          cause: error,
        });
      }
      const existingTrack =
        state.project.tracks.find((track) =>
          asset.kind === "audio"
            ? track.kind === "audio"
            : asset.kind === "image"
              ? track.kind === "overlay"
              : track.kind === "video",
        );
      const auxiliaryTrack = !existingTrack && asset.kind === "image"
        ? {
            id: `${state.project.id}-overlay`,
            name: "Overlay 1",
            kind: "overlay" as const,
            muted: false,
            hidden: false,
            locked: false,
            order: Math.max(...state.project.tracks.map((track) => track.order), 0) + 1,
          }
        : null;
      const targetTrack = existingTrack ?? auxiliaryTrack ?? state.project.tracks[0];
      const timelineStart = state.project.settings.duration;
      const operations: EditOperation[] = [{ op: "addAsset", asset }];
      if (auxiliaryTrack) operations.push({ op: "addTrack", track: auxiliaryTrack });
      operations.push({
        op: "addMedia",
        clip: {
          id: crypto.randomUUID(),
          type: "media",
          assetId: asset.id,
          trackId: targetTrack.id,
          name: asset.name,
          timelineStart,
          duration: Math.max(asset.duration, 0.1),
          sourceStart: 0,
          speed: 1,
          opacity: 1,
          enabled: true,
          locked: false,
          transform: fitTransform(asset, state.project),
          adjustments: baseAdjustments(),
          fit: "contain",
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
      });
      get().commitOperations(translate("edit.import", { name: asset.name }), operations);
      set((current) => ({
        assetUrls: { ...current.assetUrls, [asset.id]: url },
      }));
    }
  },
  addAssetToTimeline: (assetId) => {
    const state = get();
    const asset = state.project.assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const existingTrack = state.project.tracks.find((track) =>
      asset.kind === "audio"
        ? track.kind === "audio"
        : asset.kind === "image"
          ? track.kind === "overlay"
          : track.kind === "video",
    );
    const auxiliaryTrack = !existingTrack && asset.kind === "image"
      ? {
          id: `${state.project.id}-overlay`,
          name: "Overlay 1",
          kind: "overlay" as const,
          muted: false,
          hidden: false,
          locked: false,
          order: Math.max(...state.project.tracks.map((track) => track.order), 0) + 1,
        }
      : null;
    const targetTrack = existingTrack ?? auxiliaryTrack ?? state.project.tracks[0];
    const duration = Math.max(asset.duration, asset.kind === "image" ? 4 : 0.1);
    const sourceWidth = asset.width ?? state.project.settings.width;
    const sourceHeight = asset.height ?? state.project.settings.height;
    const scale = Math.min(
      state.project.settings.width / sourceWidth,
      state.project.settings.height / sourceHeight,
    );
    state.commitOperations(translate("edit.addToTimeline", { name: asset.name }), [
      ...(auxiliaryTrack ? [{ op: "addTrack" as const, track: auxiliaryTrack }] : []),
      {
        op: "addMedia",
        clip: {
          id: crypto.randomUUID(),
          type: "media",
          assetId,
          trackId: targetTrack.id,
          name: asset.name,
          timelineStart: state.currentTime,
          duration,
          sourceStart: 0,
          speed: 1,
          opacity: 1,
          enabled: true,
          locked: false,
          transform: {
            x: (state.project.settings.width - sourceWidth * scale) / 2,
            y: (state.project.settings.height - sourceHeight * scale) / 2,
            width: sourceWidth * scale,
            height: sourceHeight * scale,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          adjustments: baseAdjustments(),
          fit: "contain",
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
      },
    ]);
  },
  addTextClip: (text = "Your title", role = "title") => {
    const state = get();
    const existingTrack = state.project.tracks.find((candidate) => candidate.kind === "text");
    const auxiliaryTrack = !existingTrack
      ? {
          id: `${state.project.id}-text`,
          name: "Text 1",
          kind: "text" as const,
          muted: false,
          hidden: false,
          locked: false,
          order: Math.max(...state.project.tracks.map((track) => track.order), 0) + 1,
        }
      : null;
    const track = existingTrack ?? auxiliaryTrack ?? state.project.tracks.find((candidate) => candidate.kind !== "audio");
    if (!track) return;
    state.commitOperations(translate("edit.addText", { text }), [
      ...(auxiliaryTrack ? [{ op: "addTrack" as const, track: auxiliaryTrack }] : []),
      {
        op: "addText",
        clip: {
          id: crypto.randomUUID(),
          type: "text",
          role,
          trackId: track.id,
          name: role === "caption" ? "Caption" : "Title",
          timelineStart: state.currentTime,
          duration: Math.max(3, Math.min(5, state.project.settings.duration - state.currentTime || 3)),
          sourceStart: 0,
          speed: 1,
          opacity: 1,
          enabled: true,
          locked: false,
          transform: {
            x: state.project.settings.width * 0.1,
            y: role === "caption" ? state.project.settings.height * 0.72 : state.project.settings.height * 0.38,
            width: state.project.settings.width * 0.8,
            height: role === "caption" ? state.project.settings.height * 0.16 : state.project.settings.height * 0.24,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          adjustments: baseAdjustments(),
          text,
          style: {
            fontFamily: "Geist",
            fontSize: role === "caption" ? 48 : 72,
            fontWeight: role === "caption" ? 600 : 700,
            color: "#f7f6fb",
            backgroundColor: role === "caption" ? "#00000099" : "#00000000",
            align: "center",
            lineHeight: 1.12,
            letterSpacing: 0,
            outlineColor: "#00000099",
            outlineWidth: role === "caption" ? 2 : 0,
            shadow: true,
          },
        },
      },
    ]);
  },
  exportProjectArchive: async () => createProjectArchive(get().project),
  importProjectArchive: async (file) => {
    const archive = await readProjectArchive(file);
    const assetUrls: Record<string, string> = {};
    for (const asset of archive.assets) {
      assetUrls[asset.id] = await registerAssetFile(asset.id, asset.blob);
    }
    await saveProject(archive.project);
    set({
      project: archive.project,
      assetUrls,
      past: [],
      future: [],
      pendingPlan: null,
      selectedClipIds: [],
      currentTime: 0,
      playing: false,
      notice: translate("notice.projectImported"),
    });
  },
  hydrateAssetUrls: async () => {
    const entries = await Promise.all(
      get().project.assets.map(async (asset) => [
        asset.id,
        await getAssetUrl(asset.id),
      ] as const),
    );
    set({
      assetUrls: Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      ),
    });
  },
  setNotice: (notice) => set({ notice }),
}));
