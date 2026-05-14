import { popupDeepReadProofScenario } from "./popup-deep-read-proof"

export { popupDeepReadProofScenario } from "./popup-deep-read-proof"

export const popupDeepReadSmokeScenario: typeof popupDeepReadProofScenario = {
  ...popupDeepReadProofScenario,
  id: "bench-live/popup-deep-read-smoke",
  title: "Live popup deep-read smoke",
}
