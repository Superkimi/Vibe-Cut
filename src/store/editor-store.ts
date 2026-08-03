"use client";

import { create } from "zustand";
import { applyEditPlan } from "@/core/editor/apply-edit-plan";
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
import { translate } from "@/i18n";

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
    set({ currentTime: Math.max(0, Math.min(time, duration || 0)) });
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
      const targetTrack =
        state.project.tracks.find((track) =>
          asset.kind === "audio"
            ? track.kind === "audio"
            : track.kind === "video",
        ) ?? state.project.tracks[0];
      const timelineStart = state.project.settings.duration;
      const operations: EditOperation[] = [{ op: "addAsset", asset }];
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
