// Read adapter: the Hi-fi page's design (HifiDesignState) as a speaker spec and a system spec (the pair at the seat).
// Pure; nothing is written.
import type {
  ChamberVent,
  Dims3,
  HifiDesignState,
  SourcePose,
  SpeakerBand,
  SpeakerDriver,
  SpeakerSpec,
  SpecIdentity,
  SystemAmp,
  SystemSource,
  SystemWithSpeakers,
} from "../../types";
import { driverLayout, hifiPortElbows, isCoax } from "../hifi/hifi";
import { hifiBoxFit } from "../hifi/boxLayout";
import { MAX_ELBOWS } from "../tubeFold";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  FRONT_END_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SOURCE_ROLE,
  SPEAKER_BAND,
  SPEAKER_PART,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { DIRECT_LOAD, channelCounter, lrFilter, speakerIdentity } from "./specParts";

/**
 * The box's vent, by box kind. A round port carries its elbows as the model works them out (the fewest that fit the
 * fitted box; a port too long for any takes the most).
 */
function hifiVent(state: HifiDesignState, dim: Dims3, wall: number): ChamberVent {
  switch (state.boxType) {
    case VENT_KIND.sealed:
      return { kind: VENT_KIND.sealed };
    case VENT_KIND.vented: {
      const port = state.portSpec;
      return port.shape === PORT_SHAPE.slot
        ? { kind: VENT_KIND.vented, port }
        : {
            kind: VENT_KIND.vented,
            port: { ...port, elbows: hifiPortElbows(dim, wall, port) ?? MAX_ELBOWS },
          };
    }
    case VENT_KIND.radiator:
      return { kind: VENT_KIND.radiator, radiators: state.radiatorSelection };
  }
}

/**
 * The drivers where `driverLayout` puts them on the fitted box: the woofer, and the tweeter above it or on the box
 * top on its freestanding waveguide; a coaxial is one driver that both bands feed.
 */
function hifiDrivers(state: HifiDesignState, fit: ReturnType<typeof hifiBoxFit>): SpeakerDriver[] {
  const { woofer, tweeter, selectedWaveguide } = state;
  const guide = fit.waveguideSpec;
  const layout = driverLayout(woofer, fit.tweeterWithWaveguide, fit.dim, !!guide?.freestanding);
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

/**
 * The Hi-fi design as a speaker spec: one chamber at the fitted size, and the 2-way crossover inside the box (the sub
 * highpass is the system's: `systemFromHifi`).
 */
export function speakerFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  identity: SpecIdentity,
): SpeakerSpec {
  const { crossoverHz, crossoverOrder } = state;
  const fit = hifiBoxFit(state);
  const drive = state.drive ?? HIFI_DRIVE.active;
  const band = (id: SpeakerBand["id"], filters: Pick<SpeakerBand, "highpass" | "lowpass">) => ({
    id,
    ...filters,
    levelDb: 0,
    drive,
  });
  return {
    ...identity,
    cabinet: {
      chambers: [
        {
          at: { xIn: 0, yIn: 0 },
          dims: fit.dim,
          netLiters: null,
          vent: hifiVent(state, fit.dim, fit.wallThicknessIn),
          load: DIRECT_LOAD,
          drivers: hifiDrivers(state, fit),
        },
      ],
      panel: {
        nominal: state.wallPanel,
        material: state.panelMaterial,
        thicknessIn: fit.wallThicknessIn,
      },
      insetIn: 0,
      roundoverIn: state.roundoverIn,
      tiltDeg: state.tiltDeg ?? 0,
    },
    bands: [
      band(SPEAKER_BAND.low, { highpass: null, lowpass: lrFilter(crossoverHz, crossoverOrder) }),
      band(SPEAKER_BAND.high, { highpass: lrFilter(crossoverHz, crossoverOrder), lowpass: null }),
    ],
    look,
  };
}

/**
 * The Hi-fi design as a system: the pair `speakerSpacingFt` apart, `distanceToWallFt` from the wall behind, toed in
 * toward the middle on their stands, the right one a mirror image; the seat as the listener. The sub highpass, where
 * set, is each source's filter. Active: a woofer amp and a tweeter amp, a channel of each per speaker, behind a DSP.
 * Passive: one amp channel per speaker, and a DSP only for a sub highpass.
 */
export function systemFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  system: SpecIdentity,
): SystemWithSpeakers {
  const speaker = speakerFromHifi(state, look, speakerIdentity(system, SPEAKER_PART.speaker));
  const passive = (state.drive ?? HIFI_DRIVE.active) === HIFI_DRIVE.passive;
  const { subHighpass } = state;
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
      filters: {
        highpass: subHighpass ? lrFilter(subHighpass.hz, subHighpass.order) : null,
        lowpass: null,
      },
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
      frontEnd: passive && !subHighpass ? null : { kind: FRONT_END_KIND.digital, dspId: null },
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
