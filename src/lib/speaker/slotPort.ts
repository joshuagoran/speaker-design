// A slot's settings as the Speaker page changes them: its kind and its position keep what they can. Pure.
import type { SlotPlace, SpeakerSlotPort } from "../../types";
import { PA_SLOT_FINS, PORT_SHAPE, SLOT_KIND, SLOT_PLACE } from "../../constants/speakerSpec";

/**
 * The slot as another kind: a divided slot (fins, one slot) or an open slot (stacked, its fold). The
 * sizes the kinds share (narrow side, length) and the position stay; the rest is the new kind's own.
 */
export function withSlotKind(port: SpeakerSlotPort, kind: keyof typeof SLOT_KIND): SpeakerSlotPort {
  const { h, len, place } = port;
  const base: SpeakerSlotPort = {
    shape: PORT_SHAPE.slot,
    n: 1,
    h,
    len,
    ...(place ? { place } : {}),
  };
  return kind === SLOT_KIND.letterbox ? { ...base, fins: port.fins ?? PA_SLOT_FINS } : base;
}

/** The slot at a position: along the floor (no `place`) or up the front sides. Its other settings stay. */
export function withSlotPlace(port: SpeakerSlotPort, place: SlotPlace): SpeakerSlotPort {
  const { place: _place, ...rest } = port;
  return place === SLOT_PLACE.floor ? rest : { ...rest, place };
}
