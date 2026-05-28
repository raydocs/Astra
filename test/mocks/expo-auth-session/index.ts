export const ResponseType = {
  IdToken: "id_token",
} as const

export function makeRedirectUri({ scheme, path }: { scheme?: string; path?: string } = {}): string {
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : ""
  return `${scheme ?? "astra-review"}://${suffix}`
}

export async function loadAsync(): Promise<{ promptAsync: () => Promise<{ type: "cancel"; params: Record<string, string> }> }> {
  return {
    async promptAsync() {
      return { type: "cancel", params: {} }
    },
  }
}
