// Share links (src/lib/io/shareLink): a speaker, a stack or a space goes into a link and comes back the same; a link that
// is cut short, damaged, too large or not ours says why; each page opens at its kind's address.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  decodeLink,
  encodeLink,
  linkFragment,
  shareValue,
  spaceEnvelope,
  speakerEnvelope,
  stackEnvelope,
  withoutShare,
} from "../src/lib/io/shareLink";
import { usedParts } from "../src/lib/speaker/usedParts";
import { openEnvelope } from "../src/pages/share/openShare";
import { pageAt } from "../src/lib/pageRoute";
import { PAGE_HASHES } from "../src/constants/pages";
import {
  SHARE_ERROR,
  SHARE_FORMAT,
  SHARE_KIND,
  SHARE_MAX_JSON_BYTES,
  SHARE_MAX_PAYLOAD_CHARS,
  SHARE_VERSION,
} from "../src/constants/share";
import { presetLayers, STACK_PRESETS } from "../src/pages/stack/stackPresets";
import { STACK_START_NAMES } from "../src/constants/stackPresets";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPEAKER_START_SPEAKER_NAMES } from "../src/constants/speakerStarts";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { spaceFromStart } from "../src/pages/space/useSpace";
import type { ShareKind, SpaceDesign } from "../src/types";

/** The design as a link keeps it: JSON drops undefined fields. */
const asJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A base64url payload of raw-deflated text. */
async function packed(text: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return Buffer.from(bytes).toString("base64url");
}

/** The fragment of a payload at a version. */
const fragmentOf = (payload: string, version = SHARE_VERSION) => `#space&s=${version}.${payload}`;

const START = spaceFromStart(STACK_PRESETS[0] ?? "paStack");
const envelope = spaceEnvelope(START);

for (const preset of STACK_PRESETS) {
  test(`round trip: ${STACK_START_NAMES[preset]} as a space`, async () => {
    const design: SpaceDesign = spaceFromStart(preset);
    const fragment = linkFragment(SHARE_KIND.space, await encodeLink(spaceEnvelope(design)));
    assert.ok(fragment.startsWith(`#space&s=${SHARE_VERSION}.`));
    const decoded = await decodeLink(fragment);
    assert.ok(decoded.ok);
    assert.deepStrictEqual(decoded.envelope, asJson(spaceEnvelope(design)));
    const opened = openEnvelope(decoded.envelope);
    assert.ok(opened && opened.kind === SHARE_KIND.space);
    // a link keeps the stacks and speakers the space places
    assert.deepStrictEqual(opened.design, asJson({ space: design.space, ...usedParts(design) }));
  });

  test(`round trip: ${STACK_START_NAMES[preset]} as a stack`, async () => {
    const { stack, speakers } = presetLayers(preset, { id: "draft", name: "A stack" });
    const fragment = linkFragment(
      SHARE_KIND.stack,
      await encodeLink(stackEnvelope({ stack, speakers })),
    );
    assert.ok(fragment.startsWith(`#stack&s=${SHARE_VERSION}.`));
    const decoded = await decodeLink(fragment);
    assert.ok(decoded.ok);
    assert.deepStrictEqual(decoded.envelope, asJson(stackEnvelope({ stack, speakers })));
    const opened = openEnvelope(decoded.envelope);
    assert.ok(opened && opened.kind === SHARE_KIND.stack);
    assert.deepStrictEqual(opened.design, asJson({ stack, speakers }));
  });
}

for (const template of Object.values(SPEAKER_TEMPLATE)) {
  test(`round trip: the ${SPEAKER_START_SPEAKER_NAMES[template]} template as a speaker`, async () => {
    const speaker = templateSpeaker(template);
    const fragment = linkFragment(SHARE_KIND.speaker, await encodeLink(speakerEnvelope(speaker)));
    assert.ok(fragment.startsWith(`#speaker&s=${SHARE_VERSION}.`));
    const decoded = await decodeLink(fragment);
    assert.ok(decoded.ok, `${template}: ${!decoded.ok ? decoded.error : ""}`);
    assert.deepStrictEqual(decoded.envelope, asJson(speakerEnvelope(speaker)));
    const opened = openEnvelope(decoded.envelope);
    assert.ok(opened && opened.kind === SHARE_KIND.speaker);
    assert.deepStrictEqual(opened.design, asJson(speaker));
  });
}

