import { describe, expect, it } from "vitest"

import type { MobileAstraSession } from "../api/astraClient"
import { DEFAULT_MOBILE_APP_STATE, type MobileAppState } from "../state/mobileAppState"
import { deriveMobileMembershipDisplay } from "./mobileMembership"

function session(patch: Partial<MobileAstraSession> = {}): MobileAstraSession {
  return {
    version: 1,
    sessionToken: "session-token-test",
    sessionId: "session-test",
    deviceId: "device-test",
    identityMode: "authenticated",
    relayBaseURL: "https://example.invalid/v1",
    email: "learner@example.com",
    plan: "free",
    subscriptionStatus: "active",
    expiresAt: "2026-06-28T12:00:00.000Z",
    ...patch,
  }
}

function state(patch: Partial<MobileAppState> = {}): MobileAppState {
  return {
    ...DEFAULT_MOBILE_APP_STATE,
    sampleDeck: false,
    message: "",
    ...patch,
  }
}

describe("mobile membership display", () => {
  it("shows safe Pro active copy", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "pro", subscriptionStatus: "active" }), syncStatus: "ready" }))

    expect(display.label).toBe("Pro active")
    expect(display.copy).toContain("Pro is active")
    expect(display.benefits).toContain("Cross-device sync")
  })

  it("shows trial status before generic pro/free copy", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "trial", subscriptionStatus: "trialing" }), syncStatus: "ready" }))

    expect(display.label).toBe("Trial")
    expect(display.copy).toContain("Trial access is active")
  })

  it("shows free plan copy", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "free", subscriptionStatus: "active" }), syncStatus: "ready" }))

    expect(display.label).toBe("Free")
    expect(display.copy).toContain("free plan")
  })

  it("keeps saved-card reassurance for canceled or expired membership", () => {
    for (const subscriptionStatus of ["canceled", "expired"]) {
      const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "pro", subscriptionStatus }), syncStatus: "ready" }))

      expect(display.label).toBe("Sync paused")
      expect(display.copy).toContain("Your saved cards are safe")
    }
  })

  it("does not treat session expiry as membership expiry", () => {
    const display = deriveMobileMembershipDisplay(state({
      session: session({ plan: "pro", subscriptionStatus: "unknown", expiresAt: "2026-05-01T12:00:00.000Z" }),
      syncStatus: "ready",
    }))

    expect(display.label).toBe("Signed in")
    expect(display.copy).toContain("Your saved cards stay available")
  })

  it("shows sync paused for offline signed-in state", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "pro", subscriptionStatus: "active" }), syncStatus: "offline" }))

    expect(display.label).toBe("Sync paused")
    expect(display.copy).toContain("catch up when sync is ready again")
  })

  it("falls back safely for unknown signed-in status", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "mystery", subscriptionStatus: "unknown" }), syncStatus: "ready" }))

    expect(display.label).toBe("Signed in")
    expect(display.copy).toContain("Your saved cards stay available")
  })

  it("shows sample review or sign-in-needed copy without a session", () => {
    expect(deriveMobileMembershipDisplay(state({ session: null, sampleDeck: true })).label).toBe("Sample review")
    expect(deriveMobileMembershipDisplay(state({ session: null, sampleDeck: false })).label).toBe("Sign in needed")
  })

  it("does not expose technical account or service language", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ plan: "pro", subscriptionStatus: "active" }), syncStatus: "ready" }))
    const text = [display.label, display.copy, ...display.benefits].join(" ").toLowerCase()

    expect(text).not.toMatch(/provider|model|quota|token|relay|api key|backend|route|checkout|subscribe|purchase|upgrade/)
  })

  it("does not expose the signed-in email address in membership copy", () => {
    const display = deriveMobileMembershipDisplay(state({ session: session({ email: "private.learner@example.com", plan: "pro", subscriptionStatus: "active" }), syncStatus: "ready" }))
    const text = [display.label, display.copy, ...display.benefits].join(" ")

    expect(text).not.toContain("private.learner@example.com")
    expect(display.copy).toContain("your Astra account")
  })
})
