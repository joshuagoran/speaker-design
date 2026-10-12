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
  FRONT_END_KIND,
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
  channelCounter,
  lrFilter,
  speakerIdentity,
  stackMember,
  stuffingPctOf,
} from "./specParts";
import { STUFFING_VOLUME_GAIN } from "../pa/calc";

/**
 * A band of the coaxial's passive network: the maker's network isn't modeled, so it carries no filters; both bands
 * share the fill's one amp channel.
 */
const networkBand = (id: AdapterBandId, state: FillDesignState): SpeakerBand => ({
  id,
  name: SPEAKER_BAND_NAMES[id],
  highpass: null,
  lowpass: null,
  levelDb: 0,
  drive: HIFI_DRIVE.passive,
  ampW: state.ampWatts,
});

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
 * one placement on one amp channel. The Fills page places nothing, so it stands at the origin.
 */
export function layersFromFill(state: FillDesignState, design: SpecIdentity): DesignLayers {
  const speaker = speakerFromFill(state, speakerIdentity(design, SPEAKER_PART.speaker));
  const channel = channelCounter();
  const crossover = { highpass: lrFilter(state.highpassHz, state.highpassOrder), lowpass: null };
  return {
    speakers: [speaker],
    stack: { ...design, members: [stackMember(speaker.id, crossover)], notes: "" },
    space: {
      ...design,
      placements: [
        {
          x: 0,
          y: 0,
          aim: 0,
          item: { kind: SPACE_ITEM.stack, id: design.id },
          liftIn: 0,
          mirror: false,
          channels: [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low, SPEAKER_BAND.high])],
        },
      ],
      amps: [{ id: SPEAKER_BAND.low, model: null, watts: state.ampWatts }],
      frontEnd: { kind: FRONT_END_KIND.digital, dspId: null },
      venue: null,
    },
  };
}
