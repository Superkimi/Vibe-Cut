import type {
  MediaClip,
  TextClip,
  VibeAsset,
  VibeProject,
} from "@/core/schema/project";

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
): void {
  const sourceWidth = asset.width ?? clip.transform.width;
  const sourceHeight = asset.height ?? clip.transform.height;
  const boxWidth = clip.transform.width;
  const boxHeight = clip.transform.height;
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
    clip.transform.x + boxWidth / 2,
    clip.transform.y + boxHeight / 2,
  );
  context.rotate((clip.transform.rotation * Math.PI) / 180);
  context.scale(clip.transform.scaleX, clip.transform.scaleY);
  context.globalAlpha = clip.opacity;
  context.filter = [
    `brightness(${1 + clip.adjustments.brightness})`,
    `contrast(${1 + clip.adjustments.contrast})`,
    `saturate(${1 + clip.adjustments.saturation})`,
    `blur(${clip.adjustments.blur}px)`,
  ].join(" ");
  context.beginPath();
  context.rect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
  context.clip();
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  context.restore();
}

function drawText(
  context: CanvasRenderingContext2D,
  clip: TextClip,
): void {
  const { transform, style } = clip;
  context.save();
  context.translate(
    transform.x + transform.width / 2,
    transform.y + transform.height / 2,
  );
  context.rotate((transform.rotation * Math.PI) / 180);
  context.globalAlpha = clip.opacity;
  context.fillStyle = style.backgroundColor;
  context.fillRect(
    -transform.width / 2,
    -transform.height / 2,
    transform.width,
    transform.height,
  );
  context.fillStyle = style.color;
  context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}, sans-serif`;
  context.textAlign = style.align;
  context.textBaseline = "middle";
  const x =
    style.align === "left"
      ? -transform.width / 2
      : style.align === "right"
        ? transform.width / 2
        : 0;
  const lines = clip.text.split("\n");
  const lineHeight = style.fontSize * 1.12;
  const totalHeight = (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
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
        return bOrder - aOrder;
      });

    for (const clip of active) {
      if (clip.type === "text") {
        drawText(context, clip);
        continue;
      }
      const resource = this.resources.get(clip.assetId);
      const asset = this.project.assets.find(
        (candidate) => candidate.id === clip.assetId,
      );
      if (!resource || !asset) {
        continue;
      }
      if (resource instanceof HTMLVideoElement) {
        await seekVideo(
          resource,
          clip.sourceStart + (time - clip.timelineStart) * clip.speed,
        );
      }
      drawMedia(context, resource, clip, asset);
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
