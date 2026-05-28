import { useEffect, useMemo, useRef, useState } from "react"
import { Alert, Linking, Pressable, SafeAreaView, Share, StatusBar, StyleSheet, Text, View } from "react-native"

import { createMobileAstraClient, type MobileDeviceIdentity } from "./api/astraClient"
import { aggregateMobileRetentionDashboard, buildPendingMobileRetentionUploadBatch, buildReminderAnalyticsMetadata, getRecentMobileRetentionEvents, markMobileRetentionEventsUploaded, trackMobileRetentionEvent, type MobileRetentionDashboard, type MobileRetentionEventName } from "./domain/retentionAnalytics"
import { buildMobileReviewShareText, buildMobileReviewSpeechText, buildMobileSavedItemSpeechText, buildTodayReviewQueue, type MobileReviewCardViewModel, type SavedItem, type SourceContent } from "./domain/review"
import { getOrCreateMobileDeviceIdentity, resolveMobileApiBaseUrl } from "./runtime/mobileRuntime"
import { speakMobileText } from "./runtime/mobileSpeech"
import { startAppleSignIn, startGoogleSignIn, type MobileOAuthProvider } from "./runtime/mobileOAuth"
import { addMobileNotificationResponseHandler, obtainMobileExpoPushTokenAfterUserAction, scheduleMobileReminderNotifications } from "./runtime/mobileNotifications"
import { LibraryScreen } from "./screens/LibraryScreen"
import { MeScreen } from "./screens/MeScreen"
import { SignInScreen } from "./screens/SignInScreen"
import { TodayScreen } from "./screens/TodayScreen"
import {
  DEFAULT_MOBILE_APP_STATE,
  applySignedInMobileSession,
  clearMobileAppState,
  loadMobileAppState,
  markMobileReviewCardNotUseful,
  recordMobileReviewRating,
  refreshMobileReviewData,
  removeMobileSourceFromDevice,
  restoreMobileSourceOnDevice,
  requestMobileCloudReviewDataDelete,
  saveMobileAppState,
  setMobileSourceHidden,
  setMobileSourcePrivate,
  signInMobileAppState,
  syncPendingMobileReviewEvents,
  updateMobileReminderPreference,
  type MobileAppState,
  type MobileReminderPreference,
} from "./state/mobileAppState"
import { createAsyncStorageMobileKeyValueStorage } from "./state/asyncStorage"
import { createSecureStoreMobileKeyValueStorage } from "./state/secureStorage"
import { colors, radii, spacing } from "./theme"

type TabKey = "today" | "library" | "me"
type SourceReviewScope = { sourceId: string; title: string }

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "library", label: "Library" },
  { key: "me", label: "Me" },
]

const fallbackDevice: MobileDeviceIdentity = {
  deviceId: "mobile-preview-device",
  label: "Mobile preview",
  platform: "unknown",
  appKind: "mobile",
  appVersion: "0.1.0-mobile-preview",
}

