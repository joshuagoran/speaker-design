// A stack's members in the 3D view: each member's speaker as the Speaker page draws it (buildSpeakerScene), stood where
// the stack places it (lib/speaker/stackLayout): mirrored with it, tilted by its cabinet's kick-back and its tilt in the
// stack about its bottom front edge, as the Stack page's front drawing and the stack model take it.
import * as THREE from "three";
import { buildSpeakerScene, speakerSceneKey } from "./buildSpeakerScene";
import { memberPitch, stackLayout } from "../../lib/speaker/stackLayout";
import type { SpeakerSpec, StackSpec } from "../../types";

/** What the scene draws: the stack's members, their speakers, and the view's cutaway. */
export interface MembersSceneProps {
  stack: Pick<StackSpec, "members">;
  speakers: readonly SpeakerSpec[];
  cutaway: boolean;
}

/** The group each member is drawn in, so a check can find where the scene put it. */
export const MEMBER_GROUP_NAME = "stackMember";

/** What the scene reads, as a key that changes exactly when the scene does: each member's pose and speaker's scene. */
export function membersSceneKey({ stack, speakers, cutaway }: MembersSceneProps): string {
  return JSON.stringify(
    stack.members.map((m) => {
      const speaker = speakers.find((s) => s.id === m.speakerId);
      return {
        pose: m.pose,
        mirror: m.mirror,
        speaker: speaker ? speakerSceneKey({ spec: speaker, cutaway }) : null,
        tilt: speaker?.cabinet.tiltDeg ?? 0,
      };
    }),
  );
}

/** The members placed, in inches, the stack's base at y = 0 and its front at z = 0 (three's z: + toward the front). */
export function buildMembersScene({ stack, speakers, cutaway }: MembersSceneProps): THREE.Group {
  const root = new THREE.Group();
  stackLayout(stack, speakers).forEach((placed, k) => {
    const { speaker } = placed;
    if (!speaker) return;
    const member = stack.members[k];
    const box = buildSpeakerScene({ spec: speaker, cutaway });
    // the speaker's scene has its depth centered on z = 0: its front edge to the pivot
    box.position.z = -placed.size.d / 2;
    if (member.mirror) box.scale.x = -1;
    const pivot = new THREE.Group();
    pivot.name = MEMBER_GROUP_NAME;
    pivot.add(box);
    // + pitch raises the front (three's +z): a turn about x by −pitch
    pivot.rotation.x = -memberPitch(speaker, member);
    pivot.position.set(placed.at.x, placed.at.y, -placed.at.z);
    root.add(pivot);
  });
  return root;
}
