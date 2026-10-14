// Read adapter: the Fills page's design (FillDesignState) as a speaker spec, a stack of one and a space. Pure; nothing
// is written.
import type {
  AdapterBandId,
  DesignLayers,
  FillDesignState,
  SpeakerBand,
  SpeakerSpec,
  SpecIdentity,
} from "../../types";
import { PANEL_STOCK } from "../../data/catalog/plywood";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  FILL_PANEL,
  PORT_SHAPE,
  SPACE_ITEM,
  SPEAKER_BAND,
  SPEAKER_BAND_NAMES,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  DIRECT_LOAD,
  FLUSH_BOX,
  flushBracing,
  NO_FILTERS,
  homeVenue,
  lrFilter,
  spacePlacement,
  speakerIdentity,
  stackMember,
  stuffingPctOf,
} from "./specParts";
import { SEATED_EAR_FT, SPACE_HOME_ROOM } from "../../constants/space";
import { STUFFING_VOLUME_GAIN } from "../pa/calc";
import { DEFAULT_HIFI } from "../defaults";

/**
 * A band of the coaxial's passive network: the cone below its HF section's recommended crossover (`hf.xo`) and the HF
 * section above it, at the Hi-fi page's slope, as the coaxial monitor template crosses it (the maker's own network
 * isn't published). A coaxial without HF data or a crossover keeps both bands open. Both bands share the fill's one
 * amp channel.
 */
function networkBand(id: AdapterBandId, state: FillDesignState): SpeakerBand {
  const xo = state.driver.hf?.xo;
  const filter = xo ? lrFilter(xo, DEFAULT_HIFI.crossoverOrder) : null;
  return {
    id,
    name: SPEAKER_BAND_NAMES[id],
    highpass: id === SPEAKER_BAND.high ? filter : null,
    lowpass: id === SPEAKER_BAND.low ? filter : null,
    levelDb: 0,
    drive: HIFI_DRIVE.passive,
    ampW: state.ampWatts,
  };
}

/**
 * The fill as a speaker spec: a coaxial in a sealed or vented ½″ box through its maker's passive network. The round
 * port runs straight (the Fills model takes no elbows).
 */
export function speakerFromFill(state: FillDesignState, identity: SpecIdentity): SpeakerSpec {
  const { boxDims, portSpec } = state;
  return {
    ...identity,
    cabinet: {
      chambers: [
        {
          at: { xIn: 0, yIn: 0 },
          dims: boxDims,
          netLiters: null,
          // the Fills model stuffs only a sealed box (fillSystem)
          stuffingPct: state.boxType === VENT_KIND.vented ? 0 : stuffingPctOf(STUFFING_VOLUME_GAIN),
          vent:
            state.boxType === VENT_KIND.vented
              ? {
                  kind: VENT_KIND.vented,
                  port: { shape: PORT_SHAPE.round, ...portSpec },
                  maxSpeedMs: state.maxPortAirSpeedMs,
                }
              : { kind: VENT_KIND.sealed },
          load: DIRECT_LOAD,
          drivers: [
            {
              kind: DRIVER_KIND.coaxial,
              driverId: state.driver.id,
              count: 1,
              // the Fills page draws no layout: centered
              position: { xIn: 0, yIn: boxDims.h / 2 },
              bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
              horn: null,
            },
          ],
        },
      ],
      panel: {
        nominal: FILL_PANEL,
        material: PLYWOOD_MATERIAL,
        thicknessIn: PANEL_STOCK[FILL_PANEL].in,
      },
      ...FLUSH_BOX,
      ...flushBracing(PANEL_STOCK[FILL_PANEL].in),
      // the fill page counts no handles or input dish
      hardware: null,
      roundoverIn: 0,
      tiltDeg: 0,
    },
    bands: [networkBand(SPEAKER_BAND.low, state), networkBand(SPEAKER_BAND.high, state)],
    // the highpass to the subs is the stack's crossover (layersFromFill): the input range starts off
    input: NO_FILTERS,
    look: {},
  };
}

/**
 * The fill read in: the speaker, a stack of one with the highpass to the subs as its crossover (in a DSP), and the space:
 * one placement. The Fills page places nothing, so it stands at the origin.
 */
export function layersFromFill(state: FillDesignState, design: SpecIdentity): DesignLayers {
  const speaker = speakerFromFill(state, speakerIdentity(design, SPEAKER_PART.speaker));
  const crossover = { highpass: lrFilter(state.highpassHz, state.highpassOrder), lowpass: null };
  return {
    speakers: [speaker],
    stack: { ...design, members: [stackMember(speaker.id, crossover)], notes: "" },
    space: {
      ...design,
      placements: [spacePlacement({ x: 0, y: 0 }, { kind: SPACE_ITEM.stack, id: design.id }, 0)],
      // a seated listener in a living room, in front of it
      venue: homeVenue(0, { x: 0, y: SPACE_HOME_ROOM.lengthFt / 2 }, SEATED_EAR_FT),
    },
  };
}
