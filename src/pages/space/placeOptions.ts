// The Space page's Place list: what a space can place. Presets and templates always; the stack and speaker open now;
// the signed-in user's saved stacks and speakers. Pure.
import type { SpeakerSpec, StackDesign } from "../../types";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { SPACE_TEXT } from "../../constants/space";
import { SPEAKER_TEMPLATE, SPEAKER_START_NAMES } from "../../constants/speakerStarts";
import { STACK_START_DESIGN_NAMES, STACK_START_NAMES } from "../../constants/stackPresets";
import { STACK_PRESETS, presetLayers } from "../stack/stackPresets";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../speaker/speakerTemplates";

/** What a Place choice puts in the space: a stack with its speakers, or a speaker alone. */
export type PlaceItem =
  | { kind: typeof SPACE_ITEM.stack; design: StackDesign }
  | { kind: typeof SPACE_ITEM.speaker; speaker: SpeakerSpec };

/** One choice of the Place list. `item` builds what it places when it is used, not when the list is made. */
export interface PlaceOption {
  id: string;
  name: string;
  /** the group it is listed under */
  group: string;
  item: () => PlaceItem;
}

/** What the list reads besides the presets and templates. */
export interface PlaceSources {
  /** the stack open now, and the speaker open now */
  openStack: StackDesign;
  openSpeaker: SpeakerSpec;
  /** the library's stacks (id, name, design) and speakers (id, name, spec); empty when signed out */
  savedStacks: readonly { id: string; name: string; design: StackDesign }[];
  savedSpeakers: readonly { id: string; name: string; spec: Omit<SpeakerSpec, "id" | "name"> }[];
}

/** A stack choice. */
const stackOption = (
  id: string,
  name: string,
  group: string,
  design: () => StackDesign,
): PlaceOption => ({
  id,
  name,
  group,
  item: () => ({ kind: SPACE_ITEM.stack, design: design() }),
});

/** A speaker choice. */
const speakerOption = (
  id: string,
  name: string,
  group: string,
  speaker: () => SpeakerSpec,
): PlaceOption => ({
  id,
  name,
  group,
  item: () => ({ kind: SPACE_ITEM.speaker, speaker: speaker() }),
});

/** The templates the list offers: all but the empty speaker (it has nothing to play). */
const PLACE_TEMPLATES = SPEAKER_TEMPLATES.filter((t) => t !== SPEAKER_TEMPLATE.empty);

/**
 * Everything the Place list offers, in order: every stack preset, every speaker template, the stack and speaker open
 * now (each only when it holds a member, or a driver), then the saved ones. A preset or template keeps its own id in the space, so
 * placing it again reuses its speakers.
 */
export function placeOptions(sources: PlaceSources): PlaceOption[] {
  const { openStack, openSpeaker, savedStacks, savedSpeakers } = sources;
  const groups = SPACE_TEXT.placeGroups;
  return [
    ...STACK_PRESETS.map((preset) =>
      stackOption(`stack-preset:${preset}`, STACK_START_NAMES[preset], groups.stackPresets, () => {
        const { stack, speakers } = presetLayers(preset, {
          id: preset,
          name: STACK_START_DESIGN_NAMES[preset],
        });
        return { stack, speakers };
      }),
    ),
    ...PLACE_TEMPLATES.map((template) =>
      speakerOption(
        `speaker-template:${template}`,
        SPEAKER_START_NAMES[template],
        groups.speakerTemplates,
        () => ({ ...templateSpeaker(template), id: template }),
      ),
    ),
    ...(openStack.stack.members.length
      ? [
          stackOption(
            "open-stack",
            SPACE_TEXT.openStack(openStack.stack.name),
            groups.open,
            () => openStack,
          ),
        ]
      : []),
    ...(openSpeaker.cabinet.chambers.some((c) => c.drivers.length)
      ? [
          speakerOption(
            "open-speaker",
            SPACE_TEXT.openSpeaker(openSpeaker.name),
            groups.open,
            () => openSpeaker,
          ),
        ]
      : []),
    ...savedStacks.map((s) =>
      stackOption(`saved-stack:${s.id}`, s.name, groups.savedStacks, () => ({
        ...s.design,
        stack: { ...s.design.stack, id: s.id },
      })),
    ),
    ...savedSpeakers.map((s) =>
      speakerOption(`saved-speaker:${s.id}`, s.name, groups.savedSpeakers, () => ({
        ...s.spec,
        id: s.id,
        name: s.name,
      })),
    ),
  ];
}
