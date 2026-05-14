import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadRelayEnv } from "./config"

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return overrides
}

describe("loadRelayEnv relay data paths", () => {
  it("preserves no-env data file defaults", () => {
    const relayEnv = loadRelayEnv(env())

    expect(relayEnv.userDbPath).toBe("server/data/users.json")
    expect(relayEnv.videoNoteStorePath).toBe("server/data/video-notes.json")
  })

  it("derives both data file paths from ASTRA_RELAY_DATA_DIR", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
  })

  it("derives both data file paths from ASTRA_DATA_DIR when relay data dir is absent", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_DATA_DIR: "/tmp/astra-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-data", "video-notes.json"))
  })

  it("prefers ASTRA_RELAY_DATA_DIR over ASTRA_DATA_DIR", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_DATA_DIR: "/tmp/astra-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
  })

  it("prefers ASTRA_USER_DB_PATH while deriving video notes from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_USER_DB_PATH: "/tmp/custom-users.json",
    }))

    expect(relayEnv.userDbPath).toBe("/tmp/custom-users.json")
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
  })

  it("prefers ASTRA_VIDEO_NOTE_STORE_PATH while deriving users from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_VIDEO_NOTE_STORE_PATH: "/tmp/custom-video-notes.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe("/tmp/custom-video-notes.json")
  })

  it("preserves empty explicit file env values", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_USER_DB_PATH: "",
      ASTRA_VIDEO_NOTE_STORE_PATH: "",
    }))

    expect(relayEnv.userDbPath).toBe("")
    expect(relayEnv.videoNoteStorePath).toBe("")
  })
})
