import type {
  MediaClip,
  TextClip,
  VibeAsset,
  VibeClip,
  VibeProject,
} from "@/core/schema/project";
import { resolveClipState, type ResolvedClipState } from "@/core/render/resolve-clip";

type VisualResource = HTMLVideoElement | HTMLImageElement;

function waitFor(
  target: EventTarget,
  success: string,
  failure: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(success, onSuccess);
      target.removeEventListener(failure, onFailure);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onFailure = () => {
      cleanup();
      reject(new Error("A media asset could not be decoded for export."));
    };
    target.addEventListener(success, onSuccess, { once: true });
    target.addEventListener(failure, onFailure, { once: true });
  });
}

async function createResource(
  asset: VibeAsset,
  url: string,
): Promise<VisualResource | null> {
  if (asset.kind === "video") {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const metadataLoaded = waitFor(video, "loadedmetadata", "error");
    video.src = url;
    await metadataLoaded;
    return video;
  }
  if (asset.kind === "image") {
    const image = new Image();
    image.decoding = "async";
    const loaded = waitFor(image, "load", "error");
    image.src = url;
    await loaded;
    return image;
  }
  return null;
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)));
  if (Math.abs(video.currentTime - target) <= 0.001) {
    return;
  }
  const ready = waitFor(video, "seeked", "error");
  video.currentTime = target;
  await ready;
}

function activeAt(
  clip: MediaClip | TextClip,
  time: number,
): boolean {
  return (
    clip.enabled &&
    time >= clip.timelineStart &&
    time < clip.timelineStart + clip.duration
  );
}

