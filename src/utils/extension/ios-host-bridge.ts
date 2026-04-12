import { browser } from "#imports"

const SAFARI_NATIVE_APP_ID = "application.id"

export interface IosSessionBootstrapAck {
  ok?: boolean
  type?: string
  sessionId?: string
  source?: string
  issuedAt?: string
  launchURL?: string
  error?: string
}

export interface IosBootstrapStatus {
  lastSessionId: string | null
  lastBootstrapAt: string | null
}

export interface IosBootstrapHistoryEvent {
  sessionId: string
  source: string
  issuedAt: string | null
  launchURL: string | null
}

interface BrowserRuntimeWithNativeMessage {
  sendNativeMessage?: (application: string, message: unknown) => Promise<unknown>
}

function getNativeMessageSender() {
  const runtime = browser.runtime as typeof browser.runtime & BrowserRuntimeWithNativeMessage
  if (typeof runtime.sendNativeMessage !== "function") {
    return null
  }

  return runtime.sendNativeMessage.bind(runtime)
}

export function isIosHostBridgeAvailable(): boolean {
  return getNativeMessageSender() !== null
}

async function sendHostMessage(message: Record<string, unknown>): Promise<unknown | null> {
  const sendNativeMessage = getNativeMessageSender()
  if (!sendNativeMessage) {
    return null
  }

  try {
    return await sendNativeMessage(SAFARI_NATIVE_APP_ID, message)
  } catch {
    return null
  }
}

function parseBootstrapStatus(raw: unknown): IosBootstrapStatus | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const response = raw as {
    ok?: boolean
    type?: string
    lastSessionId?: unknown
    lastBootstrapAt?: unknown
  }

  if (response.ok !== true || response.type !== "bootstrapStatus") {
    return null
  }

  return {
    lastSessionId: typeof response.lastSessionId === "string" ? response.lastSessionId : null,
    lastBootstrapAt: typeof response.lastBootstrapAt === "string" ? response.lastBootstrapAt : null,
  }
}

function parseBootstrapHistory(raw: unknown): IosBootstrapHistoryEvent[] {
  if (!raw || typeof raw !== "object") {
    return []
  }

  const response = raw as {
    ok?: boolean
    type?: string
    events?: unknown
  }

  if (response.ok !== true || response.type !== "bootstrapHistory" || !Array.isArray(response.events)) {
    return []
  }

  return response.events
    .map((event): IosBootstrapHistoryEvent | null => {
      if (!event || typeof event !== "object") {
        return null
      }

      const record = event as {
        sessionId?: unknown
        source?: unknown
        issuedAt?: unknown
        launchURL?: unknown
      }

      if (typeof record.sessionId !== "string" || record.sessionId.trim().length === 0) {
        return null
      }

      return {
        sessionId: record.sessionId,
        source: typeof record.source === "string" && record.source.trim().length > 0
          ? record.source
          : "unknown",
        issuedAt: typeof record.issuedAt === "string" ? record.issuedAt : null,
        launchURL: typeof record.launchURL === "string" ? record.launchURL : null,
      }
    })
    .filter((event): event is IosBootstrapHistoryEvent => event !== null)
}

export async function readIosBootstrapStatus(): Promise<IosBootstrapStatus | null> {
  const raw = await sendHostMessage({ type: "bootstrapStatus" })
  return parseBootstrapStatus(raw)
}

export async function readIosBootstrapHistory(limit = 10): Promise<IosBootstrapHistoryEvent[]> {
  const raw = await sendHostMessage({
    type: "bootstrapHistory",
    limit,
  })
  return parseBootstrapHistory(raw)
}

export async function openIosLaunchURL(launchURL: string): Promise<boolean> {
  if (!launchURL.startsWith("astra-shell://")) {
    return false
  }

  try {
    await browser.tabs.create({ url: launchURL })
    return true
  } catch {
    return false
  }
}

export async function consumeIosSessionBootstrap(source = "background"): Promise<{
  opened: boolean
  ack: IosSessionBootstrapAck | null
  status: IosBootstrapStatus | null
  history: IosBootstrapHistoryEvent[]
}> {
  const sessionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  const rawAck = await sendHostMessage({
    type: "sessionBootstrap",
    sessionId,
    source,
  })

  const ack = rawAck && typeof rawAck === "object"
    ? rawAck as IosSessionBootstrapAck
    : null

  const launchURL = typeof ack?.launchURL === "string" ? ack.launchURL : ""
  const opened = ack?.ok === true
    ? await openIosLaunchURL(launchURL)
    : false

  const [status, history] = await Promise.all([
    readIosBootstrapStatus(),
    readIosBootstrapHistory(),
  ])

  return { opened, ack, status, history }
}
