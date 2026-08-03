import { projectSchema, type VibeProject } from "@/core/schema/project";
import { loadAssetBlob } from "@/core/storage/project-db";

interface ArchiveAsset {
  id: string;
  mimeType: string;
  bytes: string;
}

interface ProjectArchive {
  format: "vibe-cut-project";
  version: 1;
  exportedAt: number;
  project: VibeProject;
  assets: ArchiveAsset[];
}

function encodeBytes(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function decodeBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function createProjectArchive(project: VibeProject): Promise<Blob> {
  const assets = await Promise.all(
    project.assets.map(async (asset) => {
      const blob = await loadAssetBlob(asset.id);
      return blob
        ? { id: asset.id, mimeType: blob.type || asset.mimeType, bytes: encodeBytes(await blob.arrayBuffer()) }
        : null;
    }),
  );
  const archive: ProjectArchive = {
    format: "vibe-cut-project",
    version: 1,
    exportedAt: Date.now(),
    project: projectSchema.parse(project),
    assets: assets.filter((asset): asset is ArchiveAsset => Boolean(asset)),
  };
  return new Blob([JSON.stringify(archive)], { type: "application/vnd.vibe-cut+json" });
}

export async function readProjectArchive(file: File): Promise<{
  project: VibeProject;
  assets: Array<{ id: string; blob: Blob }>;
}> {
  const parsed = JSON.parse(await file.text()) as Partial<ProjectArchive>;
  if (parsed.format !== "vibe-cut-project" || parsed.version !== 1 || !parsed.project || !Array.isArray(parsed.assets)) {
    throw new Error("This is not a Vibe Cut project archive.");
  }
  const project = projectSchema.parse(parsed.project);
  return {
    project,
    assets: parsed.assets.map((asset) => ({
      id: asset.id,
      blob: new Blob([decodeBytes(asset.bytes)], { type: asset.mimeType }),
    })),
  };
}
