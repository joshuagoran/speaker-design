import {
  HIFI_PASSIVES,
  passiveRadiatorMassMax,
  ownGuideCfg,
  waveguideSpecOf,
} from "../../lib/data";
import { METERS_PER_FOOT } from "../../constants/units";
import { byId } from "../../lib/tables";
import {
  hifiSystem,
  hifiChips,
  hifiResponseAt,
  hifiDispersionMap,
  hifiEdgeRipple,
  listenerGeometry,
  logSpacedFrequencies,
  linkwitzRileyFilter,
  cabs,
  needsWaveguide,
} from "../../lib/hifi/hifi";
import { rippleDb } from "../../lib/hifi/diffraction";
import { panelIn } from "../../lib/panel";
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
    boxDims,
    wallPanel,
    panelExactIn,
    panelMaterial,
    portSpec,
    radiatorSelection,
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
  } = state;
  const compressionWaveguide = waveguideSpecOf(selectedWaveguide);
  const waveguideSpec = tweeter.ownGuide
    ? ownGuideCfg(tweeter)
    : needsWaveguide(tweeter)
      ? compressionWaveguide
      : null;
  const radiatorDriver = byId(HIFI_PASSIVES, radiatorSelection.id) ?? HIFI_PASSIVES[0];
  const radiator = {
    drv: radiatorDriver,
    n: radiatorSelection.n,
    addG: Math.min(radiatorSelection.addG, passiveRadiatorMassMax(radiatorDriver)),
  };
  const wallThicknessIn = panelIn(wallPanel, panelMaterial, panelExactIn);
  const speakerConfig = {
    box: boxType,
    dim: boxDims,
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
    portMax: 17,
    guide: waveguideSpec,
    roundoverIn,
    tweeterOffsetIn,
  };
  const tweeterWithWaveguide = waveguideSpec
    ? { ...tweeter, faceplate: { w: waveguideSpec.w, h: waveguideSpec.h } }
    : tweeter;
  // the seat, relative to each speaker (left at -spacing/2, toed in toward the middle)
  const leftGeometry = listenerGeometry(-1, state),
    rightGeometry = listenerGeometry(1, state);
  // floored at 1 m so a seat at the speakers (spacing 0, seat at the origin) can't send the level to infinity
  const seatDistanceM = Math.max(1, (leftGeometry.distM + rightGeometry.distM) / 2);
  const pairCostUsd =
    2 *
    ((woofer.price || 0) +
      (tweeter.price || 0) +
      (waveguideSpec && !tweeter.ownGuide ? selectedWaveguide.price || 0 : 0) +
      (boxType === "radiator" ? radiator.n * (radiatorDriver.price || 0) : 0));
  const speakerSystem = hifiSystem(woofer, tweeterWithWaveguide, speakerConfig);
  let speakerModel: HifiSpeakerModel | null = null;
  if (speakerSystem) {
    const leftResponse = hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        leftGeometry,
        RESPONSE_FREQUENCIES,
      ),
      rightResponse = hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        rightGeometry,
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
      maxLevelAtSeatDb: speakerSystem.maxLevel - 20 * Math.log10(seatDistanceM) + 3,
      onAxisResponse: hifiResponseAt(
        speakerSystem,
        woofer,
        tweeterWithWaveguide,
        speakerConfig,
        { th: 0, eyeIn: speakerSystem.lay.tweeterIn, distM: 1 },
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
              Math.max(1e-6, cabs(linkwitzRileyFilter(f, crossoverHz, crossoverOrder, "hp"))),
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
    pairCostUsd,
    speakerModel,
  };
}
