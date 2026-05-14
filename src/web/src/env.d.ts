/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASTRA_API_BASE_URL?: string
  readonly VITE_ASTRA_PLATFORM_BASE_URL?: string
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}
