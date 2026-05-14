export interface PrivacyContextIssue {
  message: string
  evidence?: string
}

function hasUnsafeUrlParts(value: string) {
  return value.includes("?") || value.includes("#")
}

export function evaluateSanitizedTranslateCalls(
  translateCalls: Array<{
    payload: {
      context?: Record<string, unknown>
    }
  }>,
  options: {
    requireHostname?: boolean
    allowPageUrl?: boolean
  } = {},
) {
  const issues: PrivacyContextIssue[] = []

  if (translateCalls.length === 0) {
    issues.push({ message: "No translation calls were captured for privacy inspection." })
    return { pass: false, issues }
  }

  for (const [index, call] of translateCalls.entries()) {
    const context = call.payload.context ?? null
    if (!context) {
      issues.push({ message: "Translation call missing privacy context.", evidence: `call=${index}` })
      continue
    }

    const keys = Object.keys(context)
    if (options.requireHostname && typeof context.hostname !== "string") {
      issues.push({ message: "Sanitized privacy context did not preserve hostname.", evidence: `call=${index}` })
    }

    const unexpectedKeys = keys.filter((key) => !["hostname", ...(options.allowPageUrl ? ["pageUrl"] : [])].includes(key))
    if (unexpectedKeys.length > 0) {
      issues.push({
        message: "Privacy context leaked unexpected metadata keys.",
        evidence: `call=${index}; keys=${unexpectedKeys.join(",")}`,
      })
    }

    if (!options.allowPageUrl && "pageUrl" in context) {
      issues.push({
        message: "Privacy context should not include pageUrl for this surface.",
        evidence: `call=${index}; pageUrl=${String(context.pageUrl)}`,
      })
    }

    if (options.allowPageUrl && typeof context.pageUrl === "string" && hasUnsafeUrlParts(context.pageUrl)) {
      issues.push({
        message: "Privacy context pageUrl still contains query or fragment data.",
        evidence: `call=${index}; pageUrl=${context.pageUrl}`,
      })
    }

    for (const forbiddenKey of ["pageTitle", "metaDescription", "contentSummary", "selectionContext"]) {
      if (forbiddenKey in context) {
        issues.push({
          message: "Privacy context leaked forbidden content metadata.",
          evidence: `call=${index}; key=${forbiddenKey}`,
        })
      }
    }
  }

  return {
    pass: issues.length === 0,
    issues,
  }
}
