"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editor-store";
import type { MediaClip, TextClip, VibeClip } from "@/core/schema/project";
import { resolveClipState } from "@/core/render/resolve-clip";
import { useI18n } from "@/i18n";

function formatTimecode(seconds: number, fps: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * fps);
  return [hours, minutes, secs, frames]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function useLayerDrag(
  clip: VibeClip,
  projectWidth: number,
  projectHeight: number,
  onSelect: () => void,
) {
  const commitOperations = useEditorStore((state) => state.commitOperations);
  const { t } = useI18n();
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<{ x: number; y: number } | null>(null);

  const commitPosition = (x: number, y: number) => {
    if (x === clip.transform.x && y === clip.transform.y) {
      return;
    }
    commitOperations(t("edit.move", { name: clip.name }), [
      {
        op: "updateClip",
        clipId: clip.id,
        patch: { transform: { x, y } },
      },
    ]);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    onSelect();
    const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!canvas?.width || !canvas.height) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { x: clip.transform.x, y: clip.transform.y };
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const next = {
        x:
          initial.x +
          ((moveEvent.clientX - startX) / canvas.width) * projectWidth,
        y:
          initial.y +
          ((moveEvent.clientY - startY) / canvas.height) * projectHeight,
      };
      draftRef.current = next;
      setDraft(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalDraft = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (finalDraft) {
        commitPosition(
          Math.round(finalDraft.x * 10) / 10,
          Math.round(finalDraft.y * 10) / 10,
        );
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    onSelect();
    const amount = event.shiftKey ? 10 : 1;
    commitPosition(
      clip.transform.x + direction[0] * amount,
      clip.transform.y + direction[1] * amount,
    );
  };

  return {
    x: draft?.x ?? clip.transform.x,
    y: draft?.y ?? clip.transform.y,
    onPointerDown,
    onKeyDown,
  };
}

function MediaLayer({
  clip,
  url,
  currentTime,
  playing,
  selected,
  onSelect,
  projectWidth,
  projectHeight,
  muted,
  transitionAlpha,
}: {
  clip: MediaClip;
  url?: string;
  currentTime: number;
  playing: boolean;
  selected: boolean;
  onSelect: () => void;
  projectWidth: number;
  projectHeight: number;
  muted: boolean;
  transitionAlpha?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t } = useI18n();
  const asset = useEditorStore((state) =>
    state.project.assets.find((candidate) => candidate.id === clip.assetId),
  );
  const drag = useLayerDrag(
    clip,
    projectWidth,
    projectHeight,
    onSelect,
  );
  const state = resolveClipState(clip, currentTime);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset?.kind !== "video") {
      return;
    }
    const sourceTime =
      clip.sourceStart + (currentTime - clip.timelineStart) * clip.speed;
    if (Math.abs(video.currentTime - sourceTime) > 0.08) {
      video.currentTime = Math.max(0, sourceTime);
    }
    video.playbackRate = clip.speed;
    video.volume = Math.min(1, clip.volume);
    video.muted = muted;
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [asset?.kind, clip, currentTime, muted, playing]);

  const style = {
    left: `${(drag.x / projectWidth) * 100}%`,
    top: `${(drag.y / projectHeight) * 100}%`,
    width: `${(state.width / projectWidth) * 100}%`,
    height: `${(state.height / projectHeight) * 100}%`,
    opacity: state.opacity * (transitionAlpha ?? 1),
    transform: `rotate(${state.rotation}deg) scale(${state.scaleX}, ${state.scaleY})`,
    filter: [
      `brightness(${1 + state.brightness})`,
      `contrast(${1 + state.contrast})`,
      `saturate(${1 + state.saturation})`,
      `blur(${state.blur}px)`,
      ...(clip.effects ?? []).filter((effect) => effect.enabled).map((effect) =>
        effect.type === "grayscale"
          ? `grayscale(${effect.amount})`
          : effect.type === "sepia"
            ? `sepia(${effect.amount})`
            : effect.type === "drop-shadow"
              ? `drop-shadow(0 6px 14px #0008)`
              : "",
      ),
    ].filter(Boolean).join(" "),
    mixBlendMode: clip.blendMode,
    "--fit": clip.fit,
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className="preview-layer"
      style={style}
      aria-label={t("preview.select", { name: clip.name })}
      onClick={onSelect}
      onPointerDown={drag.onPointerDown}
      onKeyDown={drag.onKeyDown}
    >
      {url && asset?.kind === "video" ? (
        <video ref={videoRef} src={url} muted={muted} playsInline preload="auto" />
      ) : url && asset?.kind === "image" ? (
        // Object URLs are local user content and cannot use next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} />
      ) : null}
      {selected ? <span className="selection-outline" /> : null}
    </button>
  );
}

