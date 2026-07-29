"use client";

import { useState } from "react";
import { AiPanel } from "./ai/AiPanel";
import { Inspector } from "./Inspector";

export function RightPanel() {
  const [tab, setTab] = useState<"vibe" | "inspector">("vibe");
  return (
    <aside className="panel right-panel" aria-label="Editing controls">
      <div className="right-tabs" role="tablist" aria-label="Editing controls">
        <button
          type="button"
          className="right-tab"
          role="tab"
          aria-selected={tab === "vibe"}
          onClick={() => setTab("vibe")}
        >
          Vibe
        </button>
        <button
          type="button"
          className="right-tab"
          role="tab"
          aria-selected={tab === "inspector"}
          onClick={() => setTab("inspector")}
        >
          Inspector
        </button>
      </div>
      <div className="right-content">
        {tab === "vibe" ? <AiPanel /> : <Inspector />}
      </div>
    </aside>
  );
}
