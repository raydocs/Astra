import { useMemo, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { colors, radii, spacing } from "../theme"
import {
  MIN_TOUCH_TARGET_STYLE,
  TOUCH_TARGET_HIT_SLOP,
  buildReviewCardAccessibilityLabel,
  buildReviewFrontAccessibilityLabel,
  buildReviewProgressAccessibilityLabel,
  buildReviewRatingAccessibilityLabel,
} from "../domain/mobileAccessibility"
import {
  buildTodayReviewQueue,
  buildWeeklyDigestSnapshot,
  sampleMobileReviewSnapshot,
  type MobileDigestSnapshot,
  type MobileReviewCardViewModel,
  type MobileReviewSnapshot,
  type ReviewRating,
} from "../domain/review"
import type { OfflineReviewQueueState } from "../domain/offlineQueue"

interface TodayScreenProps {
  onOpenLibrary: () => void
  snapshot?: MobileReviewSnapshot
  sampleDeck?: boolean
  weeklyDigest?: MobileDigestSnapshot | null
  offlineQueue?: OfflineReviewQueueState
  sourceReview?: { sourceId: string; title: string } | null
  onClearSourceReview?: () => void
  onRateCard?: (cardId: string, rating: ReviewRating) => void
  onMarkCardNotUseful?: (cardId: string) => void
  onShareCard?: (card: MobileReviewCardViewModel) => void
  onSpeakCard?: (card: MobileReviewCardViewModel) => void
  onViewSource?: (card: MobileReviewCardViewModel) => void
}

export function TodayScreen({ onOpenLibrary, snapshot = sampleMobileReviewSnapshot, sampleDeck = true, weeklyDigest = null, offlineQueue, sourceReview, onClearSourceReview, onRateCard, onMarkCardNotUseful, onShareCard, onSpeakCard, onViewSource }: TodayScreenProps) {
  const [answered, setAnswered] = useState(false)
  const [sampleCompletedCardIds, setSampleCompletedCardIds] = useState<Set<string>>(() => new Set())
  const queueState = offlineQueue
  const queue = useMemo(() => buildTodayReviewQueue(snapshot, new Date(), sourceReview ? { sourceId: sourceReview.sourceId } : {}), [snapshot, sourceReview])
  const reviewEvents = useMemo(() => queueState?.operations.map((operation) => operation.event) ?? [], [queueState])
  const queuedCompletedCardIds = useMemo(() => new Set(reviewEvents.map((event) => event.cardId)), [reviewEvents])
  const localDigest = useMemo(() => buildWeeklyDigestSnapshot(snapshot, reviewEvents), [reviewEvents, snapshot])
  const digest = weeklyDigest ?? localDigest
  const completedCardIds = sampleDeck ? sampleCompletedCardIds : queuedCompletedCardIds
  const activeQueue = queue.filter((card) => !completedCardIds.has(card.cardId))
  const currentCard = activeQueue[0]
  const completedCount = queue.length - activeQueue.length

  function rateCurrentCard(rating: ReviewRating) {
    if (!currentCard || completedCardIds.has(currentCard.cardId)) return
    if (sampleDeck) {
      setSampleCompletedCardIds((current) => new Set(current).add(currentCard.cardId))
    }
    onRateCard?.(currentCard.cardId, rating)
    setAnswered(false)
  }

  function markCurrentCardNotUseful() {
    if (!currentCard || completedCardIds.has(currentCard.cardId)) return
    if (sampleDeck) {
      setSampleCompletedCardIds((current) => new Set(current).add(currentCard.cardId))
    }
    onMarkCardNotUseful?.(currentCard.cardId)
    setAnswered(false)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard} accessibilityRole="summary">
        <Text style={styles.dateLabel}>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</Text>
        <Text style={styles.eyebrow}>{sourceReview ? "Source Review" : "Today Review"}</Text>
        {sourceReview ? <Text style={styles.sourceScopeText}>From: {sourceReview.title}</Text> : null}
        <Text style={styles.heroTitle}>
          {currentCard
            ? sourceReview
              ? `${activeQueue.length} ${activeQueue.length === 1 ? "card is" : "cards are"} ready from this source.`
              : sampleDeck
                ? `${activeQueue.length} sample ${activeQueue.length === 1 ? "card is" : "cards are"} ready.`
                : `${activeQueue.length} ${activeQueue.length === 1 ? "card is" : "cards are"} ready from your web reading.`
            : sourceReview ? "Done for this source." : "Done for today."}
        </Text>
        <Text style={styles.heroCopy}>
          {currentCard
            ? sourceReview
              ? "Review only the due cards from this saved source."
              : sampleDeck
                ? "Try the mobile review flow with safe sample cards."
                : "Review in about 3 minutes. No setup, no pressure."
            : sourceReview
              ? "Source review complete. You can return to the full Today queue."
              : sampleDeck
                ? "Sample review complete. Sign in later to sync your own saved cards."
                : "Your review choices are saved on this device for the next sync."}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.pill}>{queue.length} cards</Text>
          <Text style={styles.pill}>{sampleDeck ? "sample" : `${queueState?.operations.length ?? 0} offline-ready`}</Text>
          <Text style={styles.pill}>{sourceReview ? "one source" : "source-backed"}</Text>
        </View>
        {sourceReview ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to all Today cards" accessibilityHint="Return from this source review to the full Today review queue" style={styles.secondaryButton} onPress={onClearSourceReview}>
            <Text style={styles.secondaryButtonText}>Back to all Today cards</Text>
          </Pressable>
        ) : null}
        <View style={styles.progressRow} accessible accessibilityRole="progressbar" accessibilityLabel={buildReviewProgressAccessibilityLabel(completedCount, queue.length)}>
          {queue.map((card, index) => (
            <View key={card.cardId} style={[styles.progressDot, index < completedCount && styles.progressDotDone]} />
          ))}
        </View>
      </View>

      <DigestPreview digest={digest} sampleDeck={sampleDeck} />

      {currentCard ? (
        <ReviewCard card={currentCard} answered={answered} onShowAnswer={() => setAnswered(true)} onRate={rateCurrentCard} onMarkNotUseful={markCurrentCardNotUseful} onShareCard={onShareCard} onSpeakCard={onSpeakCard} onViewSource={onViewSource} />
      ) : (
        <View style={styles.completeCard} accessible accessibilityLabel={sourceReview ? "Source review complete. You can return to all Today cards or view the Library." : "Today review complete. You can come back tomorrow or view the Library."}>
          <Text style={styles.stamp}>Done</Text>
          <Text style={styles.completeTitle}>{sourceReview ? "Done for this source." : "Done for today."}</Text>
          <Text style={styles.heroCopy}>{sourceReview ? "Return to the full Today queue or browse the learning library." : "Come back tomorrow for a quick refresh, or browse the learning library."}</Text>
          <Pressable style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="View Library" accessibilityHint="Open your saved words, sentences, and sources" onPress={onOpenLibrary}>
            <Text style={styles.primaryButtonText}>View Library</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

function DigestPreview({ digest, sampleDeck }: { digest: MobileDigestSnapshot; sampleDeck: boolean }) {
  const sourceSummary = digest.sourceBreakdown.length > 0
    ? digest.sourceBreakdown.map((source) => `${source.count} ${source.type}`).join(" · ")
    : "saved reading"
  const focusWords = digest.highlightedWords.length > 0 ? digest.highlightedWords.join(" · ") : "your saved words"
  const sentence = digest.highlightedSentences[0]

  return (
    <View style={styles.digestCard} accessibilityLabel="Weekly learning note">
      <Text style={styles.digestEyebrow}>This week with Astra</Text>
      <Text style={styles.digestTitle}>
        {sampleDeck
          ? "A quiet note will summarize your saved learning."
          : `${digest.savedCount} saved, ${digest.reviewedCount} reviewed.`}
      </Text>
      <Text style={styles.heroCopy}>
        {sampleDeck
          ? "After you sign in, Astra turns your web saves into a weekly learning note on this phone."
          : `From ${sourceSummary}. ${digest.nextReviewCount > 0 ? `${digest.nextReviewCount} cards are ready soon.` : "Keep a light pace and review when ready."}`}
      </Text>
      <View style={styles.digestDivider} />
      <Text style={styles.digestLabel}>Expressions to remember</Text>
      <Text style={styles.digestFocus}>{focusWords}</Text>
      {sentence ? <Text style={styles.digestSentence}>“{sentence}”</Text> : null}
    </View>
  )
}

function openSourceUrl(url: string | undefined): void {
  if (!url) return
  void Linking.openURL(url)
}

function ReviewCard(props: {
  card: MobileReviewCardViewModel
  answered: boolean
  onShowAnswer: () => void
  onRate: (rating: ReviewRating) => void
  onMarkNotUseful: () => void
  onShareCard?: (card: MobileReviewCardViewModel) => void
  onSpeakCard?: (card: MobileReviewCardViewModel) => void
  onViewSource?: (card: MobileReviewCardViewModel) => void
}) {
  return (
    <View style={styles.reviewCard} accessibilityLabel={buildReviewCardAccessibilityLabel(props.card.type, props.card.sourceTitle)}>
      <View style={styles.sourceRow} accessible accessibilityLabel={`Source: ${props.card.sourceType}, ${props.card.sourceTitle}`}> 
        <Text style={styles.sourceBadge}>{props.card.sourceType}</Text>
        <Text style={styles.sourceText}>From: {props.card.sourceTitle}</Text>
      </View>
      <View style={styles.sourceActionsRow}>
        {props.onViewSource ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View source, ${props.card.sourceTitle}`} accessibilityHint="Open this source inside the Library" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.sourceLinkButton} onPress={() => props.onViewSource?.(props.card)}>
            <Text style={styles.sourceLinkText}>View source</Text>
          </Pressable>
        ) : null}
        {props.card.sourceUrl ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open source, ${props.card.sourceTitle}`} accessibilityHint="Open the original source link" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.sourceLinkButton} onPress={() => openSourceUrl(props.card.sourceUrl)}>
            <Text style={styles.sourceLinkText}>Open source</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.cardKind}>{props.card.type === "sentence" ? "Sentence Card" : "Word Card"}</Text>
      <Text accessibilityLabel={buildReviewFrontAccessibilityLabel(props.card.type, props.card.front)} style={props.card.type === "sentence" ? styles.sentenceFront : styles.wordFront}>{props.card.front}</Text>
      {props.onSpeakCard ? (
        <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel={props.card.type === "sentence" ? "Speak sentence front" : "Play word front"} accessibilityHint="Speak only the front of this card" onPress={() => props.onSpeakCard?.(props.card)}>
          <Text style={styles.secondaryButtonText}>{props.card.type === "sentence" ? "Speak" : "Play"}</Text>
        </Pressable>
      ) : null}
      {props.card.context ? <Text style={styles.contextText}>“{props.card.context}”</Text> : null}

      {props.answered ? (
        <View style={styles.answerBlock}>
          <Text style={styles.answerLabel}>Meaning</Text>
          <Text style={styles.answerText}>{props.card.translation}</Text>
          <Text style={styles.answerLabel}>Why it matters</Text>
          <Text style={styles.answerText}>{props.card.explanation}</Text>
          {props.onShareCard ? (
            <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Share card" accessibilityHint="Share this card without the source URL" onPress={() => props.onShareCard?.(props.card)}>
              <Text style={styles.secondaryButtonText}>Share card</Text>
            </Pressable>
          ) : null}
          <View style={styles.ratingRow}>
            <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel={buildReviewRatingAccessibilityLabel("again")} accessibilityHint="Review this card again soon" onPress={() => props.onRate("again")}>
              <Text style={styles.secondaryButtonText}>Again</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} accessibilityRole="button" accessibilityLabel={buildReviewRatingAccessibilityLabel("good")} accessibilityHint="Mark this card as remembered" onPress={() => props.onRate("good")}>
              <Text style={styles.primaryButtonText}>Good</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel={buildReviewRatingAccessibilityLabel("easy")} accessibilityHint="Move this easy card forward" onPress={() => props.onRate("easy")}>
              <Text style={styles.secondaryButtonText}>Easy</Text>
            </Pressable>
            <Pressable style={styles.quietButton} accessibilityRole="button" accessibilityLabel={buildReviewRatingAccessibilityLabel("skip")} accessibilityHint="Skip this card without marking it learned" onPress={() => props.onRate("skip")}>
              <Text style={styles.quietButtonText}>Skip</Text>
            </Pressable>
            <Pressable style={styles.quietButton} accessibilityRole="button" accessibilityLabel={buildReviewRatingAccessibilityLabel("notUseful")} accessibilityHint="Remove this card from Today on this phone" onPress={props.onMarkNotUseful}>
              <Text style={styles.quietButtonText}>Not useful</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Show answer" accessibilityHint="Reveal the meaning, explanation, and review choices" onPress={props.onShowAnswer}>
          <Text style={styles.primaryButtonText}>Show answer</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, gap: spacing.md },
  heroCard: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  dateLabel: { color: colors.graphite, fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  eyebrow: { color: colors.sealRed, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  heroTitle: { color: colors.ink, fontSize: 36, fontWeight: "500", lineHeight: 38 },
  heroCopy: { color: colors.graphite, fontSize: 16, lineHeight: 23 },
  sourceScopeText: { color: colors.graphite, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pill: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.ink, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  progressRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  progressDot: { backgroundColor: colors.border, borderRadius: radii.pill, flex: 1, height: 6 },
  progressDotDone: { backgroundColor: colors.sealRed },
  digestCard: { backgroundColor: "#FFF5DF", borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  digestDivider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.xs },
  digestEyebrow: { color: colors.sealRed, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  digestTitle: { color: colors.ink, fontSize: 24, fontWeight: "600", lineHeight: 30 },
  digestLabel: { color: colors.graphite, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  digestFocus: { color: colors.ink, fontSize: 20, fontWeight: "700", lineHeight: 27 },
  digestSentence: { color: colors.graphite, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  reviewCard: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  sourceRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sourceBadge: { backgroundColor: "#F1E2C5", borderRadius: radii.pill, color: colors.ink, fontSize: 12, fontWeight: "800", overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, textTransform: "uppercase" },
  sourceText: { color: colors.graphite, flexShrink: 1 },
  sourceActionsRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sourceLinkButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", alignSelf: "flex-start", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  sourceLinkText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  cardKind: { color: colors.graphite, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  wordFront: { color: colors.ink, fontSize: 52, fontWeight: "500", lineHeight: 56 },
  sentenceFront: { color: colors.ink, fontSize: 28, fontWeight: "500", lineHeight: 35 },
  contextText: { color: colors.graphite, fontSize: 17, lineHeight: 26 },
  answerBlock: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.md },
  answerLabel: { color: colors.sealRed, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  answerText: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  ratingRow: { gap: spacing.sm },
  primaryButton: { alignItems: "center", backgroundColor: colors.sealRed, borderRadius: radii.pill, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryButtonText: { color: "#FFF9EC", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  quietButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  quietButtonText: { color: colors.graphite, fontSize: 15, fontWeight: "800" },
  completeCard: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  stamp: { alignSelf: "flex-end", borderColor: colors.sealRed, borderRadius: radii.pill, borderWidth: 2, color: colors.sealRed, fontSize: 22, fontWeight: "700", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, transform: [{ rotate: "-8deg" }] },
  completeTitle: { color: colors.ink, fontSize: 34, fontWeight: "500" },
})