test("the fragment: its value, and the address without it", () => {
  assert.equal(shareValue("#space&s=1.abc"), "1.abc");
  assert.equal(shareValue("#space&x=1&s=1.abc"), "1.abc");
  assert.equal(shareValue("#space"), null);
  assert.equal(withoutShare("#space&s=1.abc"), PAGE_HASHES.space);
  assert.equal(withoutShare("#space&x=1&s=1.abc"), "#space&x=1");
  assert.equal(withoutShare("#space"), "#space");
  // the page's hash can be set: a link of another kind than its hash names opens on its kind's page
  assert.equal(withoutShare("#space&s=1.abc", PAGE_HASHES.stack), PAGE_HASHES.stack);
});

test("bad link: no payload, or a payload cut short", async () => {
  const payload = await encodeLink(envelope);
  for (const fragment of ["#space&s=1", "#space&s=1.", fragmentOf(payload.slice(0, 41))]) {
    const decoded = await decodeLink(fragment);
    assert.ok(!decoded.ok);
    assert.equal(decoded.error, SHARE_ERROR.cutShort, fragment.slice(0, 20));
  }
  // cut inside the compressed data (here, a whole number of base64 groups)
  const inside = await decodeLink(fragmentOf(payload.slice(0, 40)));
  assert.ok(!inside.ok);
  assert.equal(inside.error, SHARE_ERROR.cutShort);
  // cut at any length, a link never opens
  for (let n = 1; n < payload.length; n += 37) {
    assert.ok(!(await decodeLink(fragmentOf(payload.slice(0, n)))).ok, `cut at ${n}`);
  }
});

test("bad link: characters outside base64url", async () => {
  const payload = await encodeLink(envelope);
  for (const bad of [`${payload.slice(0, 20)}+/==`, `${payload.slice(0, 20)} x`, "%%%%"]) {
    const decoded = await decodeLink(fragmentOf(bad));
    assert.ok(!decoded.ok);
    assert.equal(decoded.error, SHARE_ERROR.badBase64, bad);
  }
});

test("bad link: not deflate", async () => {
  const decoded = await decodeLink(
    fragmentOf(Buffer.from("this is plain text, not deflate").toString("base64url")),
  );
  assert.ok(!decoded.ok);
  assert.equal(decoded.error, SHARE_ERROR.notDeflate);
  const noise = await decodeLink(fragmentOf("AAAAAAAAAAAAAAAAAAAAAAAA"));
  assert.ok(!noise.ok);
  assert.equal(noise.error, SHARE_ERROR.notDeflate);
});

test("bad link: too large when unpacked", async () => {
  const big = JSON.stringify({ filler: "a".repeat(SHARE_MAX_JSON_BYTES + 10) });
  const payload = await packed(big);
  // a small link for a very large text
  assert.ok(payload.length < 5000, `${payload.length}`);
  const decoded = await decodeLink(fragmentOf(payload));
  assert.ok(!decoded.ok);
  assert.equal(decoded.error, SHARE_ERROR.tooLarge);
});

test("bad link: a payload over the cap is too large", async () => {
  const decoded = await decodeLink(fragmentOf("A".repeat(SHARE_MAX_PAYLOAD_CHARS + 1)));
  assert.ok(!decoded.ok);
  assert.equal(decoded.error, SHARE_ERROR.tooLarge);
  // a real link is far under the cap
  assert.ok((await encodeLink(envelope)).length < SHARE_MAX_PAYLOAD_CHARS / 4);
});

test("bad link: another version", async () => {
  const payload = await encodeLink(envelope);
  const prefixed = await decodeLink(fragmentOf(payload, 2));
  assert.ok(!prefixed.ok);
  assert.equal(prefixed.error, SHARE_ERROR.otherVersion);
  const inside = await decodeLink(
    fragmentOf(await packed(JSON.stringify({ ...envelope, version: 2 }))),
  );
  assert.ok(!inside.ok);
  assert.equal(inside.error, SHARE_ERROR.otherVersion);
});

const SPEAKER = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
const STACK = presetLayers(STACK_PRESETS[0] ?? "paStack", { id: "draft", name: "A stack" });
const speakerEnvelopeJson = asJson(speakerEnvelope(SPEAKER));
const stackEnvelopeJson = asJson(stackEnvelope({ stack: STACK.stack, speakers: STACK.speakers }));

