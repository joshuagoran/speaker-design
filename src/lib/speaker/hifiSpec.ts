// Read adapter: the Hi-fi page's design (HifiDesignState) as a speaker spec and a system spec (the pair at the seat).
// Pure; nothing is written.
import type {
  ChamberVent,
  HifiDesignState,
  SourcePose,
  SpeakerDriver,
  SpeakerSpec,
  SpecIdentity,
  SystemAmp,
  SystemSource,
  SystemWithSpeakers,
} from "../../types";
import { driverLayout, isCoax, tweeterOnGuide, waveguideFor } from "../hifi/hifi";
import { panelIn } from "../panel";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  HORN_PLACEMENT,
  SOURCE_ROLE,
  SPEAKER_BAND,
  SPEAKER_TEMPLATE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { DIRECT_LOAD, NO_FILTERS, channelCounter, lrFilter, speakerIdentity } from "./specParts";

/** The box's vent, by box kind. */
function hifiVent(state: HifiDesignState): ChamberVent {
  switch (state.boxType) {
    case VENT_KIND.sealed:
      return { kind: VENT_KIND.sealed };
    case VENT_KIND.vented:
      return { kind: VENT_KIND.vented, port: state.portSpec };
    case VENT_KIND.radiator:
      return { kind: VENT_KIND.radiator, radiators: state.radiatorSelection };
  }
}

/**
 * The drivers where `driverLayout` puts them: the woofer, and the tweeter above it or on the box top on its
 * freestanding waveguide; a coaxial is one driver that both bands feed.
 */
function hifiDrivers(state: HifiDesignState): SpeakerDriver[] {
  const { woofer, tweeter, selectedWaveguide, boxDims } = state;
  const guide = waveguideFor(tweeter, selectedWaveguide);
  const layout = driverLayout(
    woofer,
    tweeterOnGuide(tweeter, guide),
    boxDims,
    !!guide?.freestanding,
  );
  const wooferAt = { xIn: 0, yIn: layout.wooferIn };
  if (isCoax(woofer, tweeter))
    return [
      {
        kind: DRIVER_KIND.coaxial,
        driverId: woofer.id,
        count: 1,
        position: wooferAt,
        bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
        horn: null,
      },
    ];
  return [
    {
      kind: DRIVER_KIND.woofer,
      driverId: woofer.id,
      count: 1,
      position: wooferAt,
      bands: [SPEAKER_BAND.low],
      horn: null,
    },
    {
      kind: DRIVER_KIND.tweeter,
      driverId: tweeter.id,
      count: 1,
      // on the box top, the waveguide's mouth is flush with the baffle
      position: { xIn: state.tweeterOffsetIn, yIn: layout.onTop ? 0 : layout.tweeterIn },
      bands: [SPEAKER_BAND.high],
      // the picked waveguide, not a tweeter's own (a ribbon's plate)
      horn:
        guide && !tweeter.ownGuide
          ? {
              hornId: selectedWaveguide.id,
              placement: guide.freestanding ? HORN_PLACEMENT.top : HORN_PLACEMENT.baffle,
              mount: null,
            }
          : null,
    },
  ];
}

/** The Hi-fi design as a speaker spec: one chamber, a 2-way crossover, the sub highpass where set. */
export function speakerFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  identity: SpecIdentity,
): SpeakerSpec {
  const { crossoverHz, crossoverOrder, subHighpass } = state;
  return {
    ...identity,
    template: SPEAKER_TEMPLATE.hifi,
    cabinet: {
      chambers: [
        {
          dims: state.boxDims,
          netLiters: null,
          vent: hifiVent(state),
          load: DIRECT_LOAD,
          drivers: hifiDrivers(state),
        },
      ],
      panel: {
        nominal: state.wallPanel,
        material: state.panelMaterial,
        thicknessIn: panelIn(state.wallPanel, state.panelMaterial, state.panelExactIn),
      },
      insetIn: 0,
      roundoverIn: state.roundoverIn,
      tiltDeg: state.tiltDeg ?? 0,
    },
    bands: [
      {
        id: SPEAKER_BAND.low,
        highpass: subHighpass ? lrFilter(subHighpass.hz, subHighpass.order) : null,
        lowpass: lrFilter(crossoverHz, crossoverOrder),
        levelDb: 0,
      },
      {
        id: SPEAKER_BAND.high,
        highpass: lrFilter(crossoverHz, crossoverOrder),
        lowpass: null,
        levelDb: 0,
      },
    ],
    drive: state.drive ?? HIFI_DRIVE.active,
    look,
  };
}

/**
 * The Hi-fi design as a system: the pair `speakerSpacingFt` apart, `distanceToWallFt` from the wall behind, toed in
 * toward the middle on their stands, the right one a mirror image; the seat as the listener. Active: a woofer amp and
 * a tweeter amp, a channel of each per speaker. Passive: one amp channel per speaker.
 */
export function systemFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  system: SpecIdentity,
): SystemWithSpeakers {
  const speaker = speakerFromHifi(state, look, speakerIdentity(system, SPEAKER_TEMPLATE.hifi));
  const passive = speaker.drive === HIFI_DRIVE.passive;
  const amps: SystemAmp[] = passive
    ? [{ id: SPEAKER_BAND.low, model: null, watts: state.wooferAmpWatts }]
    : [
        { id: SPEAKER_BAND.low, model: null, watts: state.wooferAmpWatts },
        { id: SPEAKER_BAND.high, model: null, watts: state.tweeterAmpWatts },
      ];
  const channel = channelCounter();
  /** a speaker at `side` -1 (left) or 1 (right) of the middle */
  const source = (side: -1 | 1): SystemSource => {
    const pose: SourcePose = {
      x: (side * state.speakerSpacingFt) / 2,
      y: state.distanceToWallFt,
      // toed in: the left one turns toward +x, the right one toward −x
      aim: -side * state.toeInDeg,
      on: null,
      liftIn: state.standHeightIn,
    };
    return {
      speakerId: speaker.id,
      role: SOURCE_ROLE.main,
      pose,
      mirror: side === 1,
      filters: NO_FILTERS,
      delayMs: 0,
      levelDb: 0,
      channels: passive
        ? [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low, SPEAKER_BAND.high])]
        : [
            channel(SPEAKER_BAND.low, [SPEAKER_BAND.low]),
            channel(SPEAKER_BAND.high, [SPEAKER_BAND.high]),
          ],
    };
  };
  return {
    speakers: [speaker],
    system: {
      ...system,
      sources: [source(-1), source(1)],
      amps,
      dsp: null,
      venue: {
        placement: state.placement,
        // the seat is `listeningSeat.y` back from the speakers
        listener: {
          x: state.listeningSeat.x,
          y: state.distanceToWallFt + state.listeningSeat.y,
        },
        earIn: state.earHeightIn,
      },
    },
  };
}
