"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";

export function usePlaybackClock() {
  const playing = useEditorStore((state) => state.playing);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const startedAt = performance.now();
    const startTime = useEditorStore.getState().currentTime;
    let previousPaint = 0;

    const tick = (now: number) => {
      const state = useEditorStore.getState();
      const next = startTime + (now - startedAt) / 1_000;
      if (next >= state.project.settings.duration) {
        setCurrentTime(state.project.settings.duration);
        setPlaying(false);
        return;
      }
      if (now - previousPaint >= 1000 / state.project.settings.fps) {
        setCurrentTime(next);
        previousPaint = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [playing, setCurrentTime, setPlaying]);
}
