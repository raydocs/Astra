/**
 * Persisted power-user opt-in for the advanced provider/model/API-key console.
 * OFF by default so the options surface stays zero-config; setting it true is how
 * a power user reveals the (otherwise ?advanced=1-gated) provider controls. This
 * is a local-only UI preference, intentionally not part of synced AstraConfig.
 */
import { browser } from "#imports"

const ADVANCED_CONTROLS_OPT_IN_KEY = "astra:advanced-controls-opt-in"

export async function getAdvancedControlsOptIn(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(ADVANCED_CONTROLS_OPT_IN_KEY)
    return result[ADVANCED_CONTROLS_OPT_IN_KEY] === true
  } catch {
    return false
  }
}

export async function setAdvancedControlsOptIn(value: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [ADVANCED_CONTROLS_OPT_IN_KEY]: value })
  } catch {
    // A storage failure must never break the options page — stay zero-config.
  }
}
