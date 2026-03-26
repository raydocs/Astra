import type { AstraAccount, AstraPlan, AstraSession, AstraUsageSnapshot } from "@/types/auth"

import { btnDisabled, btnPrimary, btnSecondary, inputStyle, labelStyle, statusCardStyle } from "./styles"

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
  onChangePlan,
  onOpenCheckout,
  onOpenPortal,
  onSignOut,
}: AuthSectionProps) {
  const resolvedAccount = account ?? (session ? {
    id: "session-fallback",
    relayBaseURL: session.relayBaseURL,
    email: session.email,
    billingEmail: session.email,
    createdAt: session.expiresAt ?? "unknown",
    plan: session.plan,
    subscriptionStatus: session.subscriptionStatus,
    providerEntitlements: session.providerEntitlements,
  } : null)
  const resolvedUsage = usage ?? (session ? {
    generatedAt: session.usage.lastRequestAt ?? "unknown",
    quota: session.quota,
    usage: session.usage,
  } : null)

  return (
    <details open style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
        🔐 Astra 账号
      </summary>
      <div style={{ marginTop: 8 }}>
        {session ? (
          <div style={statusCardStyle}>
            <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{resolvedAccount?.email ?? session.email}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              当前套餐：{resolvedAccount?.plan ?? session.plan}
              {" · "}
              状态：{resolvedAccount?.subscriptionStatus ?? session.subscriptionStatus}
              {" · "}
              Providers：{resolvedAccount?.providerEntitlements.join(", ") ?? session.providerEntitlements.join(", ")}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Account：{resolvedAccount?.id ?? "loading"}
              {" · "}
              Relay：{resolvedAccount?.relayBaseURL ?? session.relayBaseURL}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Billing：{resolvedAccount?.billingEmail ?? session.email}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              今日请求：{resolvedUsage?.usage.dailyRequestsUsed ?? session.usage.dailyRequestsUsed}/{resolvedUsage?.quota.dailyRequestsLimit ?? session.quota.dailyRequestsLimit}
              {" · "}
              今日字符：{resolvedUsage?.usage.dailyCharactersUsed ?? session.usage.dailyCharactersUsed}/{resolvedUsage?.quota.dailyCharactersLimit ?? session.quota.dailyCharactersLimit}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              剩余请求：{resolvedUsage?.quota.remainingDailyRequests ?? session.quota.remainingDailyRequests}
              {" · "}
              剩余字符：{resolvedUsage?.quota.remainingDailyCharacters ?? session.quota.remainingDailyCharacters}
              {" · "}
              每分钟上限：{resolvedUsage?.quota.requestsPerMinuteLimit ?? session.quota.requestsPerMinuteLimit}
            </div>
            {resolvedUsage?.usage.lastRequestAt && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                最近一次调用：{resolvedUsage.usage.lastRequestAt}
              </div>
            )}
            {resolvedUsage?.generatedAt && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Usage 刷新时间：{resolvedUsage.generatedAt}
              </div>
            )}
            {resolvedUsage?.usage.recentEvents.length ? (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                最近用量：
                {resolvedUsage.usage.recentEvents.slice(0, 3).map((event) => (
                  <div key={`${event.timestamp}-${event.provider}`} style={{ marginTop: 2 }}>
                    {event.provider} · {event.characterCount} chars · {event.timestamp}
                  </div>
                ))}
              </div>
            ) : null}
            {session.expiresAt && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                过期时间：{session.expiresAt}
              </div>
            )}
          </div>
        ) : (
          <>
            <label style={labelStyle}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />

            <label style={labelStyle}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {session ? (
            <>
              {resolvedAccount?.plan !== "pro" && (
                <button
                  onClick={() => onOpenCheckout("pro")}
                  style={{ ...btnPrimary, ...(busy ? btnDisabled : {}) }}
                  disabled={busy}
                >
                  升级到 Pro
                </button>
              )}
              <button
                onClick={onOpenPortal}
                style={{ ...btnSecondary, ...(busy ? btnDisabled : {}) }}
                disabled={busy}
              >
                管理订阅
              </button>
              <button
                onClick={() => onChangePlan("free")}
                style={{ ...btnSecondary, ...(busy || resolvedAccount?.plan === "free" ? btnDisabled : {}) }}
                disabled={busy || resolvedAccount?.plan === "free"}
              >
                切到 Free
              </button>
              <button
                onClick={() => onChangePlan("pro")}
                style={{ ...btnPrimary, ...(busy || resolvedAccount?.plan === "pro" ? btnDisabled : {}) }}
                disabled={busy || resolvedAccount?.plan === "pro"}
              >
                切到 Pro
              </button>
              <button
                onClick={onSignOut}
                style={{ ...btnSecondary, ...(busy ? btnDisabled : {}) }}
                disabled={busy}
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              onClick={onSignIn}
              style={{ ...btnPrimary, ...(busy ? btnDisabled : {}) }}
              disabled={busy || email.trim().length === 0 || password.length === 0}
            >
              登录 Astra
            </button>
          )}
        </div>
      </div>
    </details>
  )
}
