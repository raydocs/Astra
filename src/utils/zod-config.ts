import { z } from "zod"

// MV3 runtimes disallow unsafe-eval, so force Zod onto its jitless parser path.
z.config({
  jitless: true,
})
