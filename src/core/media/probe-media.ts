import type { VibeAsset } from "@/core/schema/project";
import { translate } from "@/i18n";

function waitForEvent(
  target: EventTarget,
  success: string,
  failure: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onFailure = () => {
      cleanup();
      reject(new Error(translate("error.decode")));
    };
    const cleanup = () => {
      target.removeEventListener(success, onSuccess);
      target.removeEventListener(failure, onFailure);
    };
    target.addEventListener(success, onSuccess, { once: true });
    target.addEventListener(failure, onFailure, { once: true });
  });
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = waitForEvent(image, "load", "error");
    image.src = url;
    await loaded;
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function mediaMetadata(
  file: File,
  kind: "video" | "audio",
): Promise<{ duration: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  try {
    const media = document.createElement(kind);
    media.preload = "metadata";
    const metadataLoaded = waitForEvent(media, "loadedmetadata", "error");
    media.src = url;
    await metadataLoaded;
    if (!Number.isFinite(media.duration)) {
      throw new Error(translate("error.duration"));
    }
    return {
      duration: media.duration,
      ...(kind === "video"
        ? {
            width: (media as HTMLVideoElement).videoWidth,
            height: (media as HTMLVideoElement).videoHeight,
          }
        : {}),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createWaveform(file: File, buckets = 192): Promise<number[] | undefined> {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    return undefined;
  }
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(channel.length / buckets));
    const waveform: number[] = [];
    for (let start = 0; start < channel.length; start += stride) {
      let peak = 0;
      const end = Math.min(channel.length, start + stride);
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(channel[index]));
      }
      waveform.push(Number(peak.toFixed(4)));
    }
    return waveform.slice(0, buckets);
  } catch {
    return undefined;
  } finally {
    await context.close();
  }
}

export async function probeMediaFile(
  file: File,
  id = crypto.randomUUID(),
): Promise<VibeAsset> {
  const mimeType = file.type || "application/octet-stream";
  const kind = mimeType.startsWith("video/")
    ? "video"
    : mimeType.startsWith("audio/")
      ? "audio"
      : mimeType.startsWith("image/")
        ? "image"
        : null;
  if (!kind) {
    throw new Error(translate("error.fileType"));
  }

  if (kind === "image") {
    const dimensions = await imageDimensions(file);
    return {
      id,
      name: file.name,
      kind,
      mimeType,
      size: file.size,
      duration: 5,
      createdAt: Date.now(),
      ...dimensions,
    };
  }

  const metadata = await mediaMetadata(file, kind);
  return {
    id,
    name: file.name,
    kind,
    mimeType,
    size: file.size,
    duration: metadata.duration,
    createdAt: Date.now(),
    ...(metadata.width ? { width: metadata.width } : {}),
    ...(metadata.height ? { height: metadata.height } : {}),
    ...(kind === "audio" || kind === "video"
      ? { waveform: await createWaveform(file) }
      : {}),
  };
}
