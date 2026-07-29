"use client";

import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Export,
  FilmStrip,
  GearSix,
} from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { useEditorStore } from "@/store/editor-store";

export function TopBar() {
  const project = useEditorStore((state) => state.project);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setNotice = useEditorStore((state) => state.setNotice);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <FilmStrip size={17} weight="fill" />
        </span>
        <span>Vibe Cut</span>
        <span className="project-name">{project.name}</span>
      </div>
      <div className="transport" aria-label="History controls">
        <IconButton
          icon={ArrowCounterClockwise}
          label="Undo"
          disabled={!past.length}
          onClick={undo}
        />
        <IconButton
          icon={ArrowClockwise}
          label="Redo"
          disabled={!future.length}
          onClick={redo}
        />
      </div>
      <div className="topbar-actions">
        <IconButton
          icon={GearSix}
          label="Project settings"
          onClick={() => setNotice("Project settings are available in Inspector")}
        />
        <button
          type="button"
          className="primary-button"
          onClick={() => window.dispatchEvent(new CustomEvent("vibecut:export"))}
        >
          <Export size={16} aria-hidden="true" />
          Export
        </button>
      </div>
    </header>
  );
}
