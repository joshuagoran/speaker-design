// Read adapter: the Hi-fi page's design (HifiDesignState) as a speaker spec, a stack of one (its sub highpass) and a
// space (the pair at the seat). Pure; nothing is written.
import type {
  AdapterBandId,
  BandFilter,
  ChamberVent,
  DesignLayers,
  HifiDesignState,
  SpaceAmp,
  SpacePlacement,
  SpeakerBand,
  SpeakerDriver,
  SpeakerSpec,
  SpecIdentity,
} from "../../types";
import {
  driverLayout,
  HIFI_STUFFING_GAIN,
  hifiBox,
  hifiGridTop,
  hifiPortElbows,
  isCoax,
  tweeterLevelInBox,
} from "../hifi/hifi";
import { hifiBoxFit } from "../hifi/boxLayout";
import { MAX_ELBOWS } from "../tubeFold";
import { HIFI_DRIVE, HIFI_PORT_MAX_MS, HIFI_SUBSONIC_TYPE } from "../../constants/hifiEngine";
import {
  DRIVER_KIND,
  FRONT_END_KIND,
  HORN_PLACEMENT,
  ONE_WATT_VOLTS,
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
  NO_FILTERS,
  channelCounter,
  lrFilter,
  speakerIdentity,
  stackMember,
  stuffingPctOf,
} from "./specParts";

/**
 * The box's vent, by box kind. A round port carries its elbows as the model works them out (the fewest that fit the
 * fitted box; a port too long for any takes the most).
 */
function hifiVent(
  state: HifiDesignState,
  { dim, wallThicknessIn: wall, radiator }: ReturnType<typeof hifiBoxFit>,
): ChamberVent {
  switch (state.boxType) {
    case VENT_KIND.sealed:
      return { kind: VENT_KIND.sealed };
    case VENT_KIND.vented: {
      const port = state.portSpec;
      // the Hi-fi page's air-speed limit
      const maxSpeedMs = state.portMaxMs ?? HIFI_PORT_MAX_MS;
      return port.shape === PORT_SHAPE.slot
        ? { kind: VENT_KIND.vented, port, maxSpeedMs }
        : {
            kind: VENT_KIND.vented,
            port: { ...port, elbows: hifiPortElbows(dim, wall, port) ?? MAX_ELBOWS },
            maxSpeedMs,
          };
    }
    case VENT_KIND.radiator:
      // the radiators as the model takes them: the added mass kept under the most allowed (hifiBoxFit)
      return {
        kind: VENT_KIND.radiator,
        radiators: { id: radiator.drv.id, n: radiator.n, addG: radiator.addG },
      };
  }
}

/**
 * The drivers where `driverLayout` puts them on the fitted box: the woofer, and the tweeter above it or on the box
 * top on its freestanding waveguide; a coaxial is one driver that both bands feed.
 */
function hifiDrivers(state: HifiDesignState, fit: ReturnType<typeof hifiBoxFit>): SpeakerDriver[] {
  const { woofer, tweeter, selectedWaveguide } = state;
  /** the waveguide in use: the tweeter's own, the picked one, or none */
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
 * What the band filters and levels read from the model's box: its own subsonic (a vented or radiator box's highpass at
 * 0.75 × its tuning; null for a sealed box) and the tweeter's level match (`tweeterLevelInBox` trim: the tweeter set to
 * the woofer's passband level at 2.83 V). Both null and 0 for a box the model can't take.
 */
function hifiBandParts(
  state: HifiDesignState,
  fit: ReturnType<typeof hifiBoxFit>,
): { subsonic: BandFilter | null; trimDb: number } {
  const box = hifiBox(
    state.woofer,
    {
      box: state.boxType,
      port: state.portSpec,
      pr: fit.radiator,
      dim: fit.dim,
      wall: fit.wallThicknessIn,
      wAmpW: state.wooferAmpWatts,
    },
    hifiGridTop(state.crossoverHz),
  );
  if (!box) return { subsonic: null, trimDb: 0 };
  /** the woofer's passband level at 2.83 V, as hifiSystemFromBox reads it */
  const refW = box.m.ref - 20 * Math.log10(box.V / ONE_WATT_VOLTS);
  const { trim } = tweeterLevelInBox(
    state.tweeter,
    {
      xo: state.crossoverHz,
      tAmpW: state.tweeterAmpWatts,
      wAmpW: state.wooferAmpWatts,
      drive: state.drive,
    },
    refW,
  );
  return {
    subsonic: box.hpf ? { hz: box.hpf, type: HIFI_SUBSONIC_TYPE } : null,
    trimDb: trim,
  };
}

/**
 * The Hi-fi design as a speaker spec: one chamber at the fitted size, the 2-way crossover inside the box and the box's
 * subsonic (the sub highpass is the stack's crossover: `layersFromHifi`).
 */
