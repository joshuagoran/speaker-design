// The Hi-fi render page (tests/render-hifi.mjs bundles it): the default Hi-fi design in the page's own 3D view card
// (Viewer3DCard and HifiView3D, from the props the Hi-fi page passes, hifiSceneProps), with the URL's changes:
//   ?tweeter=<id> &guide=<waveguide id> &box=sealed|vented|radiator &port=1|2|slot &roundover=<in> &theme=light|dark
//   &az=<deg> &el=<deg> &zoom=<distance factor> &cutaway=1 &w=<px> &h=<px>
import { createRoot } from "react-dom/client";
import "../../src/styles/app.css";
import { Viewer3DCard } from "../../src/components/stack-view/Viewer3DCard";
import { HifiView3D } from "../../src/components/stack-view/HifiView3D";
import { hifiSceneProps } from "../../src/pages/hifi/hifiSceneProps";
import { deriveHifiDesign } from "../../src/pages/hifi/hifiDesign";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../../src/lib/defaults";
import { HIFI_TWEETERS, HIFI_WAVEGUIDES } from "../../src/lib/data";
import { THEME_ATTR, THEME_DARK, THEME_LIGHT } from "../../src/constants/themes";
import type { HifiBoxKind, HifiDesignState, HifiPort } from "../../src/types";

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const deg = (k: string) => (q.has(k) ? (Number(q.get(k)) * Math.PI) / 180 : undefined);
document.documentElement.setAttribute(
  THEME_ATTR,
  q.get("theme") === THEME_DARK ? THEME_DARK : THEME_LIGHT,
);

const BOXES: readonly HifiBoxKind[] = ["sealed", "vented", "radiator"];
const PORTS: Record<string, HifiPort> = {
  1: { n: 1, dia: DEFAULT_HIFI.portSpec.dia, len: DEFAULT_HIFI.portSpec.len },
  2: { n: 2, dia: DEFAULT_HIFI.portSpec.dia, len: DEFAULT_HIFI.portSpec.len },
  slot: { shape: "slot", n: 1, h: 1, len: DEFAULT_HIFI.portSpec.len },
};
const state: HifiDesignState = {
  ...DEFAULT_HIFI,
  tweeter: HIFI_TWEETERS.find((t) => t.id === q.get("tweeter")) ?? DEFAULT_HIFI.tweeter,
  selectedWaveguide:
    HIFI_WAVEGUIDES.find((h) => h.id === q.get("guide")) ?? DEFAULT_HIFI.selectedWaveguide,
  boxType: BOXES.find((b) => b === q.get("box")) ?? DEFAULT_HIFI.boxType,
  portSpec: PORTS[q.get("port") ?? ""] ?? DEFAULT_HIFI.portSpec,
  roundoverIn: num("roundover", DEFAULT_HIFI.roundoverIn),
};
const design = deriveHifiDesign(state);
const system = design.speakerModel?.speakerSystem;
if (!system) throw new Error("the design can't be modeled");
const props = hifiSceneProps(state, design, system, DEFAULT_HIFI_LOOK, false);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
root.style.width = `${num("w", 900)}px`;
root.style.height = `${num("h", 700)}px`;
root.className = "relative";
createRoot(root).render(
  <Viewer3DCard boxClassName="relative w-full h-full" startCutaway={q.get("cutaway") === "1"}>
    {(cutaway) => (
      <HifiView3D
        {...props}
        cutaway={cutaway}
        start={{
          ...(q.has("az") ? { rotY: deg("az") } : {}),
          ...(q.has("el") ? { rotX: deg("el") } : {}),
          ...(q.has("zoom") ? { zoom: num("zoom", 1) } : {}),
        }}
      />
    )}
  </Viewer3DCard>,
);
