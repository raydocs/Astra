import { useMemo, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { MIN_TOUCH_TARGET_STYLE, TOUCH_TARGET_HIT_SLOP } from "../domain/mobileAccessibility"
import { buildSavedItemSourceUrl, sampleMobileReviewSnapshot, type MobileReviewSnapshot, type SavedItem, type SourceContent } from "../domain/review"
import { colors, radii, spacing } from "../theme"

interface LibraryScreenProps {
  snapshot?: MobileReviewSnapshot
  sampleDeck?: boolean
  lastRemovedSource?: { sourceId: string; title: string; removedAt: string } | null
  onStartReview?: (source?: { sourceId: string; title: string }) => void
  privateSourceIds?: string[]
  onToggleSourceHidden?: (sourceId: string, hidden: boolean) => void
  onToggleSourcePrivate?: (sourceId: string, privateTitle: boolean) => void
  onRemoveSource?: (sourceId: string) => void
  onRestoreRemovedSource?: (sourceId: string) => void
  onShareSavedItem?: (item: SavedItem, source: SourceContent | undefined) => void
  onSpeakSavedItem?: (item: SavedItem) => void
  selectedSourceId?: string | null
  onSelectedSourceIdChange?: (sourceId: string | null) => void
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function itemMatchesQuery(item: SavedItem, source: SourceContent | undefined, query: string): boolean {
  if (!query) return true
  return [item.text, item.translation, item.context, source?.title, source?.origin, source?.url]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLocaleLowerCase().includes(query))
}

function sourceMatchesQuery(source: SourceContent, items: SavedItem[], query: string): boolean {
  if (!query) return true
  return [source.title, source.origin, source.url, source.type, ...items.map((item) => item.text), ...items.map((item) => item.translation)]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLocaleLowerCase().includes(query))
}

function openSourceUrl(url: string | undefined): void {
  if (!url) return
  void Linking.openURL(url)
}

function dueCountForSource(snapshot: MobileReviewSnapshot, sourceId: string, now = new Date()): number {
  const itemIds = new Set(snapshot.savedItems.filter((item) => item.sourceId === sourceId).map((item) => item.itemId))
  const nowTime = now.getTime()
  return snapshot.reviewCards.filter((card) => {
    if (!itemIds.has(card.itemId)) return false
    if (card.state === "suspended" || card.state === "mastered") return false
    const dueAt = new Date(card.dueAt).getTime()
    return Number.isFinite(dueAt) && dueAt <= nowTime
  }).length
}

