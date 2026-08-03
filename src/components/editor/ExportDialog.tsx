"use client";

import { useEffect, useState } from "react";
import { CheckCircle, DownloadSimple, SpinnerGap, X } from "@phosphor-icons/react";
import { exportProject, type ExportProgress } from "@/core/export/export-project";
import { useEditorStore } from "@/store/editor-store";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";

function phaseLabel(
  progress: ExportProgress | null,
  t: (key: TranslationKey) => string,
): string {
  switch (progress?.phase) {
    case "prepare":
      return t("export.preparing");
    case "audio":
      return t("export.mixing");
    case "video":
      return t("export.rendering");
    case "finalize":
      return t("export.finalizing");
    default:
      return t("export.ready");
  }
}

export function ExportDialog() {
  const project = useEditorStore((state) => state.project);
  const assetUrls = useEditorStore((state) => state.assetUrls);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setProgress(null);
      setError(null);
      setDone(false);
    };
    window.addEventListener("vibecut:export", show);
    return () => window.removeEventListener("vibecut:export", show);
  }, []);

  if (!open) {
    return null;
  }

  const runExport = async () => {
    setError(null);
    setDone(false);
    setProgress({ phase: "prepare", progress: 0 });
    try {
      const result = await exportProject({
        project,
        assetUrls,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/[^a-zA-Z0-9-_]+/g, "-") || "vibe-cut"}.${result.extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
      setProgress({ phase: "finalize", progress: 1 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("error.exportFailed"));
      setProgress(null);
    }
  };

  const busy = progress !== null && progress.progress < 1 && !error;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <header className="dialog-header">
          <div>
            <h2 id="export-title">{t("export.title")}</h2>
            <p>
              {project.settings.width} x {project.settings.height},{" "}
              {project.settings.fps} fps
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("export.closeDialog")}
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="export-status" aria-live="polite">
          {done ? (
            <CheckCircle size={28} weight="fill" aria-hidden="true" />
          ) : busy ? (
            <SpinnerGap size={28} className="spin" aria-hidden="true" />
          ) : (
            <DownloadSimple size={28} aria-hidden="true" />
          )}
          <strong>{done ? t("export.downloaded") : phaseLabel(progress, t)}</strong>
          <p>{error ?? t("export.localNote")}</p>
          {progress ? (
            <progress
              className="export-progress"
              max="1"
              value={progress.progress}
            >
              {Math.round(progress.progress * 100)}%
            </progress>
          ) : null}
        </div>
        <footer className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            {t("action.close")}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void runExport()}
          >
            <DownloadSimple size={16} aria-hidden="true" />
            {done ? t("action.exportAgain") : t("action.export")}
          </button>
        </footer>
      </section>
    </div>
  );
}