function normalizeDesktopLinkCodeInput(value: string): string {
  const codeMatch = /[?&]code=([^&#]+)/.exec(value.trim())
  if (!codeMatch) return value.trim()
  try {
    return decodeURIComponent(codeMatch[1]).trim()
  } catch {
    return codeMatch[1].trim()
  }
}

function mergeSyncedReviewState(current: MobileAppState, synced: MobileAppState): MobileAppState {
  const syncedOperationsById = new Map(synced.offlineQueue.operations.map((operation) => [operation.operationId, operation]))
  const mergedOperations = current.offlineQueue.operations.map((operation) => syncedOperationsById.get(operation.operationId) ?? operation)
  const currentOperationIds = new Set(current.offlineQueue.operations.map((operation) => operation.operationId))
  const syncedOnlyOperations = synced.offlineQueue.operations.filter((operation) => !currentOperationIds.has(operation.operationId))

  return {
    ...current,
    reviewSnapshot: synced.reviewSnapshot,
    sampleDeck: synced.sampleDeck,
    cloudVocabulary: synced.cloudVocabulary,
    weeklyDigest: synced.weeklyDigest,
    offlineQueue: { version: 1, operations: [...mergedOperations, ...syncedOnlyOperations] },
    syncCursors: { ...current.syncCursors, ...synced.syncCursors },
    syncStatus: synced.syncStatus,
    lastSyncedAt: synced.lastSyncedAt,
    message: synced.message,
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [appState, setAppState] = useState<MobileAppState>(DEFAULT_MOBILE_APP_STATE)
  const [authBusy, setAuthBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [sourceReviewScope, setSourceReviewScope] = useState<SourceReviewScope | null>(null)
  const [librarySourceId, setLibrarySourceId] = useState<string | null>(null)
  const [device, setDevice] = useState<MobileDeviceIdentity | null>(null)
  const [retentionDashboard, setRetentionDashboard] = useState<MobileRetentionDashboard>(() => aggregateMobileRetentionDashboard([]))
  const handledLinkCodesRef = useRef<Set<string>>(new Set())
  const retentionUploadInFlightRef = useRef(false)
  const storage = useMemo(() => createAsyncStorageMobileKeyValueStorage(), [])
  const secureStorage = useMemo(() => createSecureStoreMobileKeyValueStorage(), [])
  const client = useMemo(() => createMobileAstraClient({ baseURL: resolveMobileApiBaseUrl() }), [])
  const activeDevice = device ?? fallbackDevice
  const needsSignIn = !appState.session && !appState.sampleDeck

  async function uploadRetentionAnalytics() {
    if (!appState.session || appState.sampleDeck || appState.session.identityMode !== "authenticated") return
    if (retentionUploadInFlightRef.current) return
    retentionUploadInFlightRef.current = true
    try {
      const batch = await buildPendingMobileRetentionUploadBatch(storage)
      if (batch.events.length === 0) return
      await client.uploadMobileRetentionEvents({
        session: appState.session,
        device: activeDevice,
        events: batch.events,
        idempotencyKey: `mobile-retention-${batch.generatedAt}-${batch.events[0]?.id ?? "empty"}`,
      })
      await markMobileRetentionEventsUploaded(storage, batch.events)
    } catch {
      // Remote analytics upload is opportunistic and must never interrupt product flows.
    } finally {
      retentionUploadInFlightRef.current = false
    }
  }

  async function refreshRetentionDashboard() {
    const events = await getRecentMobileRetentionEvents(storage, 200)
    setRetentionDashboard(aggregateMobileRetentionDashboard(events))
    void uploadRetentionAnalytics()
  }

  function trackRetention(name: MobileRetentionEventName, data: Record<string, unknown> = {}) {
    void trackMobileRetentionEvent({ storage, name, data })
      .then(() => refreshRetentionDashboard())
      .catch(() => {
        // Local activity diagnostics must never block app flows.
      })
  }

  useEffect(() => {
    trackRetention("app_opened", { surface: "mobile" })
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([loadMobileAppState(storage, secureStorage), getOrCreateMobileDeviceIdentity(storage)])
      .then(async ([next, identity]) => {
        const readyState = next.session
          ? await refreshMobileReviewData({ state: next, client, device: identity })
          : next
        if (!active) return
        setDevice(identity)
        setAppState(readyState)
        setHydrated(true)
        trackRetention("app_hydrated", { signedIn: Boolean(readyState.session), sampleDeck: readyState.sampleDeck, status: "ready" })
        void refreshRetentionDashboard().catch(() => {})
      })
      .catch(() => {
        if (!active) return
        setHydrated(true)
        trackRetention("app_hydrated", { status: "failed" })
        void refreshRetentionDashboard().catch(() => {})
      })
    return () => {
      active = false
    }
  }, [client, secureStorage, storage])

  useEffect(() => {
    if (!hydrated) return
    void saveMobileAppState(storage, appState, secureStorage)
  }, [appState, hydrated, secureStorage, storage])

  useEffect(() => {
    if (!hydrated) return
    void uploadRetentionAnalytics()
  }, [appState.session, appState.sampleDeck, hydrated, activeDevice])

  useEffect(() => {
    const subscription = addMobileNotificationResponseHandler((action) => {
      trackRetention("notification_tapped", { action })
      setSourceReviewScope(null)
      setActiveTab("today")
    })
    return () => subscription.remove()
  }, [])

  async function handleSignIn(email: string, password: string) {
    if (!email.trim() || !password.trim()) {
      setAppState((current) => ({ ...current, message: "Enter your email and password to continue." }))
      return
    }
    setAuthBusy(true)
    try {
      const signedIn = await signInMobileAppState({
        state: appState,
        client,
        storage,
        secureStorage,
        device: activeDevice,
        email,
        password,
        idempotencyKey: `mobile-sign-in-${Date.now().toString(36)}`,
      })
      const refreshed = await refreshMobileReviewData({
        state: signedIn,
        client,
        device: activeDevice,
      })
      setAppState(refreshed)
      setSourceReviewScope(null)
      setActiveTab("today")
      trackRetention("sign_in_succeeded", { sampleDeck: refreshed.sampleDeck, syncStatus: refreshed.syncStatus })
    } catch {
      trackRetention("sign_in_failed", { reason: "failed" })
      setAppState((current) => ({ ...current, message: "Sign-in failed. Check your account and try again." }))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleRequestEmailCode(email: string) {
    if (!email.trim()) {
      setAppState((current) => ({ ...current, message: "Enter your email to request a sign-in code." }))
      return
    }
    setAuthBusy(true)
    try {
      const challenge = await client.requestEmailSignInCode({ email })
      if (challenge.delivery === "unavailable") {
        setAppState((current) => ({ ...current, message: "Email code sign-in is not available here yet." }))
        return
      }
      const expiresAt = new Date(challenge.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      setAppState((current) => ({ ...current, message: `Sign-in code requested. It expires at ${expiresAt}.` }))
    } catch {
      setAppState((current) => ({ ...current, message: "Could not create a sign-in code. Check your email and try again." }))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleRedeemEmailCode(email: string, code: string) {
    if (!email.trim() || !code.trim()) {
      setAppState((current) => ({ ...current, message: "Enter your email and sign-in code." }))
      return
    }
    setAuthBusy(true)
    try {
      const session = await client.redeemEmailSignInCode({
        email,
        code,
        device: activeDevice,
        idempotencyKey: `mobile-email-code-${Date.now().toString(36)}`,
      })
      const signedIn = await applySignedInMobileSession({
        state: appState,
        storage,
        secureStorage,
        session,
      })
      const refreshed = await refreshMobileReviewData({ state: signedIn, client, device: activeDevice })
      setAppState(refreshed)
      setSourceReviewScope(null)
      setActiveTab("today")
      trackRetention("sign_in_succeeded", { sampleDeck: refreshed.sampleDeck, syncStatus: refreshed.syncStatus })
    } catch {
      trackRetention("sign_in_failed", { reason: "email_code" })
      setAppState((current) => ({ ...current, message: "That sign-in code did not work. Check the code and try again." }))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleOAuthSignIn(method: MobileOAuthProvider) {
    setAuthBusy(true)
    try {
      const launched = method === "apple" ? await startAppleSignIn() : await startGoogleSignIn()
      if (launched.status !== "success") {
        trackRetention("sign_in_failed", { reason: `${method}_${launched.status}` })
        setAppState((current) => ({ ...current, message: launched.message }))
        return
      }

      const session = await client.redeemOAuthIdentity({
        identity: launched.identity,
        device: activeDevice,
        idempotencyKey: `mobile-oauth-${method}-${Date.now().toString(36)}`,
      })
      const signedIn = await applySignedInMobileSession({
        state: appState,
        storage,
        secureStorage,
        session,
      })
      const refreshed = await refreshMobileReviewData({ state: signedIn, client, device: activeDevice })
      setAppState(refreshed)
      setSourceReviewScope(null)
      setActiveTab("today")
      trackRetention("sign_in_succeeded", { method, sampleDeck: refreshed.sampleDeck, syncStatus: refreshed.syncStatus })
    } catch {
      trackRetention("sign_in_failed", { reason: `${method}_redeem` })
      setAppState((current) => ({ ...current, message: "Could not complete sign-in. Try again or use another sign-in method." }))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLinkWithCode(code: string) {
    const normalizedCode = normalizeDesktopLinkCodeInput(code)
    if (!normalizedCode) {
      setAppState((current) => ({ ...current, message: "Enter the code shown on desktop." }))
      return
    }
    setAuthBusy(true)
    try {
      const session = await client.redeemMobileLink({
        code: normalizedCode,
        device: activeDevice,
        idempotencyKey: `mobile-link-${Date.now().toString(36)}`,
      })
      const signedIn = await applySignedInMobileSession({
        state: appState,
        storage,
        secureStorage,
        session,
      })
      const refreshed = await refreshMobileReviewData({
        state: signedIn,
        client,
        device: activeDevice,
      })
      setAppState(refreshed)
      setSourceReviewScope(null)
      setActiveTab("today")
      trackRetention("link_succeeded", { sampleDeck: refreshed.sampleDeck, syncStatus: refreshed.syncStatus })
    } catch {
      trackRetention("link_failed", { reason: "failed" })
      setAppState((current) => ({ ...current, message: "That code did not work. Check the desktop screen and try again." }))
    } finally {
      setAuthBusy(false)
    }
  }

  useEffect(() => {
    if (!hydrated) return
    let active = true

    const processLinkUrl = (url: string | null) => {
      if (!active || !url) return
      const code = normalizeDesktopLinkCodeInput(url)
      if (!code || code === url.trim()) return
      if (handledLinkCodesRef.current.has(code)) return
      handledLinkCodesRef.current.add(code)
      void handleLinkWithCode(code)
    }

    void Linking.getInitialURL().then(processLinkUrl).catch(() => {})
    const subscription = Linking.addEventListener("url", (event) => processLinkUrl(event.url))
    return () => {
      active = false
      subscription.remove()
    }
  }, [appState, client, hydrated, storage, secureStorage, activeDevice])

  async function resetLocalMobileData(message = DEFAULT_MOBILE_APP_STATE.message) {
    await clearMobileAppState(storage, secureStorage)
    setAppState({ ...DEFAULT_MOBILE_APP_STATE, message })
    setSourceReviewScope(null)
    setActiveTab("today")
  }

  async function handleSignOut() {
    setSyncBusy(true)
    try {
      if (appState.session) {
        await client.revokeSession({ session: appState.session, device: activeDevice })
      }
    } catch {
      // Local sign-out should still succeed if the network is unavailable.
    } finally {
      await resetLocalMobileData("Signed out on this phone.")
      setSyncBusy(false)
    }
  }

  function handleClearLocalData() {
    void resetLocalMobileData("Local data cleared on this phone.")
  }

  async function deleteCloudReviewData() {
    setSyncBusy(true)
    trackRetention("cloud_learning_delete_requested", { signedIn: Boolean(appState.session) })
    try {
      const next = await requestMobileCloudReviewDataDelete({
        state: appState,
        client,
        device: activeDevice,
        storage,
        secureStorage,
        idempotencyKey: `mobile-delete-learning-${Date.now().toString(36)}`,
      })
      setAppState(next)
      setSourceReviewScope(null)
      setActiveTab("today")
      trackRetention("cloud_learning_delete_succeeded", { status: next.pendingCloudReviewDataDeleteJob?.status ?? "completed" })
    } catch {
      trackRetention("cloud_learning_delete_failed", { reason: "failed" })
      setAppState((current) => ({ ...current, message: "Could not request deletion. Try again when Astra can connect." }))
    } finally {
      setSyncBusy(false)
    }
  }

  function handleDeleteCloudReviewData() {
    Alert.alert(
      "Delete saved learning data?",
      "This requests deletion of synced saved cards and review history. Local sample cards will stay available on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { void deleteCloudReviewData() } },
      ],
    )
  }

  async function deleteAccount() {
    if (!appState.session) {
      setAppState((current) => ({ ...current, message: "Sign in before deleting your account." }))
      return
    }
    setSyncBusy(true)
    try {
      await client.deleteAccount({ session: appState.session, device: activeDevice })
      await resetLocalMobileData("Account deleted. Local review data cleared on this phone.")
    } catch {
      setAppState((current) => ({ ...current, message: "Could not delete account. Try again when Astra can connect." }))
    } finally {
      setSyncBusy(false)
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Astra account?",
      "This removes your account access, saved review data, and signed-in devices. This phone will return to sample review.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => { void deleteAccount() } },
      ],
    )
  }

  async function handleUpdateReminderPreference(patch: Partial<Omit<MobileReminderPreference, "updatedAt">>) {
    const nextState = updateMobileReminderPreference(appState, patch)
    setAppState(nextState)
    trackRetention("reminder_preference_changed", buildReminderAnalyticsMetadata(nextState.reminderPreference))
    const allowPermissionPrompt = (patch.reviewReminder !== undefined && patch.reviewReminder !== "off") || patch.weeklyDigest === true
    const scheduleResult = await scheduleMobileReminderNotifications({
      preference: nextState.reminderPreference,
      dueCount: buildTodayReviewQueue(nextState.reviewSnapshot).length,
      allowPermissionPrompt,
    })
    setAppState((current) => ({ ...current, message: scheduleResult.message }))

    if (nextState.session && !nextState.sampleDeck && nextState.session.identityMode === "authenticated") {
      if (allowPermissionPrompt || patch.weeklyDigest === true) {
        const pushToken = await obtainMobileExpoPushTokenAfterUserAction({ allowPermissionPrompt })
        if (pushToken.expoPushToken) {
          try {
            await client.updateCurrentDevicePushToken({
              session: nextState.session,
              device: activeDevice,
              expoPushToken: pushToken.expoPushToken,
            })
          } catch {
            // Remote notification registration is opportunistic and must not interrupt preference changes.
          }
        }
      }

      if (patch.weeklyDigest !== undefined) {
        if (patch.weeklyDigest === false) {
          try {
            await client.updateCurrentDevicePushToken({ session: nextState.session, device: activeDevice, expoPushToken: null })
          } catch {
            // Remote notification registration is opportunistic and must not interrupt preference changes.
          }
        }
        try {
          await client.updateWeeklyDigestPreference({
            session: nextState.session,
            device: activeDevice,
            enabled: patch.weeklyDigest,
          })
        } catch {
          setAppState((current) => ({
            ...current,
            message: "Weekly learning note preference saved on this phone. Astra will sync it when connected.",
          }))
        }
      }
    }
  }

  async function handleRequestWeeklyDigestEmail() {
    if (!appState.session || appState.sampleDeck) {
      setAppState((current) => ({ ...current, message: "Sign in to email your weekly learning note." }))
      return
    }
    setSyncBusy(true)
    try {
      const result = await client.requestWeeklyDigestEmail({
        session: appState.session,
        device: activeDevice,
      })
      setAppState((current) => ({
        ...current,
        weeklyDigest: result.digest,
        message: result.delivery === "email" ? "Weekly learning note sent to your account email." : "Email delivery is not available for this account yet.",
      }))
    } catch {
      setAppState((current) => ({ ...current, message: "Could not send your weekly learning note. Try again later." }))
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleSubmitSupportReport() {
    if (!appState.session || appState.sampleDeck || appState.session.identityMode !== "authenticated") {
      setAppState((current) => ({ ...current, message: "Sign in to send a help note from this phone." }))
      return
    }
    setSyncBusy(true)
    try {
      const result = await client.submitSupportReport({
        session: appState.session,
        device: activeDevice,
        featureSurface: "settings",
        issueCategory: "other",
      })
      setAppState((current) => ({
        ...current,
        message: result.knownIssue
          ? "Thanks — Astra matched this to a known issue and saved your help note."
          : "Thanks — your help note was sent. No card text or page content was included.",
      }))
    } catch {
      setAppState((current) => ({ ...current, message: "Could not send a help note. Try again when Astra can connect." }))
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleShareReviewCard(card: MobileReviewCardViewModel) {
    try {
      await Share.share({
        title: "Astra review card",
        message: buildMobileReviewShareText(card),
      })
    } catch {
      setAppState((current) => ({ ...current, message: "Could not open sharing on this phone." }))
    }
  }

  async function handleSpeakReviewCard(card: MobileReviewCardViewModel) {
    const result = await speakMobileText(buildMobileReviewSpeechText(card))
    if (result.status !== "speaking") {
      setAppState((current) => ({ ...current, message: result.message }))
    }
  }

  async function handleSpeakSavedItem(item: SavedItem) {
    const result = await speakMobileText(buildMobileSavedItemSpeechText(item))
    if (result.status !== "speaking") {
      setAppState((current) => ({ ...current, message: result.message }))
    }
  }

  function handleViewReviewCardSource(card: MobileReviewCardViewModel) {
    setLibrarySourceId(card.sourceId)
    setActiveTab("library")
  }

  async function handleShareSavedItem(item: SavedItem, source: SourceContent | undefined) {
    try {
      await Share.share({
        title: "Astra review card",
        message: buildMobileReviewShareText({ item, source }),
      })
    } catch {
      setAppState((current) => ({ ...current, message: "Could not open sharing on this phone." }))
    }
  }

  async function handleExportAccountData() {
    if (!appState.session || appState.sampleDeck || appState.session.identityMode !== "authenticated") {
      setAppState((current) => ({ ...current, message: "Sign in to export your account data." }))
      return
    }
    setSyncBusy(true)
    try {
      const exported = await client.exportAccountData({ session: appState.session, device: activeDevice })
      await Share.share({
        title: "Astra account data export",
        message: JSON.stringify(exported, null, 2),
      })
      setAppState((current) => ({ ...current, message: "Astra prepared your account data export." }))
    } catch {
      setAppState((current) => ({ ...current, message: "Could not export account data. Try again when Astra can connect." }))
    } finally {
      setSyncBusy(false)
    }
  }

  async function handleSyncNow() {
    setSyncBusy(true)
    const stateToSync = appState
    trackRetention("sync_attempted", { pendingCount: stateToSync.offlineQueue.operations.filter((operation) => operation.status !== "synced").length })
    setAppState((current) => ({ ...current, syncStatus: "loading", message: "Syncing review progress…" }))
    try {
      const pushed = await syncPendingMobileReviewEvents({
        state: stateToSync,
        client,
        device: activeDevice,
      })
      const refreshed = await refreshMobileReviewData({
        state: pushed,
        client,
        device: activeDevice,
      })
      setAppState((current) => mergeSyncedReviewState(current, refreshed))
      if (refreshed.syncStatus === "offline" || refreshed.syncStatus === "error") {
        trackRetention("sync_failed", { status: refreshed.syncStatus })
      } else {
        trackRetention("sync_succeeded", { status: refreshed.syncStatus })
      }
    } catch {
      trackRetention("sync_failed", { status: "threw" })
    } finally {
      setSyncBusy(false)
    }
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
        <View style={styles.loadingState}>
          <Text style={styles.loadingTitle}>Astra Review</Text>
          <Text style={styles.loadingCopy}>Preparing your review cards…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (needsSignIn) {
    return (
      <SafeAreaView style={styles.shell}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
        <SignInScreen
          busy={authBusy}
          message={appState.message}
          onLinkWithCode={(code) => { void handleLinkWithCode(code) }}
          onRequestEmailCode={(email) => { void handleRequestEmailCode(email) }}
          onRedeemEmailCode={(email, code) => { void handleRedeemEmailCode(email, code) }}
          onContinueWithApple={() => { void handleOAuthSignIn("apple") }}
          onContinueWithGoogle={() => { void handleOAuthSignIn("google") }}
          onSignIn={(email, password) => { void handleSignIn(email, password) }}
          onTrySample={() => setAppState(DEFAULT_MOBILE_APP_STATE)}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={styles.brandBar}>
        <View style={styles.brandMark} accessibilityElementsHidden>
          <Text style={styles.brandMarkText}>A</Text>
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandTitle}>Astra Review</Text>
          <Text style={styles.brandSubtitle}>Save on web. Review on phone.</Text>
        </View>
        {!appState.session && (
          <Pressable accessibilityRole="button" style={styles.signInPill} onPress={() => setAppState((current) => ({ ...current, sampleDeck: false }))}>
            <Text style={styles.signInPillText}>Sign in</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.scene}>
        {activeTab === "today" ? (
          <TodayScreen
            onOpenLibrary={() => {
              setLibrarySourceId(null)
              setActiveTab("library")
            }}
            snapshot={appState.reviewSnapshot}
            weeklyDigest={appState.weeklyDigest}
            sourceReview={sourceReviewScope}
            onClearSourceReview={() => setSourceReviewScope(null)}
            sampleDeck={appState.sampleDeck}
            offlineQueue={appState.offlineQueue}
            onRateCard={(cardId, rating) => {
              trackRetention(rating === "skip" ? "review_skipped" : "review_rated", { rating, sampleDeck: appState.sampleDeck, sourceScoped: Boolean(sourceReviewScope) })
              setAppState((current) => recordMobileReviewRating({
                state: current,
                cardId,
                rating,
                device: activeDevice,
              }))
            }}
            onMarkCardNotUseful={(cardId) => {
              trackRetention("review_skipped", { reason: "not_useful", sampleDeck: appState.sampleDeck, sourceScoped: Boolean(sourceReviewScope) })
              setAppState((current) => markMobileReviewCardNotUseful(current, cardId))
            }}
            onShareCard={(card) => { void handleShareReviewCard(card) }}
            onSpeakCard={(card) => { void handleSpeakReviewCard(card) }}
            onViewSource={handleViewReviewCardSource}
          />
        ) : null}
        {activeTab === "library" ? (
          <LibraryScreen
            snapshot={appState.reviewSnapshot}
            sampleDeck={appState.sampleDeck}
            lastRemovedSource={appState.lastRemovedSource}
            privateSourceIds={appState.privateSourceIds}
            selectedSourceId={librarySourceId}
            onSelectedSourceIdChange={setLibrarySourceId}
            onStartReview={(source) => {
              setLibrarySourceId(null)
              setSourceReviewScope(source ?? null)
              setActiveTab("today")
            }}
            onToggleSourceHidden={(sourceId, hidden) => {
              if (hidden && sourceReviewScope?.sourceId === sourceId) setSourceReviewScope(null)
              trackRetention(hidden ? "source_hidden" : "source_restored", { sampleDeck: appState.sampleDeck })
              setAppState((current) => setMobileSourceHidden(current, sourceId, hidden))
            }}
            onToggleSourcePrivate={(sourceId, privateTitle) => {
              setAppState((current) => setMobileSourcePrivate(current, sourceId, privateTitle))
            }}
            onRemoveSource={(sourceId) => {
              if (sourceReviewScope?.sourceId === sourceId) setSourceReviewScope(null)
              if (librarySourceId === sourceId) setLibrarySourceId(null)
              trackRetention("source_removed", { sampleDeck: appState.sampleDeck })
              setAppState((current) => removeMobileSourceFromDevice(current, sourceId))
            }}
            onRestoreRemovedSource={(sourceId) => {
              trackRetention("source_restored", { fromRemoved: true, sampleDeck: appState.sampleDeck })
              setAppState((current) => restoreMobileSourceOnDevice(current, sourceId))
            }}
            onShareSavedItem={(item, source) => { void handleShareSavedItem(item, source) }}
            onSpeakSavedItem={(item) => { void handleSpeakSavedItem(item) }}
          />
        ) : null}
        {activeTab === "me" ? (
          <MeScreen
            state={appState}
            retentionDashboard={retentionDashboard}
            syncBusy={syncBusy}
            onSyncNow={() => { void handleSyncNow() }}
            onRequestSignIn={() => setAppState((current) => ({ ...current, sampleDeck: false }))}
            onSignOut={() => { void handleSignOut() }}
            onClearLocalData={handleClearLocalData}
            onDeleteCloudReviewData={handleDeleteCloudReviewData}
            onDeleteAccount={handleDeleteAccount}
            onRequestWeeklyDigestEmail={() => { void handleRequestWeeklyDigestEmail() }}
            onSubmitSupportReport={() => { void handleSubmitSupportReport() }}
            onExportAccountData={() => { void handleExportAccountData() }}
            onUpdateReminderPreference={(patch: Partial<Omit<MobileReminderPreference, "updatedAt">>) => { void handleUpdateReminderPreference(patch) }}
          />
        ) : null}
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const selected = activeTab === tab.key
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
              onPress={() => {
                if (tab.key === "today") setSourceReviewScope(null)
                if (tab.key === "library") setLibrarySourceId(null)
                setActiveTab(tab.key)
              }}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  shell: { backgroundColor: colors.paper, flex: 1 },
  brandBar: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brandMark: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 16, height: 36, justifyContent: "center", width: 36 },
  brandMarkText: { color: colors.paperElevated, fontSize: 18, fontWeight: "900" },
  brandCopy: { flex: 1 },
  brandTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  brandSubtitle: { color: colors.graphite, fontSize: 13 },
  signInPill: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  signInPillText: { color: colors.ink, fontWeight: "800" },
  scene: { flex: 1 },
  loadingState: { alignItems: "center", flex: 1, gap: spacing.sm, justifyContent: "center", padding: spacing.xl },
  loadingTitle: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  loadingCopy: { color: colors.graphite, fontSize: 16 },
  tabBar: { backgroundColor: colors.paperElevated, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  tabButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46 },
  tabButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.graphite, fontSize: 15, fontWeight: "800" },
  tabTextActive: { color: colors.paperElevated },
})
