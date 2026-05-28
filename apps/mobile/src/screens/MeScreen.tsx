import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { MIN_TOUCH_TARGET_STYLE, buildPreferenceOptionAccessibilityLabel } from "../domain/mobileAccessibility"
import { deriveMobileMembershipDisplay } from "../domain/mobileMembership"
import type { MobileRetentionDashboard } from "../domain/retentionAnalytics"
import type { MobileAppState, MobileCloudReviewDataDeleteJobHistoryEntry, MobileReminderPreference, MobileReminderTime, MobileReviewReminderCadence } from "../state/mobileAppState"
import { colors, radii, spacing } from "../theme"

interface MeScreenProps {
  state: MobileAppState
  retentionDashboard: MobileRetentionDashboard
  syncBusy: boolean
  onSyncNow: () => void
  onRequestSignIn: () => void
  onSignOut: () => void
  onClearLocalData: () => void
  onDeleteCloudReviewData: () => void
  onDeleteAccount: () => void
  onRequestWeeklyDigestEmail: () => void
  onSubmitSupportReport: () => void
  onExportAccountData: () => void
  onUpdateReminderPreference: (patch: Partial<Omit<MobileReminderPreference, "updatedAt">>) => void
}

function formatLastSynced(value: string | null): string {
  if (!value) return "Not yet"
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return "Recently"
  }
}

function reviewReminderCopy(value: MobileReviewReminderCadence): string {
  if (value === "daily") return "A gentle daily review cue is saved for this phone."
  if (value === "weekdays") return "Weekday cues are saved for this phone."
  return "Off until you choose a gentle reminder."
}

function preferredTimeCopy(value: MobileReminderTime): string {
  if (value === "morning") return "Morning"
  if (value === "lunch") return "Lunch"
  return "Evening"
}

function formatDeleteDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" })
  } catch {
    return "recently"
  }
}

function deleteHistoryCopy(entry: MobileCloudReviewDataDeleteJobHistoryEntry): string {
  const date = entry.completedAt ? formatDeleteDate(entry.completedAt) : formatDeleteDate(entry.requestedAt)
  return `${entry.status} · ${date} · Reference ${entry.jobId}`
}

function pendingDeleteCopy(state: MobileAppState): string | null {
  const job = state.pendingCloudReviewDataDeleteJob
  if (!job) return null
  const when = formatDeleteDate(job.scheduledForAt)
  return `Deletion ${job.status}. Scheduled for ${when}. Reference ${job.jobId}.`
}

