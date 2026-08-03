"use client";

import { useId } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { EditOperation } from "@/core/schema/edit-plan";
import type { VibeClip } from "@/core/schema/project";
import { useI18n } from "@/i18n";

function NumericField({
  label,
  value,
  step = "0.1",
  onCommit,
}: {
  label: string;
  value: number;
  step?: string;
  onCommit: (value: number) => void;
}) {
  const inputId = useId();

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className="number-input"
        type="number"
        step={step}
        defaultValue={Number(value.toFixed(3))}
        key={`${label}-${value}`}
        onBlur={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next) && next !== value) {
            onCommit(next);
          }
        }}
      />
    </div>
  );
}

function ClipInspector({ clip }: { clip: VibeClip }) {
  const commitOperations = useEditorStore((state) => state.commitOperations);
  const { t } = useI18n();
  const patch = (next: Extract<EditOperation, { op: "updateClip" }>["patch"]) =>
    commitOperations(t("edit.update", { name: clip.name }), [
      { op: "updateClip", clipId: clip.id, patch: next },
    ]);

  return (
    <div className="inspector">
      <section className="inspector-section">
        <h2 className="section-heading">{t("inspector.clip")}</h2>
        <div className="field-grid">
          <div className="field full">
            <label htmlFor="clip-name">{t("inspector.name")}</label>
            <input
              id="clip-name"
              className="text-input"
              defaultValue={clip.name}
              key={clip.name}
              onBlur={(event) => {
                const name = event.currentTarget.value.trim();
                if (name && name !== clip.name) {
                  patch({ name });
                }
              }}
            />
          </div>
          <NumericField
            label={t("inspector.start")}
            value={clip.timelineStart}
            onCommit={(timelineStart) => patch({ timelineStart })}
          />
          <NumericField
            label={t("inspector.duration")}
            value={clip.duration}
            onCommit={(duration) => patch({ duration: Math.max(0.05, duration) })}
          />
          <NumericField
            label={t("inspector.speed")}
            value={clip.speed}
            onCommit={(speed) => patch({ speed: Math.max(0.1, speed) })}
          />
          <NumericField
            label={t("inspector.opacity")}
            value={clip.opacity}
            step="0.01"
            onCommit={(opacity) =>
              patch({ opacity: Math.max(0, Math.min(1, opacity)) })
            }
          />
        </div>
      </section>
      <section className="inspector-section">
        <h2 className="section-heading">{t("inspector.transform")}</h2>
        <div className="field-grid">
          <NumericField
            label={t("inspector.x")}
            value={clip.transform.x}
            step="1"
            onCommit={(x) => patch({ transform: { x } })}
          />
          <NumericField
            label={t("inspector.y")}
            value={clip.transform.y}
            step="1"
            onCommit={(y) => patch({ transform: { y } })}
          />
          <NumericField
            label={t("inspector.width")}
            value={clip.transform.width}
            step="1"
            onCommit={(width) =>
              patch({ transform: { width: Math.max(1, width) } })
            }
          />
          <NumericField
            label={t("inspector.height")}
            value={clip.transform.height}
            step="1"
            onCommit={(height) =>
              patch({ transform: { height: Math.max(1, height) } })
            }
          />
          <NumericField
            label={t("inspector.rotation")}
            value={clip.transform.rotation}
            step="1"
            onCommit={(rotation) => patch({ transform: { rotation } })}
          />
        </div>
      </section>
      {clip.type === "text" ? (
        <section className="inspector-section">
          <h2 className="section-heading">{t("inspector.text")}</h2>
          <div className="field">
            <label htmlFor="clip-text">{t("inspector.content")}</label>
            <textarea
              id="clip-text"
              className="text-area"
              defaultValue={clip.text}
              key={clip.text}
              onBlur={(event) => {
                if (event.currentTarget.value !== clip.text) {
                  patch({ text: event.currentTarget.value });
                }
              }}
            />
          </div>
        </section>
      ) : (
        <section className="inspector-section">
          <h2 className="section-heading">{t("inspector.picture")}</h2>
          <div className="field">
            <label htmlFor="brightness">{t("inspector.brightness")}</label>
            <input
              id="brightness"
              className="range-input"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={clip.adjustments.brightness}
              onChange={(event) =>
                patch({
                  adjustments: { brightness: Number(event.currentTarget.value) },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="saturation">{t("inspector.saturation")}</label>
            <input
              id="saturation"
              className="range-input"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={clip.adjustments.saturation}
              onChange={(event) =>
                patch({
                  adjustments: { saturation: Number(event.currentTarget.value) },
                })
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

function CanvasInspector() {
  const project = useEditorStore((state) => state.project);
  const commitOperations = useEditorStore((state) => state.commitOperations);
  const { t } = useI18n();
  const setCanvas = (patch: Omit<Extract<EditOperation, { op: "setCanvas" }>, "op">) =>
    commitOperations(t("edit.canvas"), [{ op: "setCanvas", ...patch }]);

  return (
    <div className="inspector">
      <section className="inspector-section">
        <h2 className="section-heading">{t("inspector.canvas")}</h2>
        <div className="field-grid">
          <NumericField
            label={t("inspector.width")}
            value={project.settings.width}
            step="1"
            onCommit={(width) => setCanvas({ width: Math.round(width) })}
          />
          <NumericField
            label={t("inspector.height")}
            value={project.settings.height}
            step="1"
            onCommit={(height) => setCanvas({ height: Math.round(height) })}
          />
          <div className="field">
            <label htmlFor="canvas-fps">{t("inspector.frameRate")}</label>
            <select
              id="canvas-fps"
              className="select-input"
              value={project.settings.fps}
              onChange={(event) =>
                setCanvas({
                  fps: Number(event.currentTarget.value) as 24 | 25 | 30 | 50 | 60,
                })
              }
            >
              {[24, 25, 30, 50, 60].map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="canvas-background">{t("inspector.background")}</label>
            <input
              id="canvas-background"
              className="text-input"
              type="color"
              value={project.settings.background}
              onChange={(event) =>
                setCanvas({ background: event.currentTarget.value })
              }
            />
          </div>
        </div>
      </section>
      <section className="inspector-section">
        <h2 className="section-heading">{t("inspector.presets")}</h2>
        <div className="ai-suggestions">
          {[
            [t("inspector.youtube"), 1920, 1080],
            [t("inspector.shorts"), 1080, 1920],
            [t("inspector.square"), 1080, 1080],
            [t("inspector.portrait"), 1080, 1350],
          ].map(([label, width, height]) => (
            <button
              type="button"
              className="suggestion"
              key={String(label)}
              onClick={() =>
                setCanvas({ width: Number(width), height: Number(height) })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Inspector() {
  const project = useEditorStore((state) => state.project);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const clip =
    selectedClipIds.length === 1
      ? project.clips.find((candidate) => candidate.id === selectedClipIds[0])
      : null;
  return clip ? <ClipInspector clip={clip} /> : <CanvasInspector />;
}
