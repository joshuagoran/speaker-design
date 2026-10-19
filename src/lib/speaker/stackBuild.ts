// A stack's cutlist: every member's speaker built as the Speaker page builds it (lib/speaker/speakerBuild), each part
// under its stack box ("Box 2, chamber 1"), so the Cutlist page packs every member's parts on the same sheets. Two members of one speaker build two speakers. Pure.
import type {
  CornerJoint,
  CutPart,
  PanelExactIn,
  PurchasedPart,
  SpeakerCabinet,
  SpeakerSpec,
  StackSpec,
} from "../../types";
import { speakerCutParts, speakerPurchasedParts } from "./speakerBuild";
import { withMeasuredWalls } from "./cabinetPanels";
import { isSpeakerCutBox, memberCutBox } from "../../constants/cutParts";

/** A member's speaker, its walls at their measured thickness where the cutlist has one for their size. */
const measured = (cabinet: SpeakerCabinet, exactIn: PanelExactIn) => {
  const t = exactIn[cabinet.panel.nominal];
  return t === undefined ? cabinet : withMeasuredWalls(cabinet, t);
};

/** The members that have their speaker, numbered from 1 by their place in the stack. */
const builtMembers = (stack: Pick<StackSpec, "members">, speakers: readonly SpeakerSpec[]) =>
  stack.members.flatMap((m, k) => {
    const speaker = speakers.find((s) => s.id === m.speakerId);
    return speaker ? [{ n: k + 1, speaker }] : [];
  });

/**
 * The stack's cut parts, each under its member's box, and the lines under the list (each member's vent parts and
 * hardware, with its member's name).
 */
export function stackCutParts(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
  joint: CornerJoint,
  exactIn: PanelExactIn,
): { parts: CutPart[]; also: string[] } {
  const parts: CutPart[] = [];
  const also: string[] = [];
  for (const { n, speaker } of builtMembers(stack, speakers)) {
    const own = speakerCutParts(measured(speaker.cabinet, exactIn), joint);
    // a speaker's parts carry its own boxes (never a member's)
    for (const p of own.parts)
      if (isSpeakerCutBox(p.box)) parts.push({ ...p, box: memberCutBox(n, p.box) });
    for (const line of own.vent) also.push(`${speaker.name} (box ${n}): ${line}`);
  }
  return { parts, also };
}

/** The stack's bought parts: every member's, the same part in more than one member one row. */
export function stackPurchasedParts(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
): PurchasedPart[] {
  const rows: PurchasedPart[] = [];
  for (const { speaker } of builtMembers(stack, speakers))
    for (const row of speakerPurchasedParts(speaker.cabinet)) {
      const same = rows.find(
        (r) => r.kind === row.kind && r.model === row.model && r.unit === row.unit,
      );
      if (same) same.count += row.count;
      else rows.push({ ...row });
    }
  return rows;
}