function AudioPlayback({
  clip,
  currentTime,
  muted,
  playing,
  url,
}: {
  clip: MediaClip;
  currentTime: number;
  muted: boolean;
  playing: boolean;
  url?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const sourceTime =
      clip.sourceStart + (currentTime - clip.timelineStart) * clip.speed;
    if (Math.abs(audio.currentTime - sourceTime) > 0.08) {
      audio.currentTime = Math.max(0, sourceTime);
    }
    audio.playbackRate = clip.speed;
    audio.volume = Math.min(1, clip.volume);
    audio.muted = muted;
    if (playing) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [clip, currentTime, muted, playing]);

  return url ? (
    <audio
      ref={audioRef}
      src={url}
      muted={muted}
      preload="auto"
      aria-label={t("preview.audio", { name: clip.name })}
    />
  ) : null;
}

function TextLayer({
  clip,
  selected,
  onSelect,
  projectWidth,
  projectHeight,
  currentTime,
  transitionAlpha,
}: {
  clip: TextClip;
  selected: boolean;
  onSelect: () => void;
  projectWidth: number;
  projectHeight: number;
  currentTime: number;
  transitionAlpha?: number;
}) {
  const { t } = useI18n();
  const drag = useLayerDrag(
    clip,
    projectWidth,
    projectHeight,
    onSelect,
  );
  const state = resolveClipState(clip, currentTime);

  return (
    <button
      type="button"
      className="preview-layer preview-text"
      aria-label={t("preview.select", { name: clip.name })}
      onClick={onSelect}
      style={{
        left: `${(drag.x / projectWidth) * 100}%`,
        top: `${(drag.y / projectHeight) * 100}%`,
        width: `${(state.width / projectWidth) * 100}%`,
        height: `${(state.height / projectHeight) * 100}%`,
        opacity: state.opacity * (transitionAlpha ?? 1),
        transform: `rotate(${state.rotation}deg)`,
        color: clip.style.color,
        background: clip.style.backgroundColor,
        fontFamily: clip.style.fontFamily,
        fontSize: `${(clip.style.fontSize / projectHeight) * 100}cqh`,
        fontWeight: clip.style.fontWeight,
        textAlign: clip.style.align,
        lineHeight: clip.style.lineHeight ?? 1.12,
        letterSpacing: `${clip.style.letterSpacing ?? 0}px`,
        textShadow: clip.style.shadow ? "0 4px 12px #0009" : undefined,
        WebkitTextStroke:
          (clip.style.outlineWidth ?? 0) > 0
            ? `${clip.style.outlineWidth}px ${clip.style.outlineColor}`
            : undefined,
      }}
      onPointerDown={drag.onPointerDown}
      onKeyDown={drag.onKeyDown}
    >
      {clip.text}
      {selected ? <span className="selection-outline" /> : null}
    </button>
  );
}