test("bad link: not a shared design", async () => {
  const [one] = speakerEnvelopeJson.speakers;
  const wrong: unknown[] = [
    [],
    "text",
    { ...envelope, format: "other" },
    { ...envelope, kind: "other" },
    { ...envelope, kind: "speaker" },
    { ...envelope, speakers: {} },
    { ...envelope, stacks: [1] },
    { ...envelope, spaces: [] },
    { ...envelope, spaces: [{ id: "x" }] },
    { format: SHARE_FORMAT, version: SHARE_VERSION },
    // a speaker link: one speaker, and nothing else
    { ...speakerEnvelopeJson, speakers: [] },
    { ...speakerEnvelopeJson, speakers: [one, { ...one, id: "other" }] },
    { ...speakerEnvelopeJson, stacks: stackEnvelopeJson.stacks },
    { ...speakerEnvelopeJson, spaces: envelope.spaces },
    { ...speakerEnvelopeJson, speakers: [{ ...one, id: 5 }] },
    // a stack link: one stack, no space
    { ...stackEnvelopeJson, stacks: [] },
    { ...stackEnvelopeJson, stacks: [...stackEnvelopeJson.stacks, ...stackEnvelopeJson.stacks] },
    { ...stackEnvelopeJson, spaces: envelope.spaces },
    { ...stackEnvelopeJson, kind: "space" },
    // two items with one id
    {
      ...stackEnvelopeJson,
      speakers: [...stackEnvelopeJson.speakers, ...stackEnvelopeJson.speakers],
    },
  ];
  for (const value of wrong) {
    const decoded = await decodeLink(fragmentOf(await packed(JSON.stringify(value))));
    assert.ok(!decoded.ok, JSON.stringify(value).slice(0, 30));
    assert.equal(decoded.error, SHARE_ERROR.wrongFormat, JSON.stringify(value).slice(0, 30));
  }
  const none = await decodeLink("#space");
  assert.ok(!none.ok);
  assert.equal(none.error, SHARE_ERROR.wrongFormat);
  const text = await decodeLink(fragmentOf(await packed("not json")));
  assert.ok(!text.ok);
});

/** `root` as JSON with the value at `path` replaced (a key, or a list index). */
function withValue(root: unknown, path: readonly (string | number)[], value: unknown): unknown {
  const copy: unknown = JSON.parse(JSON.stringify(root));
  let node: unknown = copy;
  for (const key of path.slice(0, -1))
    node = typeof node === "object" ? Reflect.get(node ?? {}, key) : null;
  const last = path[path.length - 1];
  assert.ok(typeof node === "object" && node !== null && last !== undefined, path.join("."));
  Reflect.set(node, last, value);
  return copy;
}

/** Whether a link of this text is turned away as the wrong format. */
async function turnedAway(text: string): Promise<boolean> {
  const decoded = await decodeLink(fragmentOf(await packed(text)));
  return !decoded.ok && decoded.error === SHARE_ERROR.wrongFormat;
}

test("bad link: inside parts that are null, wrong, or too many", async () => {
  assert.ok(envelope.spaces[0].placements[0], "the start places something");
  const place = ["spaces", 0, "placements", 0] as const;
  const room = ["spaces", 0, "venue", "room"] as const;
  const wrong: Array<[string, unknown]> = [
    ["null item", withValue(envelope, [...place, "item"], null)],
    ["null aim", withValue(envelope, [...place, "aim"], null)],
    ["text x", withValue(envelope, [...place, "x"], "3")],
    ["null lift", withValue(envelope, [...place, "liftIn"], null)],
    ["null room", withValue(envelope, room, null)],
    ["text room size", withValue(envelope, [...room, "widthFt"], "20")],
    ["unknown material", withValue(envelope, [...room, "materials", "front"], "lava")],
    ["null listener", withValue(envelope, ["spaces", 0, "venue", "listener"], null)],
    ["null member pose", withValue(envelope, ["stacks", 0, "members", 0, "pose"], null)],
    ["null cabinet", withValue(envelope, ["speakers", 0, "cabinet"], null)],
    ["long id", withValue(envelope, ["spaces", 0, "id"], "x".repeat(1000))],
    [
      "many placements",
      withValue(
        envelope,
        ["spaces", 0, "placements"],
        Array.from({ length: 1000 }, () => envelope.spaces[0].placements[0]),
      ),
    ],
  ];
  for (const [label, value] of wrong) {
    assert.ok(await turnedAway(JSON.stringify(value)), label);
  }
});

