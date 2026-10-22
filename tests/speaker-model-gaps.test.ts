// A chamber, driver or filter the speaker model leaves out is named on the Speaker page with its reason, never dropped
// silently: every `SPEAKER_MODEL_GAP` set on a design shows its notice (the chart's, and the chamber's own settings),
// and the "no band has a modeled driver" notice stays quiet where a gap already says why.
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { SpeakerPage } from "../src/pages/speaker/SpeakerPage";
import { emptySpeaker, speakerDraft, useSpeakerPage } from "../src/pages/speaker/useSpeakerPage";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { MODEL_GAP_TEXT, SPEAKER_TEXT } from "../src/constants/speakerPage";
import { PAGE_DRAFT_KEYS } from "../src/constants/pageDrafts";
import { DRIVER_KIND, SPEAKER_MODEL_GAP, VENT_KIND } from "../src/constants/speakerSpec";
import type { SpeakerChamber, SpeakerDriver, SpeakerSpec } from "../src/types";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** The page as the app renders it for a speaker design kept in the browser. */
function render(spec: SpeakerSpec): string {
  const items: Record<string, string> = {
    [PAGE_DRAFT_KEYS.speaker]: JSON.stringify(speakerDraft.toDraft(spec)),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: (k: string) => items[k] ?? null, setItem: () => {} },
    configurable: true,
  });
  function Probe() {
    const speakerPage = useSpeakerPage();
    return createElement(SpeakerPage, { speakerPage, sharedNotice: null, stackEditNotice: null });
  }
  return renderToString(createElement(Probe));
}

/** The text as the markup holds it (React escapes these five; a marked name, `**name**`, is a semibold span). */
const markup = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;")
    .replace(/"/g, "&quot;")
    .replace(/\*\*(.+?)\*\*/g, '<span class="font-semibold">$1</span>');

const base = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "gaps", name: "gaps" });
const [baseChamber] = base.cabinet.chambers;
const woofer = baseChamber.drivers.find((d) => d.kind === DRIVER_KIND.woofer);
const tweeter = baseChamber.drivers.find((d) => d.kind === DRIVER_KIND.tweeter);
if (!woofer || !tweeter) throw new Error("the Hi-fi design has no woofer or tweeter");

/** The Hi-fi speaker with its one chamber changed and its drivers set. */
const withChamber = (
  drivers: SpeakerDriver[],
  patch: Partial<SpeakerChamber> = {},
): SpeakerSpec => ({
  ...base,
  cabinet: { ...base.cabinet, chambers: [{ ...baseChamber, ...patch, drivers }] },
});

/** A design for each gap, and whether the gap is the chamber's or the speaker's. No band plays in any of them. */
const CASES: Record<
  keyof typeof SPEAKER_MODEL_GAP,
  { scope: "chamber" | "speaker"; spec: SpeakerSpec }
> = {
  unknownDriver: { scope: "chamber", spec: withChamber([{ ...woofer, driverId: "not-a-driver" }]) },
  mixedDrivers: {
    scope: "chamber",
    spec: withChamber([woofer, { ...woofer, driverId: "not-a-driver" }]),
  },
  noHf: { scope: "chamber", spec: withChamber([{ ...tweeter, driverId: "not-a-driver" }]) },
  unknownRadiator: {
    scope: "chamber",
    spec: withChamber([woofer], {
      vent: { kind: VENT_KIND.radiator, radiators: { id: "not-a-radiator", n: 1, addG: 0 } },
    }),
  },
  noModel: { scope: "chamber", spec: withChamber([{ ...woofer, count: 0 }]) },
  badFilter: {
    scope: "speaker",
    spec: {
      ...withChamber([woofer]),
      bands: base.bands.map((b) => ({
        ...b,
        highpass: b.highpass && { ...b.highpass, hz: 0 },
        lowpass: b.lowpass && { ...b.lowpass, hz: 0 },
      })),
    },
  },
};

describe("every model gap shows its notice", () => {
  for (const id of Object.values(SPEAKER_MODEL_GAP)) {
    test(`${id}: the notice is on the page, and the empty-bands notice is not`, () => {
      const { scope, spec } = CASES[id];
      const response = speakerResponse(spec);
      const gaps = scope === "chamber" ? response.chambers.flatMap((c) => c.gaps) : response.gaps;
      expect(gaps, "the design reaches the gap").toContain(id);
      // nothing plays: the rule that quiets the empty-bands notice is the one in play
      expect(response.bands).toHaveLength(0);
      const html = render(spec);
      const text = MODEL_GAP_TEXT[id];
      const notice =
        scope === "chamber" ? SPEAKER_TEXT.chamberGap(1, text) : SPEAKER_TEXT.speakerGap(text);
      expect(html, "the chart's notice").toContain(markup(notice));
      // the chamber's own settings say it too
      if (scope === "chamber") expect(html).toContain(markup(SPEAKER_TEXT.speakerGap(text)));
      expect(html).not.toContain(markup(SPEAKER_TEXT.noBands));
    });
  }

  test("no gap and no band: the empty-bands notice shows", () => {
    const html = render(emptySpeaker());
    expect(html).toContain(markup(SPEAKER_TEXT.noBands));
    for (const { why } of Object.values(MODEL_GAP_TEXT)) expect(html).not.toContain(markup(why));
  });

  test("a gap on the second chamber is named with its number", () => {
    const spec: SpeakerSpec = {
      ...base,
      cabinet: {
        ...base.cabinet,
        chambers: [
          baseChamber,
          { ...baseChamber, drivers: baseChamber.drivers.map((d) => ({ ...d, count: 0 })) },
        ],
      },
    };
    expect(render(spec)).toContain(markup(SPEAKER_TEXT.chamberGap(2, MODEL_GAP_TEXT.noModel)));
  });
});
