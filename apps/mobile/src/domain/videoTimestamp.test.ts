import { describe, expect, it } from "vitest"

import { buildVideoTimestampUrl } from "./videoTimestamp"

describe("buildVideoTimestampUrl", () => {
  it("uses the YouTube ?t=Ns form for youtube.com and youtu.be", () => {
    expect(buildVideoTimestampUrl("https://www.youtube.com/watch?v=abc123", 165_000)).toBe("https://www.youtube.com/watch?v=abc123&t=165s")
    expect(buildVideoTimestampUrl("https://youtu.be/abc123", 165_000)).toBe("https://youtu.be/abc123?t=165s")
  })

  it("uses plain ?t=seconds for non-YouTube video hosts", () => {
    expect(buildVideoTimestampUrl("https://www.bilibili.com/video/BV1xx", 90_000)).toBe("https://www.bilibili.com/video/BV1xx?t=90")
  })

  it("floors milliseconds to whole seconds and clamps negatives to 0", () => {
    expect(buildVideoTimestampUrl("https://www.bilibili.com/v/1", 4_999)).toBe("https://www.bilibili.com/v/1?t=4")
    expect(buildVideoTimestampUrl("https://www.bilibili.com/v/1", -50)).toBe("https://www.bilibili.com/v/1?t=0")
  })

  it("returns the base URL unchanged when it cannot be parsed", () => {
    expect(buildVideoTimestampUrl("not a url", 10_000)).toBe("not a url")
  })
})
