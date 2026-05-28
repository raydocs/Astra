import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_SUBTITLE_QUALITY_CONTROLS } from "@/types/config"

import TranslationStatusCard, { suggestSubtitleQualityPreset } from "./TranslationStatusCard"

const progress = {
  totalBlocks: 0,
  queuedBlocks: 0,
  inFlightBlocks: 0,
  translatedBlocks: 0,
  failedBlocks: 0,
}

describe("TranslationStatusCard", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.useRealTimers()
  })

  it("suggests local subtitle QC presets for live, standard, and saver conditions", () => {
    const baseSubtitleQuality = {
      surface: "video" as const,
      active: true,
      platform: "youtube",
      pipeline: "youtube-hybrid",
      source: "timedtext",
      status: "observing",
      anomalies: [],
      translatedNodeCount: 1,
      sourceTextLength: 18,
      pendingRequestCount: 0,
      cacheSize: 4,
      capturedAt: Date.now(),
    }
    const controls = {
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      popupPollIntervalMs: 1500,
      freshnessThresholdMs: 5000,
      adaptivePresetAutoSwitchEnabled: false,
      adaptivePresetCooldownMs: 30_000,
      adaptivePresetManualOverrideLocked: false,
      adaptivePresetName: "standard" as const,
    }

    expect(suggestSubtitleQualityPreset({
      ...baseSubtitleQuality,
      pendingRequestCount: 1,
    }, 1000, controls).name).toBe("live")
    expect(suggestSubtitleQualityPreset(baseSubtitleQuality, 1000, controls).name).toBe("standard")
    expect(suggestSubtitleQualityPreset({
      ...baseSubtitleQuality,
      status: "ready",
      cacheSize: 8,
    }, 1000, controls).name).toBe("saver")
  })

  it("renders membership-safe copy for translation errors", async () => {
    await act(async () => {
      root.render(
        <TranslationStatusCard
          phase="idle"
          targetLang="zh-CN"
          presentation={{ mode: "bilingual", theme: "default" }}
          hostname="example.com"
          progress={progress}
          lastError={{ code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" }}
          siteEnabled
        />,
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Your membership is active. Astra is reconnecting.")
    expect(container.textContent).not.toContain("Relay unavailable")
  })

  it("renders configurable subtitle QC details", async () => {
    const onSubtitleQualityControlsChange = vi.fn()
    const onSubtitleDiagnosticsExport = vi.fn()
    const capturedAt = Date.now() - 2000

    await act(async () => {
      root.render(
        <TranslationStatusCard
          phase="idle"
          targetLang="zh-CN"
          presentation={{ mode: "bilingual", theme: "default" }}
          hostname="youtube.com"
          progress={progress}
          lastError={null}
          siteEnabled
          subtitleQualityControls={{
            ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
            popupPollIntervalMs: 2250,
            freshnessThresholdMs: 1000,
            adaptivePresetAutoSwitchEnabled: false,
            adaptivePresetCooldownMs: 30_000,
            adaptivePresetManualOverrideLocked: false,
            adaptivePresetName: "standard",
          }}
          subtitleQualityTrend={[
            { capturedAt: capturedAt - 2000, freshnessMs: 4000, pendingRequestCount: 2, cacheSize: 1 },
            { capturedAt: capturedAt - 1000, freshnessMs: 3000, pendingRequestCount: 1, cacheSize: 3 },
            { capturedAt, freshnessMs: 2000, pendingRequestCount: 0, cacheSize: 4 },
          ]}
          onSubtitleQualityControlsChange={onSubtitleQualityControlsChange}
          onSubtitleDiagnosticsExport={onSubtitleDiagnosticsExport}
          subtitleDiagnosticsExportStatus="Diagnostics JSON exported locally."
          subtitleQuality={{
            surface: "video",
            active: true,
            platform: "youtube",
            pipeline: "youtube-hybrid",
            source: "timedtext",
            status: "ready",
            anomalies: ["duplicated-cue", "fallback-route"],
            translatedNodeCount: 1,
            sourceTextLength: 18,
            pendingRequestCount: 0,
            cacheSize: 4,
            capturedAt,
          }}
        />,
      )
      await Promise.resolve()
    })

    const panel = container.querySelector('[data-testid="subtitle-qc-panel"]')
    expect(panel?.textContent).toContain("video · youtube")
    expect(panel?.textContent).toContain("youtube-hybrid / timedtext")
    expect(panel?.textContent).toContain("ready · 2s old")
    expect(panel?.textContent).toContain("overlays 1")
    expect(panel?.textContent).toContain("Poll interval (ms)")
    expect(panel?.textContent).toContain("Fresh threshold (ms)")
    expect(panel?.textContent).toContain("Auto-switch presets")
    expect(container.querySelector('[data-testid="subtitle-qc-auto-switch-status"]')?.textContent).toContain("Auto-switch off")
    expect(container.querySelector('[data-testid="subtitle-qc-auto-switch-status"]')?.textContent).toContain("cooldown 30s")
    expect(container.querySelector('[data-testid="subtitle-qc-trend-freshness"]')?.textContent).toContain("2s")
    expect(container.querySelector('[data-testid="subtitle-qc-trend-pending"]')?.textContent).toContain("0")
    expect(container.querySelector('[data-testid="subtitle-qc-trend-cache"]')?.textContent).toContain("4")
    expect(container.querySelector('[data-testid="subtitle-qc-preset-suggestion"]')?.textContent).toContain("Suggested local preset")
    expect(container.querySelector('[data-testid="subtitle-qc-preset-suggestion"]')?.textContent).toContain("live")
    expect(panel?.textContent).toContain("Anomalies: duplicated-cue, fallback-route")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("snapshot 2s old")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("Remediation:")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("Check QC faster")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("Export diagnostics")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-jitter"]')?.textContent).toContain("duplicated-cue")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-jitter"]')?.textContent).toContain("Sample QC slower")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-fallback"]')?.textContent).toContain("fallback-route")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-fallback"]')?.textContent).toContain("Widen fresh window")
    expect(panel?.textContent).toContain("Export local diagnostics JSON")
    expect(panel?.textContent).toContain("Diagnostics JSON exported locally.")

    const pollInput = container.querySelector('input[aria-label="Subtitle QC poll interval"]') as HTMLInputElement | null
    const freshnessInput = container.querySelector('input[aria-label="Subtitle QC freshness threshold"]') as HTMLInputElement | null
    expect(pollInput?.value).toBe("2250")
    expect(freshnessInput?.value).toBe("1000")

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-latency-control"]') as HTMLButtonElement).click()
    })
    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      popupPollIntervalMs: 2000,
      adaptivePresetManualOverrideLocked: true,
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-jitter-control"]') as HTMLButtonElement).click()
    })
    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      popupPollIntervalMs: 2750,
      adaptivePresetManualOverrideLocked: true,
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-fallback-control"]') as HTMLButtonElement).click()
    })
    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      freshnessThresholdMs: 6000,
      adaptivePresetManualOverrideLocked: true,
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-preset-apply"]') as HTMLButtonElement).click()
    })
    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      popupPollIntervalMs: 750,
      freshnessThresholdMs: 2500,
      adaptivePresetName: "live",
      adaptivePresetManualOverrideLocked: true,
    })

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      valueSetter?.call(pollInput, "3000")
      pollInput!.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      popupPollIntervalMs: 3000,
      adaptivePresetManualOverrideLocked: true,
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-auto-switch-toggle"]') as HTMLInputElement).click()
    })
    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      adaptivePresetAutoSwitchEnabled: true,
      adaptivePresetManualOverrideLocked: false,
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-latency-export"]') as HTMLButtonElement).click()
    })

    expect(onSubtitleDiagnosticsExport).toHaveBeenCalledTimes(1)

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-export-diagnostics"]') as HTMLButtonElement).click()
    })

    expect(onSubtitleDiagnosticsExport).toHaveBeenCalledTimes(2)
  })

  it("auto-applies adaptive local presets only when opted in, cooldown is ready, and manual lock is off", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(60_000)
    const onSubtitleQualityControlsChange = vi.fn()
    const readySubtitleQuality = {
      surface: "video" as const,
      active: true,
      platform: "youtube",
      pipeline: "youtube-hybrid",
      source: "timedtext",
      status: "ready",
      anomalies: [],
      translatedNodeCount: 1,
      sourceTextLength: 18,
      pendingRequestCount: 0,
      cacheSize: 8,
      capturedAt: Date.now(),
    }

    await act(async () => {
      root.render(
        <TranslationStatusCard
          phase="idle"
          targetLang="zh-CN"
          presentation={{ mode: "bilingual", theme: "default" }}
          hostname="youtube.com"
          progress={progress}
          lastError={null}
          siteEnabled
          subtitleQualityControls={{
            ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
            adaptivePresetAutoSwitchEnabled: true,
            adaptivePresetCooldownMs: 30_000,
            adaptivePresetLastAppliedAt: 0,
            adaptivePresetManualOverrideLocked: false,
            adaptivePresetName: "standard",
          }}
          onSubtitleQualityControlsChange={onSubtitleQualityControlsChange}
          subtitleQuality={readySubtitleQuality}
        />,
      )
      await Promise.resolve()
    })

    expect(onSubtitleQualityControlsChange).toHaveBeenCalledWith({
      popupPollIntervalMs: 5000,
      freshnessThresholdMs: 15000,
      adaptivePresetName: "saver",
      adaptivePresetLastAppliedAt: 60_000,
    })

    onSubtitleQualityControlsChange.mockClear()
    await act(async () => {
      root.render(
        <TranslationStatusCard
          phase="idle"
          targetLang="zh-CN"
          presentation={{ mode: "bilingual", theme: "default" }}
          hostname="youtube.com"
          progress={progress}
          lastError={null}
          siteEnabled
          subtitleQualityControls={{
            ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
            adaptivePresetAutoSwitchEnabled: true,
            adaptivePresetCooldownMs: 30_000,
            adaptivePresetLastAppliedAt: 45_000,
            adaptivePresetManualOverrideLocked: false,
            adaptivePresetName: "standard",
          }}
          onSubtitleQualityControlsChange={onSubtitleQualityControlsChange}
          subtitleQuality={readySubtitleQuality}
        />,
      )
      await Promise.resolve()
    })
    expect(onSubtitleQualityControlsChange).not.toHaveBeenCalled()

    await act(async () => {
      root.render(
        <TranslationStatusCard
          phase="idle"
          targetLang="zh-CN"
          presentation={{ mode: "bilingual", theme: "default" }}
          hostname="youtube.com"
          progress={progress}
          lastError={null}
          siteEnabled
          subtitleQualityControls={{
            ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
            adaptivePresetAutoSwitchEnabled: true,
            adaptivePresetCooldownMs: 30_000,
            adaptivePresetLastAppliedAt: 0,
            adaptivePresetManualOverrideLocked: true,
            adaptivePresetName: "standard",
          }}
          onSubtitleQualityControlsChange={onSubtitleQualityControlsChange}
          subtitleQuality={readySubtitleQuality}
        />,
      )
      await Promise.resolve()
    })
    expect(onSubtitleQualityControlsChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
