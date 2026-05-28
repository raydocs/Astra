import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraSession } from "@/types/auth"
import AuthSection from "./AuthSection"

vi.mock("@/utils/i18n", () => ({
  t: (key: string) => ({
    popup_astraAccount: "Astra account",
    popup_currentPlan: "Current plan",
    popup_planStatus: "Plan status",
    popup_todayRequests: "Today requests",
    popup_todayCharacters: "Today characters",
    popup_remainingRequests: "Remaining requests",
    popup_remainingCharacters: "Remaining characters",
    popup_lastCall: "Last call",
    popup_usageRefreshTime: "Usage refreshed",
    popup_recentUsage: "Recent usage",
    popup_expiresAt: "Expires at",
    popup_signOut: "Sign out",
    label_email: "Email",
    label_password: "Password",
    popup_signInToAstra: "Sign in to Astra",
  }[key] ?? key),
}))

describe("AuthSection", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  it("shows free beta billing boundary instead of upgrade controls for authenticated sessions", async () => {
    const session: AstraSession = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-1",
      identityMode: "authenticated",
      relayBaseURL: "https://relay.example/v1",
      email: "demo@astra.local",
      plan: "free",
      subscriptionStatus: "active",
      providerEntitlements: ["openai"],
      quota: {
        dailyRequestsLimit: 20,
        dailyCharactersLimit: 1000,
        requestsPerMinuteLimit: 5,
        remainingDailyRequests: 19,
        remainingDailyCharacters: 900,
      },
      usage: {
        totalRequests: 1,
        totalCharacters: 100,
        dailyRequestsUsed: 1,
        dailyCharactersUsed: 100,
        lastRequestAt: null,
        recentEvents: [],
      },
      issuedAt: "2026-05-27T00:00:00.000Z",
      expiresAt: "2026-06-27T00:00:00.000Z",
    }
    const onOpenCheckout = vi.fn()
    const onOpenPortal = vi.fn()
    const onChangePlan = vi.fn()

    await act(async () => {
      root.render(
        <AuthSection
          session={session}
          account={null}
          usage={null}
          email=""
          password=""
          busy={false}
          onEmailChange={vi.fn()}
          onPasswordChange={vi.fn()}
          onSignIn={vi.fn()}
          onChangePlan={onChangePlan}
          onOpenCheckout={onOpenCheckout}
          onOpenPortal={onOpenPortal}
          onSignOut={vi.fn()}
        />,
      )
      await Promise.resolve()
    })

    const boundary = container.querySelector('[data-testid="popup-free-beta-billing-boundary"]') as HTMLElement
    expect(boundary).toBeTruthy()
    expect(boundary.textContent).toContain("Free public beta")
    expect(boundary.textContent).toContain("Paid upgrades, Pro checkout, and billing portal access are not available during beta")
    expect(container.textContent).not.toContain("Upgrade to Pro")
    expect(container.textContent).not.toContain("Manage subscription")
    expect(container.textContent).not.toContain("Switch to Pro")
    expect(onOpenCheckout).not.toHaveBeenCalled()
    expect(onOpenPortal).not.toHaveBeenCalled()
    expect(onChangePlan).not.toHaveBeenCalled()
  })
})