export function speakerFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  identity: SpecIdentity,
): SpeakerSpec {
  const { crossoverHz, crossoverOrder } = state;
  /** the box as the model takes it (lib/hifi/boxLayout) */
  const fit = hifiBoxFit(state);
  const drive = state.drive ?? HIFI_DRIVE.active;
  const { subsonic, trimDb } = hifiBandParts(state, fit);
  const band = (
    id: AdapterBandId,
    filters: Pick<SpeakerBand, "highpass" | "lowpass">,
    levelDb: number,
    ampW: SpeakerBand["ampW"],
  ): SpeakerBand => ({ id, name: SPEAKER_BAND_NAMES[id], ...filters, levelDb, drive, ampW });
  return {
    ...identity,
    cabinet: {
      chambers: [
        {
          at: { xIn: 0, yIn: 0 },
          dims: fit.dim,
          netLiters: null,
          // the Hi-fi engine stuffs only a sealed box (hifiBox)
          stuffingPct: state.boxType === VENT_KIND.sealed ? stuffingPctOf(HIFI_STUFFING_GAIN) : 0,
          vent: hifiVent(state, fit),
          load: DIRECT_LOAD,
          drivers: hifiDrivers(state, fit),
        },
      ],
      panel: {
        nominal: state.wallPanel,
        material: state.panelMaterial,
        thicknessIn: fit.wallThicknessIn,
      },
      ...FLUSH_BOX,
      roundoverIn: state.roundoverIn,
      tiltDeg: state.tiltDeg ?? 0,
    },
    bands: [
      band(
        SPEAKER_BAND.low,
        { highpass: subsonic, lowpass: lrFilter(crossoverHz, crossoverOrder) },
        0,
        state.wooferAmpWatts,
      ),
      band(
        SPEAKER_BAND.high,
        { highpass: lrFilter(crossoverHz, crossoverOrder), lowpass: null },
        trimDb,
        // passive: the woofer's channel, which it shares
        drive === HIFI_DRIVE.passive ? state.wooferAmpWatts : state.tweeterAmpWatts,
      ),
    ],
    // the Hi-fi page's sub highpass is the stack's crossover (layersFromHifi): the input range starts off
    input: NO_FILTERS,
    look,
  };
}

/**
 * The Hi-fi design read in: the speaker, a stack of one with the sub highpass (where set) as its crossover, and the
 * space: the pair `speakerSpacingFt` apart, `distanceToWallFt` from the wall behind, toed in toward the middle on their
 * stands, the right one a mirror image; the seat as the listener. Active: a woofer amp and a tweeter amp, a channel of
 * each per speaker, behind a DSP. Passive: one amp channel per speaker, and a DSP only for a sub highpass.
 */
export function layersFromHifi(
  state: HifiDesignState,
  look: SpeakerSpec["look"],
  design: SpecIdentity,
): DesignLayers {
  const speaker = speakerFromHifi(state, look, speakerIdentity(design, SPEAKER_PART.speaker));
  /** one channel per speaker when its bands share a passive network */
  const passive = speaker.bands.every((b) => b.drive === HIFI_DRIVE.passive);
  const { subHighpass } = state;
  const amps: SpaceAmp[] = passive
    ? [{ id: SPEAKER_BAND.low, model: null, watts: state.wooferAmpWatts }]
    : [
        { id: SPEAKER_BAND.low, model: null, watts: state.wooferAmpWatts },
        { id: SPEAKER_BAND.high, model: null, watts: state.tweeterAmpWatts },
      ];
  const crossover = {
    highpass: subHighpass ? lrFilter(subHighpass.hz, subHighpass.order) : null,
    lowpass: null,
  };
  const channel = channelCounter();
  /** the speaker's stack at `side` -1 (left) or 1 (right) of the middle */
  const placement = (side: -1 | 1): SpacePlacement => ({
    x: (side * state.speakerSpacingFt) / 2,
    y: state.distanceToWallFt,
    // toed in: the left one turns toward +x, the right one toward −x
    aim: -side * state.toeInDeg,
    item: { kind: SPACE_ITEM.stack, id: design.id },
    liftIn: state.standHeightIn,
    mirror: side === 1,
    channels: passive
      ? [channel(SPEAKER_BAND.low, [SPEAKER_BAND.low, SPEAKER_BAND.high])]
      : [
          channel(SPEAKER_BAND.low, [SPEAKER_BAND.low]),
          channel(SPEAKER_BAND.high, [SPEAKER_BAND.high]),
        ],
  });
  return {
    speakers: [speaker],
    stack: { ...design, members: [stackMember(speaker.id, crossover)], notes: "" },
    space: {
      ...design,
      placements: [placement(-1), placement(1)],
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
