"use client";

import { useRef, useState } from "react";
import {
  FileAudio,
  FileImage,
  FileVideo,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/store/editor-store";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; name?: unknown };
    const message =
      typeof candidate.message === "string" ? candidate.message : "";
    const name = typeof candidate.name === "string" ? candidate.name : "";
    if (message || name) {
      return [name, message].filter(Boolean).join(": ");
    }
  }
  return "Import failed";
}

export function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assets = useEditorStore((state) => state.project.assets);
  const assetUrls = useEditorStore((state) => state.assetUrls);
  const importFiles = useEditorStore((state) => state.importFiles);
  const setNotice = useEditorStore((state) => state.setNotice);
  const [importing, setImporting] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setImporting(true);
    try {
      await importFiles(Array.from(files));
    } catch (error) {
      setNotice(importErrorMessage(error));
    } finally {
      setImporting(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <aside className="panel left-panel" aria-label="Media library">
      <div className="panel-header">
        <h2 className="panel-title">Media</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Import media"
          title="Import media"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          onChange={(event) => void onFiles(event.target.files)}
        />
      </div>
      <div className="panel-scroll">
        {assets.length ? (
          <div className="asset-grid">
            {assets.map((asset) => {
              const url = assetUrls[asset.id];
              return (
                <button
                  type="button"
                  className="asset-card"
                  key={asset.id}
                  title={asset.name}
                  onDoubleClick={() =>
                    setNotice(`${asset.name} is already on the timeline`)
                  }
                >
                  <span className="asset-thumb">
                    {asset.kind === "image" && url ? (
                      // Object URLs are local user content and cannot use next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" />
                    ) : asset.kind === "video" && url ? (
                      <video src={url} muted preload="metadata" />
                    ) : asset.kind === "audio" ? (
                      <FileAudio size={26} aria-hidden="true" />
                    ) : asset.kind === "image" ? (
                      <FileImage size={26} aria-hidden="true" />
                    ) : (
                      <FileVideo size={26} aria-hidden="true" />
                    )}
                  </span>
                  <span className="asset-meta">
                    <span className="asset-name">{asset.name}</span>
                    <span className="asset-detail">
                      {asset.kind} {formatDuration(asset.duration)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <UploadSimple size={30} aria-hidden="true" />
              <strong>Bring in your first shot</strong>
              <p>Video, audio, and images stay in your browser.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => inputRef.current?.click()}
              >
                Import media
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