export function MeScreen({ state, retentionDashboard, syncBusy, onSyncNow, onRequestSignIn, onSignOut, onClearLocalData, onDeleteCloudReviewData, onDeleteAccount, onRequestWeeklyDigestEmail, onSubmitSupportReport, onExportAccountData, onUpdateReminderPreference }: MeScreenProps) {
  const pendingCount = state.offlineQueue.operations.filter((operation) => operation.status !== "synced").length
  const membership = deriveMobileMembershipDisplay(state)
  const deleteStatusCopy = pendingDeleteCopy(state)
  const deleteHistory = state.cloudReviewDataDeleteJobHistory.slice(0, 3)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Me</Text>
        <Text style={styles.title}>Quiet account and habit settings.</Text>
        <Text style={styles.copy}>Astra keeps this screen calm: your account, reminders, privacy, and review progress in one place.</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>{membership.label}</Text>
        <Text style={styles.copy}>{membership.copy}</Text>
        <View style={styles.benefitList}>
          {membership.benefits.map((benefit) => <Text key={benefit} style={styles.benefitText}>• {benefit}</Text>)}
        </View>
        {state.message ? <Text style={styles.statusMessage}>{state.message}</Text> : null}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Learning guidance</Text>
        <Text style={styles.rowCopy}>Astra is a study aid. Card meanings and notes may not be perfect; use the source context when a meaning matters.</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Review progress</Text>
        <Text style={styles.rowCopy}>{pendingCount === 0 ? "Everything on this phone is up to date." : `${pendingCount} review choice${pendingCount === 1 ? "" : "s"} saved on this phone.`}</Text>
        <Text style={styles.rowMeta}>Last sync: {formatLastSynced(state.lastSyncedAt)}</Text>
        {state.session ? (
          <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.primaryButton, syncBusy && styles.disabledButton]} onPress={onSyncNow}>
            <Text style={styles.primaryButtonText}>{syncBusy ? "Syncing…" : "Sync review progress"}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onRequestSignIn}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Review reminder</Text>
        <Text style={styles.rowCopy}>{reviewReminderCopy(state.reminderPreference.reviewReminder)} Astra will ask softly after review, not on first launch.</Text>
        <View style={styles.optionRow}>
          {(["off", "daily", "weekdays"] as const).map((value) => {
            const selected = state.reminderPreference.reviewReminder === value
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={buildPreferenceOptionAccessibilityLabel("Review reminder", value === "off" ? "Off" : value === "daily" ? "Daily" : "Weekdays", selected)}
                accessibilityHint="Sets how often this phone may remind you to review"
                accessibilityState={{ selected }}
                style={[styles.optionPill, selected && styles.optionPillActive]}
                onPress={() => onUpdateReminderPreference({ reviewReminder: value })}
              >
                <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>{value === "off" ? "Off" : value === "daily" ? "Daily" : "Weekdays"}</Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={styles.rowMeta}>Preferred time: {preferredTimeCopy(state.reminderPreference.preferredTime)}</Text>
        <View style={styles.optionRow}>
          {(["morning", "lunch", "evening"] as const).map((value) => {
            const selected = state.reminderPreference.preferredTime === value
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={buildPreferenceOptionAccessibilityLabel("Preferred reminder time", preferredTimeCopy(value), selected)}
                accessibilityHint="Sets the preferred time for review reminders on this phone"
                accessibilityState={{ selected }}
                style={[styles.optionPill, selected && styles.optionPillActive]}
                onPress={() => onUpdateReminderPreference({ preferredTime: value })}
              >
                <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>{preferredTimeCopy(value)}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Weekly learning note</Text>
        <Text style={styles.rowCopy}>{state.reminderPreference.weeklyDigest ? "On. Astra can show a calm weekly summary when it is ready." : "Off. You can still review cards without a weekly note."}</Text>
        <View style={styles.optionRow}>
          {[true, false].map((value) => {
            const selected = state.reminderPreference.weeklyDigest === value
            return (
              <Pressable
                key={value ? "on" : "off"}
                accessibilityRole="button"
                accessibilityLabel={buildPreferenceOptionAccessibilityLabel("Weekly learning note", value ? "On" : "Off", selected)}
                accessibilityHint="Turns the weekly learning note on or off"
                accessibilityState={{ selected }}
                style={[styles.optionPill, selected && styles.optionPillActive]}
                onPress={() => onUpdateReminderPreference({ weeklyDigest: value })}
              >
                <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>{value ? "On" : "Off"}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Email this week's note" accessibilityHint="Request a weekly learning note by email" disabled={syncBusy} style={[styles.secondaryButton, syncBusy && styles.disabledButton]} onPress={onRequestWeeklyDigestEmail}>
          <Text style={styles.secondaryButtonText}>Email this week's note</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Offline review</Text>
        <Text style={styles.rowCopy}>Today cards stay available on this device. Review choices sync when Astra can connect.</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Local learning activity</Text>
        <Text style={styles.rowCopy}>This phone has {retentionDashboard.reviewActions.total} review action{retentionDashboard.reviewActions.total === 1 ? "" : "s"}, {retentionDashboard.weeklyAppOpens.reduce((sum, week) => sum + week.count, 0)} app open{retentionDashboard.weeklyAppOpens.reduce((sum, week) => sum + week.count, 0) === 1 ? "" : "s"}, and {retentionDashboard.sync.successes} successful sync{retentionDashboard.sync.successes === 1 ? "" : "s"} in local activity.</Text>
        <Text style={styles.rowMeta}>Last 7 days: {retentionDashboard.recent7Days.reviewActions} review{retentionDashboard.recent7Days.reviewActions === 1 ? "" : "s"}, {retentionDashboard.recent7Days.appOpens} open{retentionDashboard.recent7Days.appOpens === 1 ? "" : "s"}, {retentionDashboard.recent7Days.syncSuccesses} successful sync{retentionDashboard.recent7Days.syncSuccesses === 1 ? "" : "s"}.</Text>
        {retentionDashboard.recent7Days.syncFailures > 0 ? <Text style={styles.rowMeta}>Sync issues in the last 7 days: {retentionDashboard.recent7Days.syncFailures}.</Text> : null}
        <Text style={styles.rowMeta}>Reminder habit: {retentionDashboard.reminderEnabled ? "On" : "Off"}. Source actions: {retentionDashboard.sourceActions.hidden + retentionDashboard.sourceActions.restored + retentionDashboard.sourceActions.removed}.</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Help improve Astra</Text>
        <Text style={styles.rowCopy}>Send a safe help note from this phone. It includes app and account status only — no card text, saved sentences, or page content.</Text>
        <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.secondaryButton, syncBusy && styles.disabledButton]} onPress={onSubmitSupportReport}>
          <Text style={styles.secondaryButtonText}>Send help note</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Privacy</Text>
        <Text style={styles.rowCopy}>Clear this phone at any time. Source titles stay focused on learning context.</Text>
        {state.session ? (
          <>
            <Text style={styles.rowMeta}>Deleting saved learning data removes synced saved cards and review history after the account grace period.</Text>
            <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.secondaryButton, syncBusy && styles.disabledButton]} onPress={onExportAccountData}>
              <Text style={styles.secondaryButtonText}>Export my data</Text>
            </Pressable>
            {deleteStatusCopy ? <Text style={styles.rowMeta}>{deleteStatusCopy}</Text> : null}
            {deleteHistory.length > 0 ? (
              <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>Recent deletion requests</Text>
                {deleteHistory.map((entry) => <Text key={entry.jobId} style={styles.rowMeta}>{deleteHistoryCopy(entry)}</Text>)}
              </View>
            ) : null}
            <Pressable accessibilityRole="button" disabled={syncBusy || Boolean(state.pendingCloudReviewDataDeleteJob)} style={[styles.dangerButton, (syncBusy || Boolean(state.pendingCloudReviewDataDeleteJob)) && styles.disabledButton]} onPress={onDeleteCloudReviewData}>
              <Text style={styles.dangerButtonText}>Delete saved learning data</Text>
            </Pressable>
            <Text style={styles.rowMeta}>Delete account removes account access and signed-in devices, then clears this phone.</Text>
            <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.dangerButton, syncBusy && styles.disabledButton]} onPress={onDeleteAccount}>
              <Text style={styles.dangerButtonText}>Delete account</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowTitle}>Local data</Text>
        <Text style={styles.rowCopy}>Clear this phone and return to the sample review. Your saved cards remain in your Astra account.</Text>
        {state.session ? (
          <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.secondaryButton, syncBusy && styles.disabledButton]} onPress={onSignOut}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" disabled={syncBusy} style={[styles.secondaryButton, syncBusy && styles.disabledButton]} onPress={onClearLocalData}>
          <Text style={styles.secondaryButtonText}>Clear local data</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing.md, padding: spacing.lg },
  headerCard: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  eyebrow: { color: colors.sealRed, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "500", lineHeight: 36 },
  copy: { color: colors.graphite, fontSize: 16, lineHeight: 24 },
  statusCard: { backgroundColor: "#EEF5EA", borderColor: "#C9DDC0", borderRadius: 22, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  statusLabel: { color: colors.success, fontSize: 18, fontWeight: "800" },
  benefitList: { gap: 2, marginTop: spacing.xs },
  benefitText: { color: colors.graphite, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  statusMessage: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  row: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  rowCopy: { color: colors.graphite, fontSize: 15, lineHeight: 22 },
  rowMeta: { color: colors.graphite, fontSize: 13, fontWeight: "700" },
  historyBox: { borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.xs, marginTop: spacing.sm, padding: spacing.sm },
  historyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  optionPill: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionPillText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  optionPillTextActive: { color: colors.paperElevated },
  primaryButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", backgroundColor: colors.ink, borderRadius: radii.pill, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  primaryButtonText: { color: colors.paperElevated, fontSize: 15, fontWeight: "900" },
  secondaryButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  dangerButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.sealRed, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dangerButtonText: { color: colors.sealRed, fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
})