export function PreviewStage() {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const playing = useEditorStore((state) => state.playing);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const assetUrls = useEditorStore((state) => state.assetUrls);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const selectClip = useEditorStore((state) => state.selectClip);
  const { t } = useI18n();

  const activeClips = useMemo(
    () =>
      project.clips
        .filter((clip) => {
          const regular = currentTime >= clip.timelineStart && currentTime < clip.timelineStart + clip.duration;
          const transition = project.transitions.find((candidate) => candidate.toClipId === clip.id);
          const fromClip = transition ? project.clips.find((candidate) => candidate.id === transition.fromClipId) : undefined;
          const transitionVisible = Boolean(
            transition &&
              fromClip &&
              currentTime >= clip.timelineStart - transition.duration &&
              currentTime < clip.timelineStart,
          );
          return clip.enabled && !project.tracks.find((track) => track.id === clip.trackId)?.hidden && (regular || transitionVisible);
        })
        .sort((a, b) => {
          const aTrack =
            project.tracks.find((track) => track.id === a.trackId)?.order ?? 0;
          const bTrack =
            project.tracks.find((track) => track.id === b.trackId)?.order ?? 0;
          return aTrack - bTrack;
        }),
    [currentTime, project.clips, project.tracks, project.transitions],
  );

  const transitionAlpha = (clip: VibeClip): number => {
    const transition = project.transitions.find(
      (candidate) => candidate.fromClipId === clip.id || candidate.toClipId === clip.id,
    );
    if (!transition) return 1;
    const boundary = project.clips.find((candidate) => candidate.id === transition.toClipId)?.timelineStart;
    if (boundary === undefined || currentTime < boundary - transition.duration || currentTime >= boundary) return 1;
    const progress = Math.max(0, Math.min(1, (currentTime - (boundary - transition.duration)) / transition.duration));
    const eased = progress * progress * (3 - 2 * progress);
    return clip.id === transition.fromClipId ? 1 - eased : eased;
  };

  const aspectRatio = project.settings.width / project.settings.height;
  const canvasStyle = {
    aspectRatio,
    width: aspectRatio >= 1 ? "min(100%, 980px)" : "auto",
    height: aspectRatio < 1 ? "100%" : "auto",
    "--project-background": project.settings.background,
  } as React.CSSProperties;

  return (
    <section className="stage-column" aria-label={t("preview.title")}>
      <div className="preview-wrap">
        <div className="preview-canvas" style={canvasStyle}>
          {!activeClips.length ? (
            <div className="preview-empty">{t("preview.empty")}</div>
          ) : null}
          {activeClips.map((clip: VibeClip) =>
            clip.type === "media" ? (
              project.assets.find((asset) => asset.id === clip.assetId)?.kind ===
              "audio" ? (
                <AudioPlayback
                  key={clip.id}
                  clip={clip}
                  url={assetUrls[clip.assetId]}
                  currentTime={currentTime}
                  playing={playing}
                  muted={
                    project.tracks.find((track) => track.id === clip.trackId)
                      ?.muted ?? false
                  }
                />
              ) : (
                <MediaLayer
                  key={clip.id}
                  clip={clip}
                  url={assetUrls[clip.assetId]}
                  currentTime={currentTime}
                  playing={playing}
                  selected={selectedClipIds.includes(clip.id)}
                  onSelect={() => selectClip(clip.id)}
                  projectWidth={project.settings.width}
                  projectHeight={project.settings.height}
                  transitionAlpha={transitionAlpha(clip)}
                  muted={
                    project.tracks.find((track) => track.id === clip.trackId)
                      ?.muted ?? false
                  }
                />
              )
            ) : (
              <TextLayer
                key={clip.id}
                clip={clip}
                selected={selectedClipIds.includes(clip.id)}
                onSelect={() => selectClip(clip.id)}
                projectWidth={project.settings.width}
                projectHeight={project.settings.height}
                currentTime={currentTime}
                transitionAlpha={transitionAlpha(clip)}
              />
            ),
          )}
        </div>
      </div>
      <div className="transport">
        <IconButton
          icon={SkipBack}
          label={t("preview.goToStart")}
          onClick={() => setCurrentTime(0)}
        />
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? t("preview.pause") : t("preview.play")}
          onClick={() => setPlaying(!playing)}
        />
        <span className="timecode">
          {formatTimecode(currentTime, project.settings.fps)}
          {" / "}
          {formatTimecode(project.settings.duration, project.settings.fps)}
        </span>
      </div>
    </section>
  );
}
