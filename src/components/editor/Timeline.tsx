"use client";

import { useMemo, useState } from "react";
import {
  ArrowsOutLineHorizontal,
  Copy,
  Lock,
  Magnet,
  Minus,
  Plus,
  Scissors,
  SpeakerHigh,
  SpeakerSlash,
  TextT,
  Waves,
} from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editor-store";
import type { VibeClip } from "@/core/schema/project";
import { useI18n } from "@/i18n";
import { snapTimeToFrame } from "@/core/render/resolve-clip";

function secondsLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function snapTime(time: number, fps: number, enabled: boolean): number {
  if (!enabled) {
    return Math.max(0, time);
  }
  return snapTimeToFrame(time, fps);
}

function TimelineClip({
  clip,
  zoom,
}: {
  clip: VibeClip;
  zoom: number;
}) {
  const selected = useEditorStore((state) =>
    state.selectedClipIds.includes(clip.id),
  );
  const selectClip = useEditorStore((state) => state.selectClip);
  const commitOperations = useEditorStore((state) => state.commitOperations);
  const fps = useEditorStore((state) => state.project.settings.fps);
  const projectClips = useEditorStore((state) => state.project.clips);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const rippleEnabled = useEditorStore((state) => state.rippleEnabled);
  const { t } = useI18n();
  const [draft, setDraft] = useState<{
    start: number;
    duration: number;
  } | null>(null);

  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    mode: "move" | "left" | "right",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    selectClip(clip.id, event.metaKey || event.ctrlKey);
    const startX = event.clientX;
    const initial = {
      start: clip.timelineStart,
      duration: clip.duration,
      sourceStart: clip.sourceStart,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / zoom;
      if (mode === "move") {
        setDraft({
          start: snapTime(initial.start + delta, fps, snapEnabled),
          duration: initial.duration,
        });
      } else if (mode === "left") {
        const nextStart = snapTime(
          Math.max(
            initial.start,
            Math.min(
              initial.start + initial.duration - 0.05,
              initial.start + delta,
            ),
          ),
          fps,
          snapEnabled,
        );
        setDraft({
          start: nextStart,
          duration: initial.duration - (nextStart - initial.start),
        });
      } else {
        setDraft({
          start: initial.start,
          duration: Math.max(
            0.05,
            snapTime(initial.duration + delta, fps, snapEnabled),
          ),
        });
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDraft((finalDraft) => {
        if (finalDraft) {
          if (mode === "move") {
            commitOperations(t("edit.move", { name: clip.name }), [
              {
                op: "moveClip",
                clipId: clip.id,
                timelineStart: finalDraft.start,
              },
            ]);
          } else if (mode === "left") {
            const removedDuration = finalDraft.start - initial.start;
            const rippleMoves =
              rippleEnabled && removedDuration > 0
                ? projectClips
                    .filter(
                      (candidate) =>
                        candidate.id !== clip.id &&
                        candidate.trackId === clip.trackId &&
                        candidate.timelineStart >=
                          initial.start + initial.duration,
                    )
                    .map((candidate) => ({
                      op: "moveClip" as const,
                      clipId: candidate.id,
                      timelineStart: Math.max(
                        0,
                        candidate.timelineStart - removedDuration,
                      ),
                    }))
                : [];
            commitOperations(t("edit.trim", { name: clip.name }), [
              {
                op: "trimClip",
                clipId: clip.id,
                side: "start",
                time: finalDraft.start,
              },
              ...(rippleEnabled && removedDuration > 0
                ? [
                    {
                      op: "moveClip" as const,
                      clipId: clip.id,
                      timelineStart: initial.start,
                    },
                  ]
                : []),
              ...rippleMoves,
            ]);
          } else {
            const durationDelta = finalDraft.duration - initial.duration;
            const rippleMoves =
              rippleEnabled && durationDelta !== 0
                ? projectClips
                    .filter(
                      (candidate) =>
                        candidate.id !== clip.id &&
                        candidate.trackId === clip.trackId &&
                        candidate.timelineStart >=
                          initial.start + initial.duration,
                    )
                    .map((candidate) => ({
                      op: "moveClip" as const,
                      clipId: candidate.id,
                      timelineStart: Math.max(
                        0,
                        candidate.timelineStart + durationDelta,
                      ),
                    }))
                : [];
            commitOperations(t("edit.trim", { name: clip.name }), [
              {
                op: "trimClip",
                clipId: clip.id,
                side: "end",
                time: initial.start + finalDraft.duration,
              },
              ...rippleMoves,
            ]);
          }
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const asset = useEditorStore((state) =>
    clip.type === "media"
      ? state.project.assets.find((candidate) => candidate.id === clip.assetId)
      : undefined,
  );
  const view = draft ?? { start: clip.timelineStart, duration: clip.duration };
  const kind = clip.type === "text" ? "text" : asset?.kind ?? "video";

  return (
    <div
      className="timeline-clip"
      data-kind={kind}
      data-selected={selected}
      style={{
        left: view.start * zoom,
        width: Math.max(8, view.duration * zoom),
      }}
      role="button"
      tabIndex={0}
      aria-label={t("timeline.clipAria", {
        name: clip.name,
        start: secondsLabel(view.start),
        duration: view.duration.toFixed(1),
      })}
      onPointerDown={(event) => beginDrag(event, "move")}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          selectClip(clip.id, event.metaKey || event.ctrlKey);
        }
      }}
    >
      <span
        className="resize-handle left"
        aria-hidden="true"
        onPointerDown={(event) => beginDrag(event, "left")}
      />
      <span className="clip-title">{clip.name}</span>
      <span className="clip-duration">{view.duration.toFixed(1)}s</span>
      <span
        className="resize-handle right"
        aria-hidden="true"
        onPointerDown={(event) => beginDrag(event, "right")}
      />
    </div>
  );
}

export function Timeline() {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const rippleEnabled = useEditorStore((state) => state.rippleEnabled);
  const toggleSnap = useEditorStore((state) => state.toggleSnap);
  const toggleRipple = useEditorStore((state) => state.toggleRipple);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const commitOperations = useEditorStore((state) => state.commitOperations);
  const addTextClip = useEditorStore((state) => state.addTextClip);
  const { t } = useI18n();

  const contentDuration = Math.max(project.settings.duration, 12);
  const contentWidth = Math.max(900, contentDuration * zoom + 420);
  const tickStep = zoom >= 120 ? 1 : zoom >= 60 ? 2 : 5;
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(contentDuration / tickStep) + 1 },
        (_, index) => index * tickStep,
      ),
    [contentDuration, tickStep],
  );

  const splitSelected = () => {
    const clip =
      selectedClipIds.length === 1
        ? project.clips.find((candidate) => candidate.id === selectedClipIds[0])
        : null;
    if (
      clip &&
      currentTime > clip.timelineStart &&
      currentTime < clip.timelineStart + clip.duration
    ) {
      commitOperations(t("edit.split"), [
        {
          op: "splitClip",
          clipId: clip.id,
          time: currentTime,
          rightClipId: crypto.randomUUID(),
        },
      ]);
    }
  };

  const duplicateSelected = () => {
    if (selectedClipIds.length !== 1) return;
    const clip = project.clips.find((candidate) => candidate.id === selectedClipIds[0]);
    if (!clip) return;
    commitOperations(t("edit.duplicate"), [
      { op: "duplicateClip", clipId: clip.id, duplicateId: crypto.randomUUID() },
    ]);
  };

  const addTransition = () => {
    if (selectedClipIds.length !== 2) return;
    const clips = selectedClipIds
      .map((id) => project.clips.find((clip) => clip.id === id))
      .filter((clip): clip is VibeClip => Boolean(clip))
      .sort((a, b) => a.timelineStart - b.timelineStart);
    if (clips.length !== 2 || clips[0].trackId !== clips[1].trackId) return;
    commitOperations(t("edit.transition"), [
      {
        op: "addTransition",
        transition: {
          id: crypto.randomUUID(),
          fromClipId: clips[0].id,
          toClipId: clips[1].id,
          type: "dissolve",
          duration: Math.min(0.5, clips[0].duration, clips[1].duration),
          easing: "smooth",
        },
      },
    ]);
  };

  return (
    <section className="timeline-shell" aria-label={t("timeline.title")}>
      <div className="timeline-toolbar">
        <div className="toolbar-group">
          <IconButton
            icon={Scissors}
            label={t("timeline.split")}
            disabled={selectedClipIds.length !== 1}
            onClick={splitSelected}
          />
          <IconButton
            icon={TextT}
            label={t("timeline.addText")}
            onClick={() => addTextClip()}
          />
          <IconButton
            icon={Copy}
            label={t("timeline.duplicate")}
            disabled={selectedClipIds.length !== 1}
            onClick={duplicateSelected}
          />
          <IconButton
            icon={Waves}
            label={t("timeline.transition")}
            disabled={selectedClipIds.length !== 2}
            onClick={addTransition}
          />
          <button
            type="button"
            className="tool-button"
            data-active={snapEnabled}
            onClick={toggleSnap}
          >
            <Magnet size={16} aria-hidden="true" />
            {t("timeline.snap")}
          </button>
          <button
            type="button"
            className="tool-button"
            data-active={rippleEnabled}
            onClick={toggleRipple}
          >
            <ArrowsOutLineHorizontal size={16} aria-hidden="true" />
            {t("timeline.ripple")}
          </button>
        </div>
        <div className="zoom-control">
          <Minus size={12} aria-hidden="true" />
          <label className="sr-only" htmlFor="timeline-zoom">
            {t("timeline.zoom")}
          </label>
          <input
            id="timeline-zoom"
            type="range"
            min="24"
            max="240"
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
          <Plus size={12} aria-hidden="true" />
        </div>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-content" style={{ width: contentWidth }}>
          <div
            className="ruler"
            style={{ marginLeft: 148 }}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setCurrentTime((event.clientX - rect.left) / zoom);
            }}
          >
            {ticks.map((time) => (
              <span key={time}>
                <span className="ruler-tick" style={{ left: time * zoom }} />
                <span className="ruler-label" style={{ left: time * zoom }}>
                  {secondsLabel(time)}
                </span>
              </span>
            ))}
          </div>
          {project.tracks.map((track) => (
            <div className="track-row" key={track.id}>
              <div className="track-label">
                {track.locked ? (
                    <Lock size={13} aria-label={t("timeline.locked")} />
                ) : track.muted ? (
                    <SpeakerSlash size={13} aria-label={t("timeline.muted")} />
                ) : (
                  <SpeakerHigh size={13} aria-hidden="true" />
                )}
                <span className="track-name">{track.name}</span>
              </div>
              <div
                className="track-lane"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setCurrentTime((event.clientX - rect.left) / zoom);
                  }
                }}
              >
                {project.clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip) => (
                    <TimelineClip clip={clip} zoom={zoom} key={clip.id} />
                  ))}
              </div>
            </div>
          ))}
          <div
            className="playhead"
            style={{ left: 148 + currentTime * zoom }}
          />
        </div>
      </div>
    </section>
  );
}
