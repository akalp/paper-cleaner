import { afterEach, describe, expect, it, vi } from "vitest";

import { createId } from "./ids";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createId", () => {
  it("returns a non-empty id when crypto.randomUUID is available", () => {
    expect(typeof createId()).toBe("string");
    expect(createId().length).toBeGreaterThan(0);
  });

  it("falls back when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", { randomUUID: undefined });

    const first = createId();
    const second = createId();

    expect(first.length).toBeGreaterThan(0);
    expect(second).not.toBe(first);
  });
});
