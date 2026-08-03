"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { translate } from "@/i18n";

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const store = useEditorStore.getState();
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        store.setPlaying(!store.playing);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        if (store.selectedClipIds.length) {
          event.preventDefault();
          store.commitOperations(
            translate("edit.delete"),
            store.selectedClipIds.map((clipId) => ({
              op: "removeClip" as const,
              clipId,
            })),
          );
          store.selectClip(null);
        }
        return;
      }
      if (event.key.toLowerCase() === "s" && store.selectedClipIds.length === 1) {
        const clip = store.project.clips.find(
          (candidate) => candidate.id === store.selectedClipIds[0],
        );
        if (
          clip &&
          store.currentTime > clip.timelineStart &&
          store.currentTime < clip.timelineStart + clip.duration
        ) {
          event.preventDefault();
          store.commitOperations(translate("edit.split"), [
            {
              op: "splitClip",
              clipId: clip.id,
              time: store.currentTime,
              rightClipId: crypto.randomUUID(),
            },
          ]);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