export function LibraryScreen({ snapshot = sampleMobileReviewSnapshot, sampleDeck = true, lastRemovedSource, privateSourceIds = [], onStartReview, onToggleSourceHidden, onToggleSourcePrivate, onRemoveSource, onRestoreRemovedSource, onShareSavedItem, onSpeakSavedItem, selectedSourceId: controlledSelectedSourceId, onSelectedSourceIdChange }: LibraryScreenProps) {
  const [query, setQuery] = useState("")
  const [internalSelectedSourceId, setInternalSelectedSourceId] = useState<string | null>(null)
  const selectedSourceId = controlledSelectedSourceId !== undefined ? controlledSelectedSourceId : internalSelectedSourceId

  function setSelectedSourceId(sourceId: string | null) {
    if (controlledSelectedSourceId === undefined) {
      setInternalSelectedSourceId(sourceId)
    }
    onSelectedSourceIdChange?.(sourceId)
  }
  const normalizedQuery = normalizeQuery(query)
  const sourceById = useMemo(() => new Map(snapshot.sources.map((source) => [source.sourceId, source])), [snapshot.sources])
  const itemsBySourceId = useMemo(() => {
    const map = new Map<string, SavedItem[]>()
    for (const item of snapshot.savedItems) {
      map.set(item.sourceId, [...(map.get(item.sourceId) ?? []), item])
    }
    return map
  }, [snapshot.savedItems])
  const filteredItems = useMemo(() => snapshot.savedItems.filter((item) => itemMatchesQuery(item, sourceById.get(item.sourceId), normalizedQuery)), [normalizedQuery, snapshot.savedItems, sourceById])
  const filteredSources = useMemo(() => snapshot.sources.filter((source) => sourceMatchesQuery(source, itemsBySourceId.get(source.sourceId) ?? [], normalizedQuery)), [itemsBySourceId, normalizedQuery, snapshot.sources])
  const selectedSource = selectedSourceId ? sourceById.get(selectedSourceId) : undefined
  const selectedSourceItems = selectedSource ? itemsBySourceId.get(selectedSource.sourceId) ?? [] : []
  const privateSourceIdSet = useMemo(() => new Set(privateSourceIds), [privateSourceIds])
  const words = filteredItems.filter((item) => item.itemType !== "sentence")
  const sentences = filteredItems.filter((item) => item.itemType === "sentence")
  const hasItems = snapshot.savedItems.length > 0
  const hasSearchResults = filteredItems.length > 0 || filteredSources.length > 0

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Library</Text>
        <Text style={styles.title}>{sampleDeck ? "Sample words and sentences." : "Saved words and sentences."}</Text>
        <Text style={styles.copy}>
          {sampleDeck
            ? "Browse a small sample library before signing in."
            : hasItems
              ? "Find saved expressions by word, sentence, or source."
              : "Save words and sentences on web, then open Astra Review to browse them here."}
        </Text>
        {hasItems ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Review today cards" accessibilityHint="Start the due review queue" style={styles.primaryButton} onPress={() => onStartReview?.()}>
            <Text style={styles.primaryButtonText}>Review today cards</Text>
          </Pressable>
        ) : null}
      </View>

      {lastRemovedSource ? (
        <View style={styles.undoCard}>
          <View style={styles.undoCopy}>
            <Text style={styles.emptyTitle}>Removed from this phone.</Text>
            <Text style={styles.copy}>{lastRemovedSource.title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Undo removing ${lastRemovedSource.title}`} accessibilityHint="Restore this source on this phone" style={styles.secondaryButton} onPress={() => onRestoreRemovedSource?.(lastRemovedSource.sourceId)}>
            <Text style={styles.secondaryButtonText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      {hasItems ? (
        <TextInput
          accessibilityLabel="Search saved words, sentences, and sources"
          accessibilityHint="Filters the Library by saved text, meaning, or source"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Search words, sentences, sources"
          placeholderTextColor={colors.graphite}
          style={styles.searchInput}
          value={query}
        />
      ) : null}

      {hasItems ? null : <EmptyLibraryCard sampleDeck={sampleDeck} />}
      {hasItems && !hasSearchResults ? <EmptySearchCard query={query} /> : null}

      {selectedSource ? (
        <SourceDetailCard
          source={selectedSource}
          items={selectedSourceItems}
          dueCount={dueCountForSource(snapshot, selectedSource.sourceId)}
          onClose={() => setSelectedSourceId(null)}
          onStartReview={() => onStartReview?.({ sourceId: selectedSource.sourceId, title: selectedSource.title })}
          privateTitle={selectedSource.private === true || privateSourceIdSet.has(selectedSource.sourceId)}
          onToggleHidden={(hidden) => onToggleSourceHidden?.(selectedSource.sourceId, hidden)}
          onTogglePrivate={(privateTitle) => onToggleSourcePrivate?.(selectedSource.sourceId, privateTitle)}
          onRemove={() => onRemoveSource?.(selectedSource.sourceId)}
        />
      ) : null}

      <Section title="Words" count={words.length} />
      {words.map((item) => <LibraryRow key={item.itemId} item={item} source={sourceById.get(item.sourceId)} onShare={onShareSavedItem} onSpeak={onSpeakSavedItem} />)}

      <Section title="Sentences" count={sentences.length} />
      {sentences.map((item) => <LibraryRow key={item.itemId} item={item} source={sourceById.get(item.sourceId)} onShare={onShareSavedItem} onSpeak={onSpeakSavedItem} />)}

      <Section title="Sources" count={filteredSources.length} />
      {filteredSources.map((source) => (
        <Pressable key={source.sourceId} accessibilityRole="button" accessibilityLabel={`${source.title}. ${itemsBySourceId.get(source.sourceId)?.length ?? 0} saved. ${dueCountForSource(snapshot, source.sourceId)} due today${source.hidden ? ". Hidden from Today" : ""}.`} accessibilityHint="Open source details" style={styles.row} onPress={() => setSelectedSourceId(source.sourceId)}>
          <Text style={styles.rowTitle}>{source.title}</Text>
          <Text style={styles.rowSubtitle}>{source.type} · {source.origin ?? source.url ?? "saved source"}</Text>
          <Text style={styles.sourceText}>{itemsBySourceId.get(source.sourceId)?.length ?? 0} saved · {dueCountForSource(snapshot, source.sourceId)} due today{source.hidden ? " · hidden from Today" : ""}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function Section(props: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <Text style={styles.count}>{props.count}</Text>
    </View>
  )
}

export function LibraryRow(props: { item: SavedItem; source: SourceContent | undefined; onShare?: (item: SavedItem, source: SourceContent | undefined) => void; onSpeak?: (item: SavedItem) => void }) {
  const itemSourceUrl = buildSavedItemSourceUrl(props.item, props.source)
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{props.item.text}</Text>
      <Text style={styles.rowSubtitle}>{props.item.translation}</Text>
      {props.item.context ? <Text style={styles.contextText}>“{props.item.context}”</Text> : null}
      <Text style={styles.sourceText}>From: {props.source?.title ?? "your reading"}</Text>
      <View style={styles.rowActionGroup}>
        {props.onShare ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Share ${props.item.text}`} accessibilityHint="Share this saved card without the source URL" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.rowShareButton} onPress={() => props.onShare?.(props.item, props.source)}>
            <Text style={styles.rowShareButtonText}>Share</Text>
          </Pressable>
        ) : null}
        {props.onSpeak ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Speak ${props.item.text}`} accessibilityHint="Read this saved expression aloud" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.rowShareButton} onPress={() => props.onSpeak?.(props.item)}>
            <Text style={styles.rowShareButtonText}>Speak</Text>
          </Pressable>
        ) : null}
        {itemSourceUrl ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open source for ${props.item.text}`} accessibilityHint="Open where you saved this — at the saved moment for videos" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.rowShareButton} onPress={() => openSourceUrl(itemSourceUrl)}>
            <Text style={styles.rowShareButtonText}>Open source</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function SourceDetailCard(props: {
  source: SourceContent
  items: SavedItem[]
  dueCount: number
  onClose: () => void
  onStartReview?: () => void
  privateTitle?: boolean
  onToggleHidden?: (hidden: boolean) => void
  onTogglePrivate?: (privateTitle: boolean) => void
  onRemove?: () => void
}) {
  const previewItems = props.items.slice(0, 3)
  return (
    <View style={styles.detailCard} accessibilityLabel={`Source details for ${props.source.title}`}>
      <View style={styles.detailHeader}>
        <View style={styles.detailCopy}>
          <Text style={styles.eyebrow}>Source detail</Text>
          <Text style={styles.detailTitle}>{props.source.title}</Text>
          <Text style={styles.rowSubtitle}>{props.source.type} · {props.source.origin ?? props.source.url ?? "saved source"}{props.source.hidden ? " · hidden from Today" : ""}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close source details" accessibilityHint="Return to the Library list" hitSlop={TOUCH_TARGET_HIT_SLOP} style={styles.closePill} onPress={props.onClose}>
          <Text style={styles.closePillText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.detailStatsRow}>
        <Text style={styles.statPill}>{props.items.length} saved</Text>
        <Text style={styles.statPill}>{props.dueCount} due today</Text>
      </View>
      {previewItems.map((item) => (
        <View key={item.itemId} style={styles.detailItem}>
          <Text style={styles.detailItemText}>{item.text}</Text>
          <Text style={styles.rowSubtitle}>{item.translation}</Text>
        </View>
      ))}
      {props.source.url ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Open source, ${props.source.title}`} accessibilityHint="Open the original source link" style={styles.secondaryButton} onPress={() => openSourceUrl(props.source.url)}>
          <Text style={styles.secondaryButtonText}>Open source</Text>
        </Pressable>
      ) : null}
      {props.dueCount > 0 && !props.source.hidden ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Review due cards from ${props.source.title}`} accessibilityHint={`${props.dueCount} due ${props.dueCount === 1 ? "card" : "cards"} from this source`} style={styles.primaryButton} onPress={props.onStartReview}>
          <Text style={styles.primaryButtonText}>Review due cards</Text>
        </Pressable>
      ) : (
        <Text style={styles.rowMeta}>{props.source.hidden ? "This source is skipped by Today Review." : "Nothing due from this source right now."}</Text>
      )}
      {props.onToggleHidden ? (
        <Pressable accessibilityRole="button" accessibilityLabel={props.source.hidden ? `Restore ${props.source.title} to Today` : `Hide ${props.source.title} from Today`} accessibilityHint={props.source.hidden ? "Include this source in Today review again" : "Skip this source in Today review"} style={styles.secondaryButton} onPress={() => props.onToggleHidden?.(!props.source.hidden)}>
          <Text style={styles.secondaryButtonText}>{props.source.hidden ? "Restore to Today" : "Hide from Today"}</Text>
        </Pressable>
      ) : null}
      {props.onTogglePrivate ? (
        <Pressable accessibilityRole="button" accessibilityLabel={props.privateTitle ? `Show source title for ${props.source.title}` : `Hide source title for ${props.source.title}`} accessibilityHint="Hide or show this source title on this phone only" style={styles.secondaryButton} onPress={() => props.onTogglePrivate?.(!props.privateTitle)}>
          <Text style={styles.secondaryButtonText}>{props.privateTitle ? "Show source title" : "Hide source title"}</Text>
        </Pressable>
      ) : null}
      {props.onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${props.source.title} from this phone`} accessibilityHint="Remove this source from this phone only" style={styles.dangerButton} onPress={props.onRemove}>
          <Text style={styles.dangerButtonText}>Remove from this phone</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function EmptyLibraryCard({ sampleDeck }: { sampleDeck: boolean }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{sampleDeck ? "Try Today first." : "Your library is waiting."}</Text>
      <Text style={styles.copy}>{sampleDeck ? "Complete a sample review, then sign in to see your own saved expressions." : "Save a word or sentence on web and it will appear here after sync."}</Text>
    </View>
  )
}

function EmptySearchCard({ query }: { query: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No saved match yet.</Text>
      <Text style={styles.copy}>Nothing matched “{query}”. Try a shorter word or source title.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing.md, padding: spacing.lg },
  headerCard: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  eyebrow: { color: colors.sealRed, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "500", lineHeight: 36 },
  copy: { color: colors.graphite, fontSize: 16, lineHeight: 24 },
  searchInput: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  count: { color: colors.graphite, fontWeight: "800" },
  row: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  rowSubtitle: { color: colors.graphite, fontSize: 15, lineHeight: 22 },
  rowMeta: { color: colors.graphite, fontSize: 13, fontWeight: "700" },
  rowActionGroup: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rowShareButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", alignSelf: "flex-start", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", paddingHorizontal: spacing.md },
  rowShareButtonText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  contextText: { color: colors.graphite, fontSize: 14, lineHeight: 20 },
  sourceText: { color: colors.sealRed, fontSize: 13, fontWeight: "700" },
  undoCard: { alignItems: "center", backgroundColor: "#EEF5EA", borderColor: "#C9DDC0", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: spacing.md, justifyContent: "space-between", padding: spacing.md },
  undoCopy: { flex: 1, gap: spacing.xs },
  detailCard: { backgroundColor: "#FFF5DF", borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  detailHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  detailCopy: { flex: 1, gap: spacing.xs },
  detailTitle: { color: colors.ink, fontSize: 24, fontWeight: "700", lineHeight: 30 },
  detailStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  detailItem: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  detailItemText: { color: colors.ink, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  statPill: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.ink, fontWeight: "800", paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  closePill: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  closePillText: { color: colors.ink, fontWeight: "800" },
  primaryButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", backgroundColor: colors.ink, borderRadius: radii.pill, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  primaryButtonText: { color: colors.paperElevated, fontSize: 15, fontWeight: "900" },
  secondaryButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  dangerButton: { ...MIN_TOUCH_TARGET_STYLE, alignItems: "center", borderColor: colors.sealRed, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dangerButtonText: { color: colors.sealRed, fontSize: 15, fontWeight: "900" },
  emptyCard: { backgroundColor: "#F1E2C5", borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
})
