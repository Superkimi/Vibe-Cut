"use client";

import { useEffect, useRef } from "react";
import { MediaPanel } from "./MediaPanel";
import { PreviewStage } from "./PreviewStage";
import { RightPanel } from "./RightPanel";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { useEditorStore } from "@/store/editor-store";
import { usePlaybackClock } from "./usePlaybackClock";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { ExportDialog } from "./ExportDialog";
import { useI18n } from "@/i18n";

export function EditorShell() {
  const initialize = useEditorStore((state) => state.initialize);
  const ready = useEditorStore((state) => state.ready);
  const notice = useEditorStore((state) => state.notice);
  const setNotice = useEditorStore((state) => state.setNotice);
  const { t } = useI18n();
  const initialized = useRef(false);

  usePlaybackClock();
  useEditorShortcuts();

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void initialize();
    }
  }, [initialize]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 3_200);
    return () => window.clearTimeout(timeout);
  }, [notice, setNotice]);

  if (!ready) {
    return (
      <main className="loading-shell" aria-label={t("app.loading")}>
        <div className="loading-block" aria-hidden="true" />
      </main>
    );
  }

  return (
    <main className="editor-shell">
      <TopBar />
      <section className="workspace" aria-label={t("app.workspace")}>
        <MediaPanel />
        <PreviewStage />
        <RightPanel />
      </section>
      <Timeline />
      <ExportDialog />
      {notice ? (
        <div className="notice" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </main>
  );
}
