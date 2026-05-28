export const AndroidImportance = { DEFAULT: 3 }
export const SchedulableTriggerInputTypes = { DAILY: "daily", WEEKLY: "weekly" }
export const addNotificationResponseReceivedListener = () => ({ remove: () => undefined })
export const cancelScheduledNotificationAsync = () => Promise.resolve()
export const getExpoPushTokenAsync = () => Promise.resolve({ data: "ExponentPushToken[test]" })
export const getPermissionsAsync = () => Promise.resolve({ granted: false })
export const requestPermissionsAsync = () => Promise.resolve({ granted: false })
export const scheduleNotificationAsync = () => Promise.resolve("notification-id")
export const setNotificationChannelAsync = () => Promise.resolve()
export const setNotificationHandler = () => undefined
