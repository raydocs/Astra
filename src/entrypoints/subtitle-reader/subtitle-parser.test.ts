import { describe, expect, it } from "vitest"

import {
  detectFormat,
  parseSubtitles,
  exportBilingualSrt,
  exportBilingualVtt,
} from "./subtitle-parser"

describe("subtitle-parser", () => {
  describe("detectFormat", () => {
    it("detects SRT format", () => {
      expect(detectFormat("1\n00:00:01,000 --> 00:00:02,000\nHello")).toBe("srt")
    })

    it("detects VTT format", () => {
      expect(detectFormat("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello")).toBe("vtt")
    })

    it("detects ASS format", () => {
      expect(detectFormat("[Script Info]\nTitle: Test")).toBe("ass")
    })

    it("returns unknown for unrecognized", () => {
      expect(detectFormat("random text")).toBe("unknown")
    })
  })

  describe("parseSrt", () => {
    it("parses standard SRT cues", () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
How are you?`

      const { format, cues } = parseSubtitles(srt)
      expect(format).toBe("srt")
      expect(cues).toHaveLength(2)
      expect(cues[0].text).toBe("Hello world")
      expect(cues[0].startTime).toBe("00:00:01,000")
      expect(cues[1].text).toBe("How are you?")
    })

    it("handles multi-line cues", () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Line one
Line two`

      const { cues } = parseSubtitles(srt)
      expect(cues[0].text).toBe("Line one\nLine two")
    })
  })

  describe("parseVtt", () => {
    it("parses VTT with header", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.000
Goodbye`

      const { format, cues } = parseSubtitles(vtt)
      expect(format).toBe("vtt")
      expect(cues).toHaveLength(2)
      expect(cues[0].text).toBe("Hello world")
    })
  })

  describe("parseAss", () => {
    it("parses ASS dialogue lines", () => {
      const ass = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello world
Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,{\\b1}Bold text{\\b0}`

      const { format, cues } = parseSubtitles(ass)
      expect(format).toBe("ass")
      expect(cues).toHaveLength(2)
      expect(cues[0].text).toBe("Hello world")
      expect(cues[1].text).toBe("Bold text")  // Formatting tags stripped
    })
  })

  describe("export", () => {
    it("exports bilingual SRT", () => {
      const cues = [
        { index: 1, startTime: "00:00:01,000", endTime: "00:00:04,000", text: "Hello", rawTimeline: "" },
      ]
      const translations = new Map([[0, "你好"]])
      const result = exportBilingualSrt(cues, translations)
      expect(result).toContain("Hello\n你好")
      expect(result).toContain("00:00:01,000 --> 00:00:04,000")
    })

    it("exports bilingual VTT", () => {
      const cues = [
        { index: 1, startTime: "00:00:01.000", endTime: "00:00:04.000", text: "Hello", rawTimeline: "" },
      ]
      const translations = new Map([[0, "你好"]])
      const result = exportBilingualVtt(cues, translations)
      expect(result).toMatch(/^WEBVTT/)
      expect(result).toContain("Hello\n你好")
    })
  })
})
