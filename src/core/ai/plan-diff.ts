import type { EditPlan, EditOperation } from "@/core/schema/edit-plan";
import type { VibeProject } from "@/core/schema/project";

export interface PlanDiff {
  additions: string[];
  removals: string[];
  updates: string[];
  risks: string[];
}

function clipName(project: VibeProject, id: string): string {
  return project.clips.find((clip) => clip.id === id)?.name ?? id;
}

export function describePlanDiff(project: VibeProject, plan: EditPlan): PlanDiff {
  const diff: PlanDiff = { additions: [], removals: [], updates: [], risks: [] };
  for (const operation of plan.operations as EditOperation[]) {
    switch (operation.op) {
      case "addMedia":
        diff.additions.push(`Add media “${operation.clip.name}”`);
        break;
      case "addText":
        diff.additions.push(`Add ${operation.clip.role ?? "text"} “${operation.clip.text.slice(0, 32)}”`);
        break;
      case "addTrack":
        diff.additions.push(`Add track “${operation.track.name}”`);
        break;
      case "addTransition":
        diff.additions.push(`Add ${operation.transition.type} transition`);
        break;
      case "duplicateClip":
        diff.additions.push(`Duplicate “${clipName(project, operation.clipId)}”`);
        break;
      case "removeClip":
        diff.removals.push(`Remove “${clipName(project, operation.clipId)}”`);
        break;
      case "removeTrack":
        diff.removals.push(`Remove track ${operation.trackId}`);
        if (operation.removeClips) diff.risks.push("This also removes every clip on that track.");
        break;
      case "removeTransition":
        diff.removals.push(`Remove transition ${operation.transitionId}`);
        break;
      case "moveClip":
        diff.updates.push(`Move “${clipName(project, operation.clipId)}” to ${operation.timelineStart.toFixed(2)}s`);
        break;
      case "trimClip":
        diff.updates.push(`Trim ${operation.side} of “${clipName(project, operation.clipId)}”`);
        break;
      case "splitClip":
        diff.updates.push(`Split “${clipName(project, operation.clipId)}” at ${operation.time.toFixed(2)}s`);
        break;
      case "updateClip":
        diff.updates.push(`Update “${clipName(project, operation.clipId)}”`);
        if (operation.patch.keyframes?.length) diff.updates.push("Add keyframe animation");
        break;
      case "updateTransition":
        diff.updates.push(`Update transition ${operation.transitionId}`);
        break;
      case "setCanvas":
        diff.updates.push("Change canvas settings");
        break;
      case "addAsset":
        diff.additions.push(`Register asset “${operation.asset.name}”`);
        break;
      case "addMarker":
        diff.updates.push(`Add marker “${operation.label}”`);
        break;
    }
  }
  if (diff.removals.length >= 2) diff.risks.push("Several existing items will be removed; review before applying.");
  if (plan.warnings.length) diff.risks.push(...plan.warnings);
  return diff;
}
