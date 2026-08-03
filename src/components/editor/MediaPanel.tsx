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
import { useI18n } from "@/i18n";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function importErrorMessage(error: unknown, fallback: string): string {
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
  return fallback;
}

export function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assets = useEditorStore((state) => state.project.assets);
  const assetUrls = useEditorStore((state) => state.assetUrls);
  const importFiles = useEditorStore((state) => state.importFiles);
  const setNotice = useEditorStore((state) => state.setNotice);
  const [importing, setImporting] = useState(false);
  const { t } = useI18n();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setImporting(true);
    try {
      await importFiles(Array.from(files));
    } catch (error) {
      setNotice(importErrorMessage(error, t("media.importFailed")));
    } finally {
      setImporting(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <aside className="panel left-panel" aria-label={t("media.library")}>
      <div className="panel-header">
        <h2 className="panel-title">{t("media.title")}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t("action.importMedia")}
          title={t("action.importMedia")}
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
              const kindLabel =
                asset.kind === "audio"
                  ? t("media.audio")
                  : asset.kind === "image"
                    ? t("media.image")
                    : t("media.video");
              return (
                <button
                  type="button"
                  className="asset-card"
                  key={asset.id}
                  title={asset.name}
                  onDoubleClick={() =>
                      setNotice(t("media.alreadyOnTimeline", { name: asset.name }))
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
                      {kindLabel} {formatDuration(asset.duration)}
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
              <strong>{t("media.firstShot")}</strong>
              <p>{t("media.localCopy")}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => inputRef.current?.click()}
              >
                {t("action.importMedia")}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
