// Read adapter: the Fills page's design (FillDesignState) as a speaker spec and a system spec. Pure; nothing is written.
import type {
  FillDesignState,
  SpeakerBand,
  SpeakerSpec,
  SpecIdentity,
  SystemWithSpeakers,
} from "../../types";
import { PANEL_STOCK } from "../../data/catalog/plywood";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  FILL_PANEL,
  FRONT_END_KIND,
  PORT_SHAPE,
  SOURCE_ROLE,
  SPEAKER_BAND,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { DIRECT_LOAD, channelCounter, lrFilter, speakerIdentity } from "./specParts";

/** A band of the coaxial's passive network: the maker's network isn't modeled, so it carries no filters. */
const networkBand = (id: SpeakerBand["id"]): SpeakerBand => ({
  id,
  highpass: null,
  lowpass: null,
  levelDb: 0,
  drive: HIFI_DRIVE.passive,
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
          vent:
            state.boxType === VENT_KIND.vented
              ? { kind: VENT_KIND.vented, port: { shape: PORT_SHAPE.round, ...portSpec } }
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
      insetIn: 0,
      roundoverIn: 0,
      tiltDeg: 0,
    },
    bands: [networkBand(SPEAKER_BAND.low), networkBand(SPEAKER_BAND.high)],
    look: {},
  };
}

/**
 * The fill as a system: one source on one amp channel, the highpass to the subs as its filter in a DSP. The Fills page
 * places nothing, so the source stands at the origin.
 */
export function systemFromFill(state: FillDesignState, system: SpecIdentity): SystemWithSpeakers {
  const speaker = speakerFromFill(state, speakerIdentity(system, SPEAKER_PART.speaker));
  const channel = channelCounter();
  return {
    speakers: [speaker],
    system: {
      ...system,
      sources: [
        {
          speakerId: speaker.id,
          role: SOURCE_ROLE.fill,
          pose: { x: 0, y: 0, aim: 0, on: null, liftIn: 0 },
          mirror: false,
          filters: { highpass: lrFilter(state.highpassHz, state.highpassOrder), lowpass: null },
          delayMs: 0,
          levelDb: 0,
          channels: [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low, SPEAKER_BAND.high])],
        },
      ],
      amps: [{ id: SPEAKER_BAND.low, model: null, watts: state.ampWatts }],
      frontEnd: { kind: FRONT_END_KIND.digital, dspId: null },
      venue: null,
    },
  };
}
