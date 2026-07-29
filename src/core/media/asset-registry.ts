import { loadAssetBlob, saveAssetBlob } from "@/core/storage/project-db";

const urls = new Map<string, string>();

function replaceUrl(assetId: string, blob: Blob): string {
  const previous = urls.get(assetId);
  if (previous) {
    URL.revokeObjectURL(previous);
  }
  const url = URL.createObjectURL(blob);
  urls.set(assetId, url);
  return url;
}

export async function registerAssetFile(
  assetId: string,
  blob: Blob,
): Promise<string> {
  await saveAssetBlob(assetId, blob);
  return replaceUrl(assetId, blob);
}

export async function getAssetUrl(assetId: string): Promise<string | null> {
  const existing = urls.get(assetId);
  if (existing) {
    return existing;
  }
  const blob = await loadAssetBlob(assetId);
  return blob ? replaceUrl(assetId, blob) : null;
}

export function peekAssetUrl(assetId: string): string | null {
  return urls.get(assetId) ?? null;
}

export function releaseAssetUrls(): void {
  for (const url of urls.values()) {
    URL.revokeObjectURL(url);
  }
  urls.clear();
}
