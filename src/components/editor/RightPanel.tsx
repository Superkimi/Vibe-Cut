"use client";

import { useState } from "react";
import { AiPanel } from "./ai/AiPanel";
import { Inspector } from "./Inspector";
import { useI18n } from "@/i18n";

export function RightPanel() {
  const [tab, setTab] = useState<"vibe" | "inspector">("vibe");
  const { t } = useI18n();
  return (
    <aside className="panel right-panel" aria-label={t("panel.editingControls")}>
      <div className="right-tabs" role="tablist" aria-label={t("panel.editingControls")}>
        <button
          type="button"
          className="right-tab"
          role="tab"
          aria-selected={tab === "vibe"}
          onClick={() => setTab("vibe")}
        >
          {t("panel.vibe")}
        </button>
        <button
          type="button"
          className="right-tab"
          role="tab"
          aria-selected={tab === "inspector"}
          onClick={() => setTab("inspector")}
        >
          {t("panel.inspector")}
        </button>
      </div>
      <div className="right-content">
        {tab === "vibe" ? <AiPanel /> : <Inspector />}
      </div>
    </aside>
  );
}
