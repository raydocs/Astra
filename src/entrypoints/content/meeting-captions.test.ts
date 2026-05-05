import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { runInlineActionMock, readConfigMock } = vi.hoisted(() => ({
  runInlineActionMock: vi.fn(),
  readConfigMock: vi.fn(),
}))

vi.mock("./inline-actions", () => ({
  runInlineAction: runInlineActionMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import {
  getMeetingCaptionQualitySnapshot,
  isMeetingCaptionTranslationActive,
  isMeetingPage,
  startMeetingCaptionTranslation,
  stopMeetingCaptionTranslation,
} from "./meeting-captions"

function setLocation(hostname: string, pathname = "/") {
  Object.defineProperty(window, "location", {
    value: {
      hostname,
      pathname,
      href: `https://${hostname}${pathname}`,
    },
    writable: true,
    configurable: true,
  })
}

async function flushPromises(count = 4) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe("meeting caption translation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    runInlineActionMock.mockResolvedValue({ ok: true, text: "会议翻译" })
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  afterEach(() => {
    stopMeetingCaptionTranslation()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("detects supported meeting pages", () => {
    setLocation("meet.google.com")
    expect(isMeetingPage()).toBe(true)

    setLocation("example.com")
    expect(isMeetingPage()).toBe(false)
  })

  it("reports a read-only QC snapshot for active Google Meet captions", async () => {
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Hello team</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    expect(getMeetingCaptionQualitySnapshot()).toEqual(expect.objectContaining({
      surface: "meeting",
      active: true,
      platform: "google-meet",
      pipeline: "google-meet-dom",
      source: "dom",
      status: "ready",
      translatedNodeCount: 1,
      sourceTextLength: "Hello team".length,
      pendingRequestCount: 0,
      cacheSize: 1,
    }))
  })

  it("injects translated Google Meet captions with default presentation metadata", async () => {
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Hello team</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const caption = document.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(caption?.textContent).toBe("会议翻译")
    expect(caption?.dataset.astraPresentationMode).toBe("bilingual")
    expect(caption?.dataset.astraPresentationTheme).toBe("default")
    expect(caption?.style.getPropertyValue("--astra-caption-font-size")).toBe("")
    expect(caption?.style.getPropertyValue("--astra-caption-color")).toBe("")
    expect(isMeetingCaptionTranslationActive()).toBe(true)
  })

  it("waits for delayed caption container materialization after start", async () => {
    setLocation("meet.google.com")

    const startPromise = startMeetingCaptionTranslation()
    await flushPromises()

    expect(runInlineActionMock).not.toHaveBeenCalled()

    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Delayed caption</div>
      </div>
    `

    await expect(startPromise).resolves.toBe(true)
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Delayed caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })
    expect(document.querySelector(".astra-meeting-caption")?.textContent).toBe("会议翻译")
  })

  it("applies site presentation overrides to injected meeting captions", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        fontSize: 1.05,
        translationColor: "#111827",
      },
      sites: {
        "meet.google.com": {
          enabled: true,
          alwaysTranslate: false,
          presentation: {
            mode: "translation-only",
            theme: "underline",
            fontSize: 1.2,
            translationColor: "#22c55e",
          },
        },
      },
    })
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Hello team</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const caption = document.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(caption?.dataset.astraPresentationMode).toBe("translation-only")
    expect(caption?.dataset.astraPresentationTheme).toBe("underline")
    expect(caption?.style.getPropertyValue("--astra-caption-font-size")).toBe("1.2em")
    expect(caption?.style.getPropertyValue("--astra-caption-color")).toBe("#22c55e")
  })

  it("falls back to translating the caption container when no child caption nodes exist", async () => {
    setLocation("app.zoom.us")
    document.body.innerHTML = `<div class="closed-caption__container">Hello everyone</div>`

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const container = document.querySelector<HTMLElement>(".closed-caption__container")
    const caption = container?.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(caption?.textContent).toBe("会议翻译")
    expect(caption?.getAttribute("data-source")).toBe("Hello everyone")
  })

  it("supports Zoom caption-host class variant fallback", async () => {
    setLocation("app.zoom.us")
    document.body.innerHTML = `
      <div class="zm-caption-host active">
        <div>Zoom variant caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Zoom variant caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })
    expect(document.querySelector(".astra-meeting-caption")?.textContent).toBe("会议翻译")
  })

  it("coalesces rapid caption churn and skips unchanged translated text", async () => {
    vi.useFakeTimers()
    setLocation("meet.google.com")
    document.body.innerHTML = `<div class="a4cQT"></div>`

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    expect(runInlineActionMock).not.toHaveBeenCalled()

    const container = document.querySelector<HTMLElement>(".a4cQT")!
    const line = document.createElement("div")
    container.appendChild(line)
    line.textContent = "He"
    line.textContent = "Hello"
    line.textContent = "Hello team"

    await flushPromises()
    await vi.advanceTimersByTimeAsync(49)
    expect(runInlineActionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises(6)
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Hello team",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })

    runInlineActionMock.mockClear()
    line.firstChild!.textContent = "Hello team"
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60)
    await flushPromises(6)

    expect(runInlineActionMock).not.toHaveBeenCalled()
  })

  it("injects cached caption hits before the debounce timer", async () => {
    vi.useFakeTimers()
    setLocation("meet.google.com")
    document.body.innerHTML = `<div class="a4cQT"></div>`

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)

    const container = document.querySelector<HTMLElement>(".a4cQT")!
    const firstLine = document.createElement("div")
    firstLine.textContent = "Repeated caption"
    container.appendChild(firstLine)

    await flushPromises()
    await vi.advanceTimersByTimeAsync(50)
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(firstLine.querySelector<HTMLElement>(".astra-meeting-caption")?.textContent).toBe("会议翻译")

    runInlineActionMock.mockClear()
    firstLine.remove()

    const secondLine = document.createElement("div")
    secondLine.textContent = "Repeated caption"
    container.appendChild(secondLine)

    await flushPromises()

    const cachedCaption = secondLine.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(cachedCaption?.textContent).toBe("会议翻译")
    expect(cachedCaption?.getAttribute("data-source")).toBe("Repeated caption")
    expect(runInlineActionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(49)
    await flushPromises()
    expect(runInlineActionMock).not.toHaveBeenCalled()
  })

  it("uses the current source text cache key when a caption element is rapidly reused", async () => {
    vi.useFakeTimers()
    runInlineActionMock.mockImplementation(async ({ text }: { text: string }) => ({
      ok: true,
      text: text === "Alpha caption" ? "阿尔法翻译" : "贝塔翻译",
    }))
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Alpha caption</div>
        <div>Beta caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const [alphaLine, betaLine] = [...document.querySelectorAll<HTMLElement>(".a4cQT > div")]
    expect(runInlineActionMock).toHaveBeenCalledTimes(2)
    expect(alphaLine.querySelector<HTMLElement>(".astra-meeting-caption")?.textContent).toBe("阿尔法翻译")
    expect(betaLine.querySelector<HTMLElement>(".astra-meeting-caption")?.textContent).toBe("贝塔翻译")

    betaLine.remove()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60)
    await flushPromises(6)
    runInlineActionMock.mockClear()

    alphaLine.firstChild!.textContent = "Transient uncached caption"
    alphaLine.firstChild!.textContent = "Beta caption"
    await flushPromises()

    const reusedCaption = alphaLine.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(reusedCaption?.textContent).toBe("贝塔翻译")
    expect(reusedCaption?.getAttribute("data-source")).toBe("Beta caption")
    expect(alphaLine.textContent).not.toContain("阿尔法翻译")
    expect(runInlineActionMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(50)
    await flushPromises(6)
    expect(runInlineActionMock).not.toHaveBeenCalled()
  })

  it("ignores Astra-injected-only mutations without reprocessing or reinserting", async () => {
    vi.useFakeTimers()
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Repeated caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const line = document.querySelector<HTMLElement>(".a4cQT > div")!
    const injectedCaption = line.querySelector<HTMLElement>(".astra-meeting-caption")!
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(injectedCaption.textContent).toBe("会议翻译")

    runInlineActionMock.mockClear()
    injectedCaption.remove()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(60)
    await flushPromises(6)

    expect(runInlineActionMock).not.toHaveBeenCalled()
    expect(line.querySelector(".astra-meeting-caption")).toBeNull()
  })

  it("processes mixed Astra-only and real caption mutations in the same batch", async () => {
    vi.useFakeTimers()
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Initial caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)

    const line = document.querySelector<HTMLElement>(".a4cQT > div")!
    const injectedCaption = line.querySelector<HTMLElement>(".astra-meeting-caption")!
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)

    runInlineActionMock.mockClear()
    line.firstChild!.textContent = "Updated caption"
    injectedCaption.remove()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(50)
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Updated caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })
    expect(line.querySelector(".astra-meeting-caption")?.getAttribute("data-source")).toBe(
      "Updated caption",
    )
  })

  it("rebinds when the meeting caption container is replaced", async () => {
    vi.useFakeTimers()
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Initial caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises(6)
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)

    runInlineActionMock.mockClear()
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Replacement caption</div>
      </div>
    `

    await flushPromises()
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises(6)

    const replacement = document.querySelector<HTMLElement>(".a4cQT")!
    const caption = replacement.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Replacement caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })
    expect(caption?.textContent).toBe("会议翻译")
  })

  it("does not inject stale translations when caption text changes before response", async () => {
    vi.useFakeTimers()
    const deferred = createDeferred<{ ok: true; text: string }>()
    runInlineActionMock.mockReturnValueOnce(deferred.promise)
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Hello team</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises()
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)

    const line = document.querySelector<HTMLElement>(".a4cQT > div")!
    line.textContent = "Goodbye team"
    await flushPromises()
    deferred.resolve({ ok: true, text: "旧翻译" })
    await flushPromises(6)

    expect(document.querySelector(".astra-meeting-caption")).toBeNull()

    await vi.advanceTimersByTimeAsync(60)
    await flushPromises(6)
    const caption = document.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(runInlineActionMock).toHaveBeenCalledTimes(2)
    expect(caption?.getAttribute("data-source")).toBe("Goodbye team")
  })

  it("keeps newest caption translation when overlapping requests resolve out of order", async () => {
    vi.useFakeTimers()
    const alphaDeferred = createDeferred<{ ok: true; text: string }>()
    const betaDeferred = createDeferred<{ ok: true; text: string }>()
    runInlineActionMock.mockImplementation(({ text }: { text: string }) => {
      if (text === "Alpha caption") return alphaDeferred.promise
      if (text === "Beta caption") return betaDeferred.promise
      return Promise.resolve({ ok: true, text: "unexpected translation" })
    })
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Alpha caption</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises()
    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(runInlineActionMock).toHaveBeenCalledWith({
      text: "Alpha caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })

    const line = document.querySelector<HTMLElement>(".a4cQT > div")!
    line.firstChild!.textContent = "Beta caption"
    await flushPromises()
    await vi.advanceTimersByTimeAsync(50)
    await flushPromises()

    expect(runInlineActionMock).toHaveBeenCalledTimes(2)
    expect(runInlineActionMock).toHaveBeenLastCalledWith({
      text: "Beta caption",
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    })

    betaDeferred.resolve({ ok: true, text: "贝塔翻译" })
    await flushPromises(6)

    const newestCaption = line.querySelector<HTMLElement>(".astra-meeting-caption")
    expect(newestCaption?.textContent).toBe("贝塔翻译")
    expect(newestCaption?.getAttribute("data-source")).toBe("Beta caption")

    alphaDeferred.resolve({ ok: true, text: "阿尔法翻译" })
    await flushPromises(6)

    const finalCaptions = [...line.querySelectorAll<HTMLElement>(".astra-meeting-caption")]
    expect(finalCaptions).toHaveLength(1)
    expect(finalCaptions[0]?.textContent).toBe("贝塔翻译")
    expect(finalCaptions[0]?.getAttribute("data-source")).toBe("Beta caption")
    expect(line.textContent).not.toContain("阿尔法翻译")
  })

  it("cleans observers, debounced work, pending injections, and styles on stop", async () => {
    vi.useFakeTimers()
    const deferred = createDeferred<{ ok: true; text: string }>()
    runInlineActionMock.mockReturnValueOnce(deferred.promise)
    setLocation("meet.google.com")
    document.body.innerHTML = `
      <div class="a4cQT">
        <div>Hello team</div>
      </div>
    `

    await expect(startMeetingCaptionTranslation()).resolves.toBe(true)
    await flushPromises()
    expect(document.getElementById("astra-meeting-caption-styles")).not.toBeNull()

    const line = document.querySelector<HTMLElement>(".a4cQT > div")!
    line.textContent = "Queued caption"
    await flushPromises()

    stopMeetingCaptionTranslation()
    expect(isMeetingCaptionTranslationActive()).toBe(false)
    expect(document.getElementById("astra-meeting-caption-styles")).toBeNull()

    await vi.advanceTimersByTimeAsync(100)
    deferred.resolve({ ok: true, text: "会议翻译" })
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledTimes(1)
    expect(document.querySelector(".astra-meeting-caption")).toBeNull()
  })
})