test("bad link: a speaker's deeper parts that are null, wrong, too many, or too deep", async () => {
  const at = (...path: (string | number)[]) => ["speakers", 0, ...path];
  const chamber = at("cabinet", "chambers", 0);
  const driver = [...chamber, "drivers", 0];
  const tall = JSON.parse(JSON.stringify(speakerEnvelopeJson));
  let nest: Record<string, unknown> = tall.speakers[0].look;
  for (let i = 0; i < 40; i++) nest = (nest.deeper = {}) as Record<string, unknown>;
  const wrong: Array<[string, unknown]> = [
    ["null chamber dims", withValue(speakerEnvelopeJson, [...chamber, "dims"], null)],
    ["text chamber width", withValue(speakerEnvelopeJson, [...chamber, "dims", "w"], "12")],
    ["null chamber spot", withValue(speakerEnvelopeJson, [...chamber, "at"], null)],
    ["null vent", withValue(speakerEnvelopeJson, [...chamber, "vent"], null)],
    ["unknown vent kind", withValue(speakerEnvelopeJson, [...chamber, "vent", "kind"], "lava")],
    ["null load", withValue(speakerEnvelopeJson, [...chamber, "load"], null)],
    ["unknown load kind", withValue(speakerEnvelopeJson, [...chamber, "load", "kind"], "lava")],
    ["null drivers", withValue(speakerEnvelopeJson, [...chamber, "drivers"], null)],
    ["unknown driver kind", withValue(speakerEnvelopeJson, [...driver, "kind"], "lava")],
    ["null driver spot", withValue(speakerEnvelopeJson, [...driver, "position"], null)],
    ["text driver count", withValue(speakerEnvelopeJson, [...driver, "count"], "2")],
    ["null driver bands", withValue(speakerEnvelopeJson, [...driver, "bands"], null)],
    ["null bracing", withValue(speakerEnvelopeJson, [...chamber, "bracing"], null)],
    ["null panel", withValue(speakerEnvelopeJson, at("cabinet", "panel"), null)],
    ["text tilt", withValue(speakerEnvelopeJson, at("cabinet", "tiltDeg"), "5")],
    ["null band", withValue(speakerEnvelopeJson, at("bands", 0), null)],
    ["text band level", withValue(speakerEnvelopeJson, at("bands", 0, "levelDb"), "-3")],
    ["null input", withValue(speakerEnvelopeJson, at("input"), null)],
    ["null look", withValue(speakerEnvelopeJson, at("look"), null)],
    ["long name", withValue(speakerEnvelopeJson, at("name"), "x".repeat(1000))],
    [
      "long text deep inside",
      withValue(speakerEnvelopeJson, at("look", "cabFinish"), "x".repeat(1000)),
    ],
    [
      "many chambers",
      withValue(
        speakerEnvelopeJson,
        at("cabinet", "chambers"),
        Array.from({ length: 100 }, () => speakerEnvelopeJson.speakers[0]?.cabinet.chambers[0]),
      ),
    ],
    ["too deep", tall],
  ];
  for (const [label, value] of wrong) {
    assert.ok(await turnedAway(JSON.stringify(value)), label);
  }
  // numbers that JSON text can carry past the finite range
  const infinite = JSON.stringify(
    withValue(speakerEnvelopeJson, at("bands", 0, "ampW"), "__INF__"),
  );
  assert.ok(await turnedAway(infinite.replace('"__INF__"', "1e999")), "infinite number");
  const key = JSON.stringify(withValue(speakerEnvelopeJson, at("look", "extra"), "__KEY__"));
  assert.ok(
    await turnedAway(key.replace('"extra":"__KEY__"', '"__proto__":{"x":1}')),
    "__proto__ key",
  );
  // a speaker link that is whole opens (a check this strict must not turn the real ones away)
  const whole = await decodeLink(fragmentOf(await packed(JSON.stringify(speakerEnvelopeJson))));
  assert.ok(whole.ok);
});

