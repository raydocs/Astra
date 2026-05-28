import type { AstraAccount, AstraPlan, AstraSession, AstraUsageSnapshot } from "@/types/auth"
import { formatAstraPlanLabel, formatAstraSubscriptionStatusLabel } from "@/utils/astra/account-surface"
import { t } from "@/utils/i18n"
import { labelStyle } from "./styles"

export interface AuthSectionProps {
  session: AstraSession | null
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  email: string
  password: string
  busy: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSignIn: () => void
  onChangePlan: (plan: AstraPlan) => void
  onOpenCheckout: (plan: AstraPlan) => void
  onOpenPortal: () => void
  onSignOut: () => void
}

export default function AuthSection({
  session,
  account,
  usage,
  email,
  password,
  busy,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignOut,
}: AuthSectionProps) {
  const isAuthenticatedSession = session?.identityMode === "authenticated"
  const resolvedAccount = account ?? (isAuthenticatedSession && session ? {
    id: "session-fallback",
    relayBaseURL: session.relayBaseURL,
    email: session.email,
    billingEmail: session.email,
    createdAt: session.expiresAt ?? "unknown",
    plan: session.plan,
    subscriptionStatus: session.subscriptionStatus,
    providerEntitlements: session.providerEntitlements,
  } : null)
  const resolvedUsage = usage ?? (isAuthenticatedSession && session ? {
    generatedAt: session.usage.lastRequestAt ?? "unknown",
    quota: session.quota,
    usage: session.usage,
  } : null)

  return (
    <details open style={{ marginBottom: 12 }}>
      <summary className="astra-cursor-pointer" style={{ fontSize: 13, color: "var(--astra-brand-hover)" }}>
        {t("popup_astraAccount")}
      </summary>
      <div style={{ marginTop: 8 }}>
        {isAuthenticatedSession && session ? (
          <div className="astra-site-sheet__card">
            <div style={{ fontSize: 13, color: "var(--astra-text-primary)", fontWeight: 600 }}>{resolvedAccount?.email ?? session.email}</div>
            <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", marginTop: 4 }}>
              {t("popup_currentPlan")}：{formatAstraPlanLabel(resolvedAccount?.plan ?? session.plan)}
              {" · "}
              {t("popup_planStatus")}：{formatAstraSubscriptionStatusLabel(resolvedAccount?.subscriptionStatus ?? session.subscriptionStatus)}
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
              Account：{resolvedAccount?.id ?? "loading"}
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
              Billing：{resolvedAccount?.billingEmail ?? session.email}
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
              {t("popup_todayRequests")}：{resolvedUsage?.usage.dailyRequestsUsed ?? session.usage.dailyRequestsUsed}/{resolvedUsage?.quota.dailyRequestsLimit ?? session.quota.dailyRequestsLimit}
              {" · "}
              {t("popup_todayCharacters")}：{resolvedUsage?.usage.dailyCharactersUsed ?? session.usage.dailyCharactersUsed}/{resolvedUsage?.quota.dailyCharactersLimit ?? session.quota.dailyCharactersLimit}
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
              {t("popup_remainingRequests")}：{resolvedUsage?.quota.remainingDailyRequests ?? session.quota.remainingDailyRequests}
              {" · "}
              {t("popup_remainingCharacters")}：{resolvedUsage?.quota.remainingDailyCharacters ?? session.quota.remainingDailyCharacters}
            </div>
            {resolvedUsage?.usage.lastRequestAt && (
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
                {t("popup_lastCall")}：{resolvedUsage.usage.lastRequestAt}
              </div>
            )}
            {resolvedUsage?.generatedAt && (
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
                {t("popup_usageRefreshTime")}：{resolvedUsage.generatedAt}
              </div>
            )}
            {resolvedUsage?.usage.recentEvents.length ? (
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 6 }}>
                {t("popup_recentUsage")}：
                {resolvedUsage.usage.recentEvents.slice(0, 3).map((event) => (
                  <div key={`${event.timestamp}-${event.provider}`} style={{ marginTop: 2 }}>
                    {event.characterCount} characters · {event.timestamp}
                  </div>
                ))}
              </div>
            ) : null}
            {session.expiresAt && (
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
                {t("popup_expiresAt")}：{session.expiresAt}
              </div>
            )}
          </div>
        ) : (
          <>
            {session?.identityMode === "anonymous" && (
              <div className="astra-site-sheet__card" style={{ fontSize: 12, color: "var(--astra-text-secondary)", marginBottom: 10 }}>
                This device has a guest Astra session. Sign in to attach continuity to your account.
              </div>
            )}
            <label htmlFor="popup-auth-email" style={labelStyle}>{t("label_email")}</label>
            <input
              id="popup-auth-email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
              className="astra-input"
            />

            <label htmlFor="popup-auth-password" style={labelStyle}>{t("label_password")}</label>
            <input
              id="popup-auth-password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              className="astra-input"
            />
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {isAuthenticatedSession && session ? (
            <>
              <div className="astra-site-sheet__card" data-testid="popup-free-beta-billing-boundary" style={{ flexBasis: "100%", fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                <strong style={{ color: "var(--astra-text-primary)" }}>Free public beta.</strong>
                {" "}
                Paid upgrades, Pro checkout, and billing portal access are not available during beta. The free beta includes a daily use limit.
              </div>
              <button
                onClick={onSignOut}
                className="astra-btn-secondary"
                style={{ flex: 1 }}
                disabled={busy}
              >
                {t("popup_signOut")}
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              className="astra-btn-primary"
              style={{ flex: 1 }}
              disabled={busy || email.trim().length === 0 || password.length === 0}
            >
              {t("popup_signInToAstra")}
            </button>
          )}
        </div>
      </div>
    </details>
  )
}
