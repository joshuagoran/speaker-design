import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_HIFI, DEFAULT_PORT_SIZE } from "../src/lib/defaults";

describe("default designs", () => {
  it("the Hi-fi round port starts at the diameter the port toggle falls back to", () => {
    expect(DEFAULT_HIFI.portSpec.dia).toBe(DEFAULT_PORT_SIZE.dia);
  });
});
