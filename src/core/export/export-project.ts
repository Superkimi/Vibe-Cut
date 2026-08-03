import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import type { MediaClip, VibeProject } from "@/core/schema/project";
import { ProjectFrameRenderer } from "@/core/render/frame-renderer";

export interface ExportProgress {
  phase: "prepare" | "audio" | "video" | "finalize";
  progress: number;
}

export interface ExportProjectOptions {
  project: VibeProject;
  assetUrls: Record<string, string>;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Export cancelled.", "AbortError");
}

async function mixAudio(
  project: VibeProject,
  assetUrls: Record<string, string>,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  const clips = project.clips.filter(
    (clip): clip is MediaClip =>
      clip.type === "media" &&
      clip.enabled &&
      project.assets.some(
        (asset) =>
          asset.id === clip.assetId &&
          (asset.kind === "audio" || asset.kind === "video"),
      ) &&
      !project.tracks.find((track) => track.id === clip.trackId)?.muted,
  );
  if (!clips.length || project.settings.duration <= 0) {
    return null;
  }

  const sampleRate = 48_000;
  const frameCount = Math.ceil(project.settings.duration * sampleRate);
  const context = new OfflineAudioContext(2, frameCount, sampleRate);
  const decoded = new Map<string, AudioBuffer>();

  for (const [index, clip] of clips.entries()) {
    throwIfAborted(signal);
    const url = assetUrls[clip.assetId];
    if (!url) {
      continue;
    }
    let buffer = decoded.get(clip.assetId);
    if (!buffer) {
      const data = await fetch(url).then((response) => response.arrayBuffer());
      try {
        buffer = await context.decodeAudioData(data.slice(0));
        decoded.set(clip.assetId, buffer);
      } catch {
        continue;
      }
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = clip.speed;
    source.connect(gain);
    gain.connect(context.destination);
    const start = clip.timelineStart;
    const end = start + clip.duration;
    gain.gain.setValueAtTime(clip.volume, start);
    if (clip.fadeIn > 0) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        clip.volume,
        Math.min(end, start + clip.fadeIn),
      );
    }
    if (clip.fadeOut > 0) {
      gain.gain.setValueAtTime(
        clip.volume,
        Math.max(start, end - clip.fadeOut),
      );
      gain.gain.linearRampToValueAtTime(0, end);
    }
    source.start(start, clip.sourceStart, clip.duration * clip.speed);
    source.stop(end);
    onProgress?.({
      phase: "audio",
      progress: (index + 1) / clips.length,
    });
  }
  return context.startRendering();
}

export async function exportProject({
  project,
  assetUrls,
  onProgress,
  signal,
}: ExportProjectOptions): Promise<{ blob: Blob; extension: "mp4" | "webm" }> {
  if (project.settings.duration <= 0) {
    throw new Error("Add at least one clip before exporting.");
  }
  throwIfAborted(signal);
  const width = project.settings.width;
  const height = project.settings.height;
  const fps = project.settings.fps;
  const supportsAvc = await canEncodeVideo("avc", {
    width,
    height,
    bitrate: QUALITY_HIGH,
  });
  const videoCodec = supportsAvc ? "avc" : "vp9";
  if (
    !supportsAvc &&
    !(await canEncodeVideo("vp9", { width, height, bitrate: QUALITY_HIGH }))
  ) {
    throw new Error(
      "This browser cannot encode H.264 or VP9. Use a current Chromium or Safari browser.",
    );
  }
  const audioCodec = supportsAvc ? "aac" : "opus";
  const supportsAudio = await canEncodeAudio(audioCodec, {
    numberOfChannels: 2,
    sampleRate: 48_000,
    bitrate: QUALITY_MEDIUM,
  });

  onProgress?.({ phase: "prepare", progress: 0 });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new ProjectFrameRenderer(project, assetUrls);
  await renderer.prepare();
  const target = new BufferTarget();
  const output = new Output({
    format: supportsAvc
      ? new Mp4OutputFormat({ fastStart: "in-memory" })
      : new WebMOutputFormat(),
    target,
  });
  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
    latencyMode: "quality",
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const mixedAudio = supportsAudio
    ? await mixAudio(project, assetUrls, onProgress, signal)
    : null;
  const audioSource = mixedAudio
    ? new AudioBufferSource({
        codec: audioCodec,
        bitrate: QUALITY_MEDIUM,
      })
    : null;
  if (audioSource) {
    output.addAudioTrack(audioSource);
  }

  try {
    await output.start();
    if (audioSource && mixedAudio) {
      await audioSource.add(mixedAudio);
    }
    const frameDuration = 1 / fps;
    const frameCount = Math.ceil(project.settings.duration * fps);
    for (let frame = 0; frame < frameCount; frame += 1) {
      throwIfAborted(signal);
      const time = frame * frameDuration;
      await renderer.render(canvas, time);
      await videoSource.add(time, frameDuration, {
        keyFrame: frame % (fps * 2) === 0,
      });
      if (frame % Math.max(1, Math.floor(fps / 4)) === 0) {
        onProgress?.({
          phase: "video",
          progress: (frame + 1) / frameCount,
        });
      }
    }
    onProgress?.({ phase: "finalize", progress: 0.96 });
    await output.finalize();
    if (!target.buffer) {
      throw new Error("The encoder produced no output.");
    }
    const extension = supportsAvc ? "mp4" : "webm";
    return {
      blob: new Blob([target.buffer], {
        type: supportsAvc ? "video/mp4" : "video/webm",
      }),
      extension,
    };
  } catch (error) {
    if (output.state === "started") {
      await output.cancel().catch(() => undefined);
    }
    throw error;
  } finally {
    renderer.dispose();
  }
}
