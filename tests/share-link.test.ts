// Share links (src/lib/io/shareLink): a space goes into a link and comes back the same; a link that is cut short,
// damaged, too large or not ours says why; the Space page opens at a link's address.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  decodeLink,
  designOfEnvelope,
  encodeLink,
  linkFragment,
  shareValue,
  spaceEnvelope,
  withoutShare,
} from "../src/lib/io/shareLink";
import { pageAt } from "../src/lib/pageRoute";
import { PAGE_HASHES } from "../src/constants/pages";
import {
  SHARE_ERROR,
  SHARE_FORMAT,
  SHARE_MAX_JSON_BYTES,
  SHARE_VERSION,
} from "../src/constants/share";
import { STACK_PRESETS } from "../src/pages/stack/stackPresets";
import { STACK_START_NAMES } from "../src/constants/stackPresets";
import { spaceFromStart } from "../src/pages/space/useSpace";
import type { SpaceDesign } from "../src/types";

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
    const fragment = linkFragment(await encodeLink(spaceEnvelope(design)));
    assert.ok(fragment.startsWith(`#space&s=${SHARE_VERSION}.`));
    const decoded = await decodeLink(fragment);
    assert.ok(decoded.ok);
    assert.deepStrictEqual(decoded.envelope, asJson(spaceEnvelope(design)));
    assert.deepStrictEqual(designOfEnvelope(decoded.envelope), asJson(design));
  });
}

test("the fragment: its value, and the address without it", () => {
  assert.equal(shareValue("#space&s=1.abc"), "1.abc");
  assert.equal(shareValue("#space&x=1&s=1.abc"), "1.abc");
  assert.equal(shareValue("#space"), null);
  assert.equal(withoutShare("#space&s=1.abc"), PAGE_HASHES.space);
  assert.equal(withoutShare("#space&x=1&s=1.abc"), "#space&x=1");
  assert.equal(withoutShare("#space"), "#space");
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

test("bad link: not a shared space", async () => {
  const wrong: unknown[] = [
    [],
    "text",
    { ...envelope, format: "other" },
    { ...envelope, kind: "speaker" },
    { ...envelope, speakers: {} },
    { ...envelope, stacks: [1] },
    { ...envelope, spaces: [] },
    { ...envelope, spaces: [{ id: "x" }] },
    { format: SHARE_FORMAT, version: SHARE_VERSION },
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

test("page at an address with a share link: the Space page", () => {
  assert.equal(pageAt("/", "#space&s=1.abc"), "space");
  assert.equal(pageAt("/speaker-design/", "#space&s=1.abc"), "space");
  assert.equal(pageAt("/", "#space&x&s=1.abc"), "space");
  assert.equal(pageAt("/", "#stack&s=1.abc"), "stack");
  assert.equal(pageAt("/", "#unknown&s=1.abc"), "speaker");
});
