import { describe, expect, it } from "vitest"

import {
  detectFormat,
  parseSubtitles,
  exportBilingualSrt,
  exportBilingualVtt,
  parseMarkdown,
  parseHtml,
  detectDocumentFormat,
  parseDocument,
  exportMarkdownBilingual,
  formatLabel,
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

  describe("parseMarkdown", () => {
    it("splits by double newlines", () => {
      const entries = parseMarkdown("First paragraph\n\nSecond paragraph\n\nThird paragraph")
      expect(entries).toHaveLength(3)
      expect(entries[0]).toEqual({ index: 1, text: "First paragraph" })
      expect(entries[1]).toEqual({ index: 2, text: "Second paragraph" })
      expect(entries[2]).toEqual({ index: 3, text: "Third paragraph" })
    })

    it("trims whitespace and skips empty blocks", () => {
      const entries = parseMarkdown("  Hello  \n\n\n\n  World  ")
      expect(entries).toHaveLength(2)
      expect(entries[0].text).toBe("Hello")
      expect(entries[1].text).toBe("World")
    })

    it("returns empty array for empty content", () => {
      expect(parseMarkdown("")).toHaveLength(0)
      expect(parseMarkdown("   \n\n   ")).toHaveLength(0)
    })

    it("keeps single-line content as one entry", () => {
      const entries = parseMarkdown("Just one line")
      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual({ index: 1, text: "Just one line" })
    })
  })

  describe("parseHtml", () => {
    it("strips tags and splits by block elements", () => {
      const entries = parseHtml("<p>Hello</p><p>World</p>")
      expect(entries).toHaveLength(2)
      expect(entries[0].text).toBe("Hello")
      expect(entries[1].text).toBe("World")
    })

    it("handles headings and divs", () => {
      const entries = parseHtml("<h1>Title</h1><div>Content here</div>")
      expect(entries).toHaveLength(2)
      expect(entries[0].text).toBe("Title")
      expect(entries[1].text).toBe("Content here")
    })

    it("decodes HTML entities", () => {
      const entries = parseHtml("<p>A &amp; B &lt; C &gt; D</p>")
      expect(entries[0].text).toBe("A & B < C > D")
    })
  })

  describe("detectDocumentFormat", () => {
    it("detects .md as markdown", () => {
      expect(detectDocumentFormat("file.md")).toBe("markdown")
    })

    it("detects .markdown as markdown", () => {
      expect(detectDocumentFormat("README.markdown")).toBe("markdown")
    })

    it("detects .txt as txt", () => {
      expect(detectDocumentFormat("notes.txt")).toBe("txt")
    })

    it("detects .html as html", () => {
      expect(detectDocumentFormat("page.html")).toBe("html")
    })

    it("detects .htm as html", () => {
      expect(detectDocumentFormat("page.htm")).toBe("html")
    })

    it("returns undefined for subtitle files", () => {
      expect(detectDocumentFormat("sub.srt")).toBeUndefined()
      expect(detectDocumentFormat("sub.vtt")).toBeUndefined()
    })
  })

  describe("parseDocument", () => {
    it("delegates to parseMarkdown for markdown format", () => {
      const entries = parseDocument("A\n\nB", "markdown")
      expect(entries).toHaveLength(2)
    })

    it("delegates to parseMarkdown for txt format", () => {
      const entries = parseDocument("A\n\nB", "txt")
      expect(entries).toHaveLength(2)
    })

    it("delegates to parseHtml for html format", () => {
      const entries = parseDocument("<p>A</p><p>B</p>", "html")
      expect(entries).toHaveLength(2)
    })
  })

  describe("exportMarkdownBilingual", () => {
    it("formats original with blockquote translation", () => {
      const entries = [
        { index: 1, text: "Hello world" },
        { index: 2, text: "Goodbye" },
      ]
      const translations = new Map([[0, "你好世界"], [1, "再见"]])
      const result = exportMarkdownBilingual(entries, translations)
      expect(result).toBe("Hello world\n\n> 你好世界\n\nGoodbye\n\n> 再见")
    })

    it("omits blockquote when translation is missing", () => {
      const entries = [{ index: 1, text: "Hello" }]
      const translations = new Map<number, string>()
      const result = exportMarkdownBilingual(entries, translations)
      expect(result).toBe("Hello")
    })
  })

  describe("formatLabel", () => {
    it("returns correct labels", () => {
      expect(formatLabel("srt")).toBe("SRT")
      expect(formatLabel("vtt")).toBe("VTT")
      expect(formatLabel("ass")).toBe("ASS")
      expect(formatLabel("markdown")).toBe("Markdown")
      expect(formatLabel("txt")).toBe("Plain text")
      expect(formatLabel("html")).toBe("HTML document")
      expect(formatLabel("unknown")).toBe("Unknown")
    })
  })
})
