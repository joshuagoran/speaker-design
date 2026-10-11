import { waveguideSpecOf, throatAdapterPrice } from "../../lib/data";
import { abs } from "../../lib/acoustics/complex";
import { METERS_PER_FOOT, METERS_PER_INCH } from "../../constants/units";
import { HIFI_DRIVE, HIFI_PORT_MAX_MS, HIFI_SEAT_FLOOR_M } from "../../constants/hifiEngine";
import {
  hifiSystem,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  hifiEdgeRipple,
  hifiSeatPaths,
  listenerGeometry,
  logSpacedFrequencies,
  linkwitzRileyFilter,
} from "../../lib/hifi/hifi";
import { hifiBoxFit } from "../../lib/hifi/boxLayout";
import { rippleDb } from "../../lib/hifi/diffraction";
import { hifiPairLevelDb, inFarField } from "../../lib/hifi/nearField";
import type { HifiDesign, HifiDesignState, HifiSpeakerModel } from "../../types";

/** The frequencies every Hi-fi response is worked out at: the charts' 15 Hz to 20 kHz axis. */
const RESPONSE_FREQUENCIES = logSpacedFrequencies(15, 20000, 220);

/** The Hi-fi model, pure in the state: the config the lib functions take, the system and its warnings, the seat geometry, levels and response curves. */
export function deriveHifiDesign(state: HifiDesignState): HifiDesign {
  const {
    woofer,
    tweeter,
    selectedWaveguide,
    boxType,
    panelMaterial,
    portSpec,
    crossoverHz,
    crossoverOrder,
    wooferAmpWatts,
    tweeterAmpWatts,
    baffleStepCompensationDb,
    placement,
    distanceToWallFt,
    dispersionPlane,
    roundoverIn,
    tweeterOffsetIn,
    subHighpass,
    drive,
    tiltDeg,
    seatFloorM = HIFI_SEAT_FLOOR_M,
    portMaxMs = HIFI_PORT_MAX_MS,
  } = state;
  const compressionWaveguide = waveguideSpecOf(selectedWaveguide);
  // the waveguide, radiators, walls and the box fitted to what its parts need (lib/hifi/boxLayout)
  const { waveguideSpec, radiator, wallThicknessIn, tweeterWithWaveguide, boxMin, dim } =
    hifiBoxFit(state);
  const radiatorDriver = radiator.drv;
  const speakerConfig = {
    box: boxType,
    dim,
    wall: wallThicknessIn,
    mat: panelMaterial,
    port: portSpec,
    pr: radiator,
    xo: crossoverHz,
    order: crossoverOrder,
    wAmpW: wooferAmpWatts,
    tAmpW: tweeterAmpWatts,
    bsc: baffleStepCompensationDb,
    place: placement,
    wallFt: distanceToWallFt,
    portMax: portMaxMs,
    guide: waveguideSpec,
    roundoverIn,
    tweeterOffsetIn,
    // the engine options only when they change something, so a design without them is the same config as before
    ...(subHighpass && { hp: subHighpass }),
    ...(drive === HIFI_DRIVE.passive && { drive }),
    ...(tiltDeg ? { tiltDeg } : {}),
  };
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const leftGeometry = listenerGeometry(-1, state),
    rightGeometry = listenerGeometry(1, state);
  // One rule for every figure at the seat (the level, the pair's response, the map): each speaker is at least the seat
  // floor away (1 m by default), so a seat at the speakers (spacing 0, seat at the origin) can't send the level to
  // infinity, and the near-field forms (lib/hifi/nearField) only come in with a floor under 1 m, as `nearField.near`
  // says.
  const seatDistanceM = Math.max(seatFloorM, (leftGeometry.distM + rightGeometry.distM) / 2);
  const flooredAt = (g: typeof leftGeometry) => ({ ...g, distM: Math.max(seatFloorM, g.distM) });
  // the nearer speaker, against the box and woofer sizes the far-field models assume small
  const nearestM = Math.max(seatFloorM, Math.min(leftGeometry.distM, rightGeometry.distM));
  const nearField = {
    distM: nearestM,
    boxRatio: nearestM / (Math.max(speakerConfig.dim.w, speakerConfig.dim.h) * METERS_PER_INCH),
    wooferRatio: nearestM / (woofer.size * METERS_PER_INCH),
    near: !inFarField(nearestM),
  };
  const guideBought = !!waveguideSpec && !tweeter.ownGuide;
  const pairCostUsd =
    2 *
    ((woofer.price || 0) +
      (tweeter.price || 0) +
      (guideBought
        ? (selectedWaveguide.price || 0) + (throatAdapterPrice(tweeter, compressionWaveguide) ?? 0)
        : 0) +
      (boxType === "radiator" ? radiator.n * (radiatorDriver.price || 0) : 0));
  // whole only when every part bought has a US price (a coaxial's woofer, a waveguide or the throat adapter may not)
  const pairCostKnown =
    woofer.price != null &&
    (!guideBought ||
      (selectedWaveguide.price != null &&
        throatAdapterPrice(tweeter, compressionWaveguide) !== null));
  const speakerSystem = hifiSystem(woofer, tweeterWithWaveguide, speakerConfig);
  let speakerModel: HifiSpeakerModel | null = null;
  if (speakerSystem) {
    const leftResponse = hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        flooredAt(leftGeometry),
        RESPONSE_FREQUENCIES,
      ),
      rightResponse = hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        flooredAt(rightGeometry),
        RESPONSE_FREQUENCIES,
      );
    const edgeRipple = hifiEdgeRipple(
      speakerSystem,
      woofer,
      tweeterWithWaveguide,
      speakerConfig,
      RESPONSE_FREQUENCIES,
    );
    speakerModel = {
      speakerSystem,
      edgeRipple,
      edgeRippleDb: rippleDb(edgeRipple, 1000, 5000),
      warningChips: hifiChips(speakerSystem, woofer, tweeterWithWaveguide, speakerConfig),
      // each speaker at its own distance (at least the seat floor), its drivers' paths counted close in
      maxLevelAtSeatDb: hifiPairLevelDb(speakerSystem, [
        hifiSeatPaths(
          speakerSystem,
          woofer,
          tweeterWithWaveguide,
          speakerConfig,
          leftGeometry,
          seatFloorM,
        ),
        hifiSeatPaths(
          speakerSystem,
          woofer,
          tweeterWithWaveguide,
          speakerConfig,
          rightGeometry,
          seatFloorM,
        ),
      ]),
      onAxisResponse: hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        { th: 0, eyeIn: speakerSystem.lay.tweeterIn, distM: 1, boxFrame: true },
        RESPONSE_FREQUENCIES,
      ),
      pairResponse: leftResponse.map((o, i) => ({
        f: o.f,
        spl: 10 * Math.log10(Math.pow(10, o.spl / 10) + Math.pow(10, rightResponse[i].spl / 10)),
      })),
      tweeterMaxCurve: RESPONSE_FREQUENCIES.map((f) => ({
        f,
        spl:
          speakerSystem.tLevel +
          20 *
            Math.log10(
              Math.max(1e-6, abs(linkwitzRileyFilter(f, crossoverHz, crossoverOrder, "hp"))),
            ),
      })),
      dispersion: hifiDispersionMap(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        dispersionPlane,
        seatDistanceM,
      ),
    };
  }
  return {
    boxMin,
    wallThicknessIn,
    compressionWaveguide,
    waveguideSpec,
    radiatorDriver,
    radiator,
    speakerConfig,
    tweeterWithWaveguide,
    leftGeometry,
    rightGeometry,
    seatDistanceM,
    seatDistanceFt: seatDistanceM / METERS_PER_FOOT,
    nearField,
    pairCostUsd,
    pairCostKnown,
    speakerModel,
  };
}
