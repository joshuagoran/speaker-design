// The Speaker render page (tests/render-speaker.mjs bundles it): a template's speaker in the Speaker page's own 3D view
// card (Viewer3DCard and SpeakerView3D, from the props the page passes) or its front drawing, with the URL's changes:
//   ?template=<SPEAKER_TEMPLATE id> &az=<deg> &el=<deg> &zoom=<distance factor> &cutaway=1 &theme=light|dark
//   &w=<px> &h=<px> &view=3d|front (the 3D view, or the front drawing alone) &hardware=1 (the PA boxes' handles on a box
//   that has none)
import { createRoot } from "react-dom/client";
import "../../src/styles/app.css";
import { Viewer3DCard } from "../../src/components/stack-view/Viewer3DCard";
import { SpeakerView3D } from "../../src/components/stack-view/SpeakerView3D";
import { SpeakerFront } from "../../src/components/drawings/SpeakerFront";
import { SPEAKER_TEMPLATE, type SpeakerTemplate } from "../../src/constants/speakerStarts";
import { templateSpeaker } from "../../src/pages/speaker/speakerTemplates";
import { THEME_ATTR, THEME_DARK, THEME_LIGHT } from "../../src/constants/themes";
import { DEFAULT_PA } from "../../src/lib/defaults";

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const deg = (k: string) => (q.has(k) ? (Number(q.get(k)) * Math.PI) / 180 : undefined);
document.documentElement.setAttribute(
  THEME_ATTR,
  q.get("theme") === THEME_DARK ? THEME_DARK : THEME_LIGHT,
);
const template = Object.values(SPEAKER_TEMPLATE).find(
  (t): t is SpeakerTemplate => t === q.get("template"),
);
const startSpeaker = templateSpeaker(template ?? SPEAKER_TEMPLATE.paV2SubBinTwo);
const spec =
  q.get("hardware") === "1"
    ? { ...startSpeaker, cabinet: { ...startSpeaker.cabinet, hardware: DEFAULT_PA.hardware.sub } }
    : startSpeaker;
const front = q.get("view") === "front";

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
root.style.width = `${num("w", 900)}px`;
root.style.height = `${num("h", 700)}px`;
root.className = "relative";
createRoot(root).render(
  front ? (
    <div className="w-full h-full bg-panel p-4">
      <SpeakerFront spec={spec} />
    </div>
  ) : (
    <Viewer3DCard boxClassName="relative w-full h-full" startCutaway={q.get("cutaway") === "1"}>
      {(cutaway) => (
        <SpeakerView3D
          spec={{ cabinet: spec.cabinet, look: spec.look }}
          cutaway={cutaway}
          start={{
            ...(q.has("az") ? { rotY: deg("az") } : {}),
            ...(q.has("el") ? { rotX: deg("el") } : {}),
            ...(q.has("zoom") ? { zoom: num("zoom", 1) } : {}),
          }}
        />
      )}
    </Viewer3DCard>
  ),
);
// the front drawing has no viewer to mark itself
if (front) document.title = "rendered";