test("bad link: a stack's parts that are null or wrong", async () => {
  const wrong: Array<[string, unknown]> = [
    ["null stack", withValue(stackEnvelopeJson, ["stacks", 0], null)],
    ["text notes", withValue(stackEnvelopeJson, ["stacks", 0, "notes"], 7)],
    ["long notes", withValue(stackEnvelopeJson, ["stacks", 0, "notes"], "x".repeat(6000))],
    ["null members", withValue(stackEnvelopeJson, ["stacks", 0, "members"], null)],
    [
      "null crossover",
      withValue(stackEnvelopeJson, ["stacks", 0, "members", 0, "crossover"], null),
    ],
    ["text level", withValue(stackEnvelopeJson, ["stacks", 0, "members", 0, "levelDb"], "0")],
    ["null speaker", withValue(stackEnvelopeJson, ["speakers", 0], null)],
    ["null speaker bands", withValue(stackEnvelopeJson, ["speakers", 0, "bands"], null)],
  ];
  for (const [label, value] of wrong) {
    assert.ok(await turnedAway(JSON.stringify(value)), label);
  }
});

test("a link that passes the checks but breaks a model does not open", () => {
  // built by hand, past the checks: a driver entry that is null breaks the model, and nothing opens
  const broken = asJson(speakerEnvelope(templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay)));
  const chamber = broken.speakers[0]?.cabinet.chambers[0];
  assert.ok(chamber);
  Reflect.set(chamber, "drivers", [null]);
  assert.equal(openEnvelope(broken), null);
  // a whole one opens
  assert.ok(openEnvelope(asJson(speakerEnvelope(templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay)))));
});

test("a space link keeps the band and frequency on show", async () => {
  const view = { band: "one", freqHz: 125 } as const;
  const fragment = linkFragment(SHARE_KIND.space, await encodeLink(spaceEnvelope(START, view)));
  const decoded = await decodeLink(fragment);
  assert.ok(decoded.ok);
  assert.deepStrictEqual(decoded.envelope, asJson(spaceEnvelope(START, view)));
  const opened = openEnvelope(decoded.envelope);
  assert.ok(opened && opened.kind === SHARE_KIND.space);
  assert.deepStrictEqual(opened.view, view);
});

test("bad link: a band that is unknown, or a frequency out of range", async () => {
  const withView = asJson(spaceEnvelope(START, { band: "one", freqHz: 125 }));
  const wrong: Array<[string, unknown]> = [
    ["unknown band", withValue(withView, ["view", "band"], "bass")],
    ["number band", withValue(withView, ["view", "band"], 3)],
    ["text frequency", withValue(withView, ["view", "freqHz"], "125")],
    ["frequency too low", withValue(withView, ["view", "freqHz"], 19)],
    ["frequency too high", withValue(withView, ["view", "freqHz"], 501)],
    ["no frequency", withValue(withView, ["view", "freqHz"], undefined)],
    ["view that is null", withValue(withView, ["view"], null)],
    [
      "view on a speaker",
      {
        ...asJson(speakerEnvelope(templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay))),
        view: withView.view,
      },
    ],
  ];
  for (const [label, value] of wrong) {
    assert.ok(await turnedAway(JSON.stringify(value)), label);
  }
});

test("a space link without a band still opens, on no view", async () => {
  const decoded = await decodeLink(
    linkFragment(SHARE_KIND.space, await encodeLink(spaceEnvelope(START))),
  );
  assert.ok(decoded.ok);
  const opened = openEnvelope(decoded.envelope);
  assert.ok(opened && opened.kind === SHARE_KIND.space);
  assert.equal(opened.view, undefined);
});

const KINDS: readonly ShareKind[] = Object.values(SHARE_KIND);

test("page at an address with a share link: each kind's page", () => {
  for (const kind of KINDS) {
    assert.equal(pageAt("/", `${PAGE_HASHES[kind]}&s=1.abc`), kind);
    assert.equal(pageAt("/speaker-design/", `${PAGE_HASHES[kind]}&s=1.abc`), kind);
    assert.equal(pageAt("/", `${PAGE_HASHES[kind]}&x&s=1.abc`), kind);
    // an address made by `linkFragment` opens its kind's page
    assert.equal(pageAt("/", linkFragment(kind, "abc")), kind);
  }
  assert.equal(pageAt("/", "#unknown&s=1.abc"), "speaker");
});
