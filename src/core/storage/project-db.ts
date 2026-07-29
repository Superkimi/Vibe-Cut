import { projectSchema, type VibeProject } from "@/core/schema/project";

const DB_NAME = "vibe-cut";
const DB_VERSION = 1;
const PROJECTS = "projects";
const ASSETS = "assets";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS)) {
        database.createObjectStore(PROJECTS, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ASSETS)) {
        database.createObjectStore(ASSETS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function saveProject(project: VibeProject): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECTS, "readwrite");
    transaction.objectStore(PROJECTS).put(projectSchema.parse(project));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Project save failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Project save was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function loadLatestProject(): Promise<VibeProject | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECTS, "readonly");
    const projects = await requestResult(
      transaction.objectStore(PROJECTS).getAll(),
    );
    if (!projects.length) {
      return null;
    }
    const latest = [...projects].sort(
      (a, b) =>
        Number((b as VibeProject).updatedAt) -
        Number((a as VibeProject).updatedAt),
    )[0];
    return projectSchema.parse(latest);
  } finally {
    database.close();
  }
}

export async function saveAssetBlob(assetId: string, blob: Blob): Promise<void> {
  const bytes = await blob.arrayBuffer();
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ASSETS, "readwrite");
    // ArrayBuffer is consistently structured-cloneable in Chromium/WebKit.
    // Persisting File/Blob objects directly is unreliable in WebKit automation
    // and in some private-browsing configurations.
    transaction.objectStore(ASSETS).put({
      id: assetId,
      bytes,
      mimeType: blob.type,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Media save failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Media save was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function loadAssetBlob(assetId: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ASSETS, "readonly");
    const result = await requestResult(
      transaction.objectStore(ASSETS).get(assetId),
    );
    if (result?.blob instanceof Blob) {
      return result.blob;
    }
    if (result?.bytes instanceof ArrayBuffer) {
      return new Blob([result.bytes], {
        type:
          typeof result.mimeType === "string"
            ? result.mimeType
            : "application/octet-stream",
      });
    }
    return null;
  } finally {
    database.close();
  }
}