function drawMedia(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  clip: MediaClip,
  asset: VibeAsset,
  state: ResolvedClipState,
  alpha = 1,
  wipeProgress?: number,
): void {
  const sourceWidth = asset.width ?? clip.transform.width;
  const sourceHeight = asset.height ?? clip.transform.height;
  const boxWidth = state.width;
  const boxHeight = state.height;
  let drawX = -boxWidth / 2;
  let drawY = -boxHeight / 2;
  let drawWidth = boxWidth;
  let drawHeight = boxHeight;

  if (clip.fit !== "fill") {
    const scale =
      clip.fit === "cover"
        ? Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight)
        : Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    drawWidth = sourceWidth * scale;
    drawHeight = sourceHeight * scale;
    drawX = -drawWidth / 2;
    drawY = -drawHeight / 2;
  }

  context.save();
  context.translate(
    state.x + boxWidth / 2,
    state.y + boxHeight / 2,
  );
  context.rotate((state.rotation * Math.PI) / 180);
  context.scale(state.scaleX, state.scaleY);
  context.globalAlpha = Math.max(0, Math.min(1, state.opacity * alpha));
  const effectFilters = (clip.effects ?? [])
    .filter((effect) => effect.enabled)
    .flatMap((effect) => {
      switch (effect.type) {
        case "grayscale":
          return [`grayscale(${effect.amount})`];
        case "sepia":
          return [`sepia(${effect.amount})`];
        case "sharpen":
          return [`contrast(${1 + effect.amount * 0.25})`];
        case "drop-shadow":
          return [`drop-shadow(0 6px 14px #000000${Math.round(effect.amount * 99).toString(16).padStart(2, "0")})`];
        case "vignette":
          return [];
      }
    });
  context.filter = [
    `brightness(${1 + state.brightness})`,
    `contrast(${1 + state.contrast})`,
    `saturate(${1 + state.saturation})`,
    `blur(${state.blur}px)`,
    ...effectFilters,
  ].join(" ");
  if (clip.blendMode) {
    context.globalCompositeOperation = clip.blendMode === "normal" ? "source-over" : clip.blendMode;
  }
  if (clip.mask) {
    context.beginPath();
    if (clip.mask.type === "ellipse") {
      context.ellipse(
        clip.mask.x - boxWidth / 2 + clip.mask.width / 2,
        clip.mask.y - boxHeight / 2 + clip.mask.height / 2,
        clip.mask.width / 2,
        clip.mask.height / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else {
      context.rect(
        clip.mask.x - boxWidth / 2,
        clip.mask.y - boxHeight / 2,
        clip.mask.width,
        clip.mask.height,
      );
    }
    context.clip();
  } else {
    context.beginPath();
    context.rect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
    context.clip();
  }
  if (wipeProgress !== undefined) {
    context.beginPath();
    const width = boxWidth * Math.max(0, Math.min(1, wipeProgress));
    context.rect(-boxWidth / 2, -boxHeight / 2, width, boxHeight);
    context.clip();
  }
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  const vignette = (clip.effects ?? []).find((effect) => effect.enabled && effect.type === "vignette");
  if (vignette) {
    const gradient = context.createRadialGradient(0, 0, Math.min(boxWidth, boxHeight) * 0.2, 0, 0, Math.max(boxWidth, boxHeight) * 0.75);
    gradient.addColorStop(0, "#00000000");
    gradient.addColorStop(1, `#000000${Math.round(vignette.amount * 180).toString(16).padStart(2, "0")}`);
    context.fillStyle = gradient;
    context.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
  }
  context.restore();
}

function drawText(
  context: CanvasRenderingContext2D,
  clip: TextClip,
  state: ResolvedClipState,
  alpha = 1,
): void {
  const { style } = clip;
  context.save();
  context.translate(
    state.x + state.width / 2,
    state.y + state.height / 2,
  );
  context.rotate((state.rotation * Math.PI) / 180);
  context.globalAlpha = Math.max(0, Math.min(1, state.opacity * alpha));
  context.fillStyle = style.backgroundColor ?? "#00000000";
  context.fillRect(
    -state.width / 2,
    -state.height / 2,
    state.width,
    state.height,
  );
  context.fillStyle = style.color;
  context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}, sans-serif`;
  context.textAlign = style.align;
  context.textBaseline = "middle";
  if (style.shadow) {
    context.shadowColor = "#00000099";
    context.shadowBlur = 12;
    context.shadowOffsetY = 4;
  }
  const x =
    style.align === "left"
      ? -state.width / 2
      : style.align === "right"
        ? state.width / 2
        : 0;
  const lines = clip.text.split("\n");
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.12);
  const totalHeight = (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
    if ((style.outlineWidth ?? 0) > 0) {
      context.strokeStyle = style.outlineColor ?? "#00000000";
      context.lineWidth = style.outlineWidth ?? 0;
      context.strokeText(line, x, index * lineHeight - totalHeight / 2);
    }
    context.fillText(line, x, index * lineHeight - totalHeight / 2);
  });
  context.restore();
}

export class ProjectFrameRenderer {
  private resources = new Map<string, VisualResource>();

  constructor(
    private readonly project: VibeProject,
    private readonly assetUrls: Record<string, string>,
  ) {}

  async prepare(): Promise<void> {
    const visualAssets = this.project.assets.filter(
      (asset) => asset.kind === "video" || asset.kind === "image",
    );
    await Promise.all(
      visualAssets.map(async (asset) => {
        const url = this.assetUrls[asset.id];
        if (!url) {
          return;
        }
        const resource = await createResource(asset, url);
        if (resource) {
          this.resources.set(asset.id, resource);
        }
      }),
    );
  }

  async render(
    canvas: HTMLCanvasElement,
    time: number,
  ): Promise<void> {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Canvas 2D rendering is not available.");
    }
    context.save();
    context.fillStyle = this.project.settings.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    const active = this.project.clips
      .filter(
        (clip) =>
          activeAt(clip, time) &&
          !this.project.tracks.find((track) => track.id === clip.trackId)
            ?.hidden,
      )
      .sort((a, b) => {
        const aOrder =
          this.project.tracks.find((track) => track.id === a.trackId)?.order ?? 0;
        const bOrder =
          this.project.tracks.find((track) => track.id === b.trackId)?.order ?? 0;
        return aOrder - bOrder;
      });

    const transitionByFromId = new Map(
      this.project.transitions.map((transition) => [transition.fromClipId, transition]),
    );
    const rendered = new Set<string>();
    const renderClip = async (
      clip: VibeClip,
      sampleTime: number,
      alpha = 1,
      wipeProgress?: number,
    ) => {
      if (clip.type === "text") {
        drawText(context, clip, resolveClipState(clip, sampleTime), alpha);
        return;
      }
      const resource = this.resources.get(clip.assetId);
      const asset = this.project.assets.find((candidate) => candidate.id === clip.assetId);
      if (!resource || !asset) return;
      if (resource instanceof HTMLVideoElement) {
        await seekVideo(
          resource,
          clip.sourceStart + Math.max(0, sampleTime - clip.timelineStart) * clip.speed,
        );
      }
      drawMedia(context, resource, clip, asset, resolveClipState(clip, sampleTime), alpha, wipeProgress);
    };

    for (const clip of active) {
      if (rendered.has(clip.id)) continue;
      const transition = transitionByFromId.get(clip.id);
      const toClip = transition
        ? this.project.clips.find((candidate) => candidate.id === transition.toClipId)
        : undefined;
      if (
        transition &&
        toClip &&
        !rendered.has(toClip.id) &&
        time >= toClip.timelineStart - transition.duration &&
        time < toClip.timelineStart
      ) {
        const progress = Math.max(
          0,
          Math.min(1, (time - (toClip.timelineStart - transition.duration)) / transition.duration),
        );
        const eased = transition.easing === "linear" ? progress : progress * progress * (3 - 2 * progress);
        await renderClip(clip, time, 1 - eased);
        await renderClip(
          toClip,
          toClip.timelineStart + eased * Math.min(transition.duration, toClip.duration),
          eased,
          transition.type === "wipe-left" || transition.type === "wipe-right"
            ? eased
            : undefined,
        );
        rendered.add(clip.id);
        rendered.add(toClip.id);
        continue;
      }
      await renderClip(clip, time);
      rendered.add(clip.id);
    }
  }

  dispose(): void {
    for (const resource of this.resources.values()) {
      if (resource instanceof HTMLVideoElement) {
        resource.pause();
        resource.removeAttribute("src");
        resource.load();
      }
    }
    this.resources.clear();
  }
}
