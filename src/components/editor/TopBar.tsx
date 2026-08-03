"use client";

import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Export,
  DownloadSimple,
  FilmStrip,
  GearSix,
  UploadSimple,
} from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editor-store";
import { useI18n } from "@/i18n";

export function TopBar() {
  const project = useEditorStore((state) => state.project);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setNotice = useEditorStore((state) => state.setNotice);
  const exportProjectArchive = useEditorStore((state) => state.exportProjectArchive);
  const importProjectArchive = useEditorStore((state) => state.importProjectArchive);
  const { locale, setLocale, t } = useI18n();

  const downloadArchive = async () => {
    try {
      const blob = await exportProjectArchive();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/[^a-zA-Z0-9-_]+/g, "-") || "vibe-cut"}.vibecut`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice(t("notice.projectExported"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("error.projectExport"));
    }
  };

  const loadArchive = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importProjectArchive(file);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("error.projectImport"));
    }
  };

  const chooseArchive = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vibecut,application/vnd.vibe-cut+json,application/json";
    input.addEventListener("change", () => void loadArchive(input.files?.[0]), { once: true });
    input.click();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <FilmStrip size={17} weight="fill" />
        </span>
        <span>{t("brand.vibeCut")}</span>
        <span className="project-name">{project.name}</span>
      </div>
      <div className="transport" aria-label={t("history.controls")}>
        <IconButton
          icon={ArrowCounterClockwise}
          label={t("history.undo")}
          disabled={!past.length}
          onClick={undo}
        />
        <IconButton
          icon={ArrowClockwise}
          label={t("history.redo")}
          disabled={!future.length}
          onClick={redo}
        />
      </div>
      <div className="topbar-actions">
        <IconButton
          icon={UploadSimple}
          label={t("project.import")}
          onClick={chooseArchive}
        />
        <IconButton
          icon={DownloadSimple}
          label={t("project.export")}
          onClick={() => void downloadArchive()}
        />
        <IconButton
          icon={GearSix}
          label={t("project.settings")}
          onClick={() => setNotice(t("project.settingsNotice"))}
        />
        <div className="locale-toggle" role="group" aria-label={t("language.toggle")}>
          <button
            type="button"
            data-active={locale === "zh"}
            aria-pressed={locale === "zh"}
            onClick={() => setLocale("zh")}
          >
            {t("language.chinese")}
          </button>
          <button
            type="button"
            data-active={locale === "en"}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            {t("language.english")}
          </button>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.dispatchEvent(new CustomEvent("vibecut:export"))}
        >
          <Export size={16} aria-hidden="true" />
          {t("action.export")}
        </button>
      </div>
    </header>
  );
}
