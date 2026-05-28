import Constants from "expo-constants"
import * as Notifications from "expo-notifications"

import type { MobileReminderPreference, MobileReminderTime } from "../state/mobileAppState"

const REVIEW_NOTIFICATION_ID = "astra-review-reminder"
const WEEKLY_DIGEST_NOTIFICATION_ID = "astra-weekly-learning-note"
const NOTIFICATION_CHANNEL_ID = "astra-review-habit"

type MobileNotificationAction = "open-today" | "open-digest"

export interface MobileReminderScheduleResult {
  status: "scheduled" | "off" | "permission-needed" | "permission-denied" | "error"
  message: string
}

export interface MobileExpoPushTokenResult {
  status: "registered" | "permission-needed" | "permission-denied" | "unavailable" | "error"
  expoPushToken: string | null
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string }; expoProjectId?: string } | undefined
  return Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? extra?.expoProjectId
}

function timeParts(preferredTime: MobileReminderTime): { hour: number; minute: number } {
  if (preferredTime === "morning") return { hour: 8, minute: 30 }
  if (preferredTime === "lunch") return { hour: 12, minute: 15 }
  return { hour: 19, minute: 30 }
}

async function cancelAstraReminderNotifications(): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(REVIEW_NOTIFICATION_ID),
    ...[2, 3, 4, 5, 6].map((weekday) => Notifications.cancelScheduledNotificationAsync(`${REVIEW_NOTIFICATION_ID}-weekday-${weekday}`)),
    Notifications.cancelScheduledNotificationAsync(WEEKLY_DIGEST_NOTIFICATION_ID),
  ])
}

async function ensureNotificationPresentation(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "Astra Review",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 160, 120, 160],
  })
}

async function ensureNotificationPermission(allowPermissionPrompt: boolean): Promise<"granted" | "needed" | "denied"> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return "granted"
  if (!allowPermissionPrompt) return "needed"
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted ? "granted" : "denied"
}

export async function obtainMobileExpoPushTokenAfterUserAction(params: { allowPermissionPrompt: boolean }): Promise<MobileExpoPushTokenResult> {
  try {
    const permission = await ensureNotificationPermission(params.allowPermissionPrompt)
    if (permission === "needed") return { status: "permission-needed", expoPushToken: null }
    if (permission === "denied") return { status: "permission-denied", expoPushToken: null }

    const projectId = resolveExpoProjectId()
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    return { status: "registered", expoPushToken: token.data }
  } catch {
    return { status: "error", expoPushToken: null }
  }
}

export async function scheduleMobileReminderNotifications(params: {
  preference: MobileReminderPreference
  dueCount: number
  allowPermissionPrompt: boolean
}): Promise<MobileReminderScheduleResult> {
  const wantsReviewReminder = params.preference.reviewReminder !== "off"
  const wantsWeeklyDigest = params.preference.weeklyDigest

  if (!wantsReviewReminder && !wantsWeeklyDigest) {
    await cancelAstraReminderNotifications()
    return { status: "off", message: "Reminders are off on this phone." }
  }

  try {
    const permission = await ensureNotificationPermission(params.allowPermissionPrompt)
    if (permission === "needed") {
      return { status: "permission-needed", message: "Reminder preference saved. Astra will ask softly after review, not on first launch." }
    }
    if (permission === "denied") {
      await cancelAstraReminderNotifications()
      return { status: "permission-denied", message: "Reminder preference saved, but notifications are off in system settings." }
    }

    await ensureNotificationPresentation()
    await cancelAstraReminderNotifications()

    const { hour, minute } = timeParts(params.preference.preferredTime)
    let scheduledCount = 0

    if (wantsReviewReminder && params.dueCount > 0) {
      if (params.preference.reviewReminder === "daily") {
        await Notifications.scheduleNotificationAsync({
          identifier: REVIEW_NOTIFICATION_ID,
          content: {
            title: "Astra Review",
            body: `${Math.min(params.dueCount, 5)} cards are ready for a short review.`,
            data: { astraAction: "open-today" satisfies MobileNotificationAction },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            channelId: NOTIFICATION_CHANNEL_ID,
            hour,
            minute,
          },
        })
        scheduledCount += 1
      } else {
        for (const weekday of [2, 3, 4, 5, 6]) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${REVIEW_NOTIFICATION_ID}-weekday-${weekday}`,
            content: {
              title: "Astra Review",
              body: `${Math.min(params.dueCount, 5)} cards are ready for a short review.`,
              data: { astraAction: "open-today" satisfies MobileNotificationAction },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              channelId: NOTIFICATION_CHANNEL_ID,
              weekday,
              hour,
              minute,
            },
          })
        }
        scheduledCount += 1
      }
    }

    if (wantsWeeklyDigest) {
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_DIGEST_NOTIFICATION_ID,
        content: {
          title: "Your Astra learning note is ready",
          body: "A calm look at what you saved and reviewed this week.",
          data: { astraAction: "open-digest" satisfies MobileNotificationAction },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: NOTIFICATION_CHANNEL_ID,
          weekday: 2,
          hour: 9,
          minute: 0,
        },
      })
      scheduledCount += 1
    }

    if (scheduledCount === 0) {
      return { status: "scheduled", message: "Reminder preference saved. Astra will wait until cards are ready." }
    }
    return { status: "scheduled", message: "Gentle reminders are scheduled on this phone." }
  } catch {
    return { status: "error", message: "Reminder preference saved, but this phone could not schedule reminders yet." }
  }
}

function notificationActionFromData(data: Record<string, unknown>): MobileNotificationAction | null {
  return data.astraAction === "open-today" || data.astraAction === "open-digest" ? data.astraAction : null
}

export function addMobileNotificationResponseHandler(onOpenToday: (action: MobileNotificationAction) => void): { remove: () => void } {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const action = notificationActionFromData(response.notification.request.content.data ?? {})
    if (action === "open-today" || action === "open-digest") {
      onOpenToday(action)
    }
  })
  return { remove: () => subscription.remove() }
}
