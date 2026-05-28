import { beforeEach, describe, expect, it, vi } from "vitest"

const notifications = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly" },
}))

vi.mock("expo-notifications", () => notifications)
vi.mock("expo-constants", () => ({
  default: {
    easConfig: { projectId: "project-1" },
    expoConfig: { extra: {} },
  },
}))

import { obtainMobileExpoPushTokenAfterUserAction } from "./mobileNotifications"

describe("mobile notification push token helper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not prompt or request a push token when permission prompt is not allowed", async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false })

    const result = await obtainMobileExpoPushTokenAfterUserAction({ allowPermissionPrompt: false })

    expect(result).toEqual({ status: "permission-needed", expoPushToken: null })
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it("requests permission after user action and returns an Expo push token", async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false })
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: true })
    notifications.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" })

    const result = await obtainMobileExpoPushTokenAfterUserAction({ allowPermissionPrompt: true })

    expect(result).toEqual({ status: "registered", expoPushToken: "ExponentPushToken[test]" })
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-1" })
  })
})
