// Read adapter: the Fills page's design (FillDesignState) as a speaker spec. Pure; nothing is written.
import type { FillDesignState, SpeakerSpec, SpecIdentity } from "../../types";
import { PANEL_STOCK } from "../../data/catalog/plywood";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  FILL_PANEL,
  PORT_SHAPE,
  SPEAKER_BAND,
  SPEAKER_TEMPLATE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { DIRECT_LOAD, lrFilter } from "./specParts";

/**
 * The fill as a speaker spec: a coaxial in a sealed or vented ½″ box on one amp channel through its maker's passive
 * network (the network's crossover isn't modeled, so the bands carry none), and the highpass to the subs.
 */
export function speakerFromFill(state: FillDesignState, identity: SpecIdentity): SpeakerSpec {
  const { boxDims, portSpec } = state;
  return {
    ...identity,
    template: SPEAKER_TEMPLATE.fill,
    cabinet: {
      chambers: [
        {
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
    bands: [
      {
        id: SPEAKER_BAND.low,
        highpass: lrFilter(state.highpassHz, state.highpassOrder),
        lowpass: null,
        levelDb: 0,
      },
      { id: SPEAKER_BAND.high, highpass: null, lowpass: null, levelDb: 0 },
    ],
    drive: HIFI_DRIVE.passive,
    look: {},
  };
}
