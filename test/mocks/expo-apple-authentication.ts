export const AppleAuthenticationScope = {
  EMAIL: "EMAIL",
} as const

export async function isAvailableAsync(): Promise<boolean> {
  return false
}

export async function signInAsync(): Promise<{ identityToken: string | null }> {
  return { identityToken: null }
}
