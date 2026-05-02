/**
 * Blocking quality gate for explanation outputs.
 *
 * Unlike the advisory translation quality check, this is used before an
 * explanation is treated as successful or persisted. It intentionally keeps
 * to cheap deterministic heuristics so popup/content flows can call it inline.
 */

import type { ExplanationGlossaryTerm } from "@/types/config"

export type ExplanationQualityIssue =
  | "empty"
  | "source_echo"
  | "source_dominant_echo"
  | "too_short_for_source"
  | "warning_like"
  | "missing_glossary_term"
  | "repetitive_output"

export interface ExplanationQualityPass {
  ok: true
}

export interface ExplanationQualityFailure {
  ok: false
  issue: ExplanationQualityIssue
  message: string
}

export type ExplanationQualityResult = ExplanationQualityPass | ExplanationQualityFailure

export type MatchedExplanationGlossaryTerm = Pick<ExplanationGlossaryTerm, "sourceTerm" | "preferredTerm">

export type ExplanationQualityGlossaryTerm = Pick<ExplanationGlossaryTerm, "sourceTerm" | "preferredTerm"> & { enabled?: boolean }

interface ExplanationQualityRequest {
  source: string
  explanation: string
  requiredGlossaryTerms?: ExplanationQualityGlossaryTerm[]
}

interface MatchedExplanationGlossaryTermsRequest {
  source: string
  glossaryTerms?: ExplanationQualityGlossaryTerm[]
}

const LONG_SOURCE_CHAR_THRESHOLD = 100
const LONG_SOURCE_TOKEN_THRESHOLD = 16
const SHORT_EXPLANATION_CHAR_THRESHOLD = 36
const SHORT_EXPLANATION_TOKEN_THRESHOLD = 6
const REPEATED_SENTENCE_MIN_COUNT = 3
const REPEATED_SENTENCE_MIN_CHARS = 10
const REPEATED_PHRASE_MIN_TOKENS = 2
const REPEATED_PHRASE_MAX_TOKENS = 8
const REPEATED_PHRASE_MIN_REPEATS = 3
const REPEATED_PHRASE_MIN_TOKEN_SHARE = 0.55

const WARNING_LIKE_PREFIXES = [
  "⚠",
  "warning:",
  "warn:",
  "error:",
  "failed:",
  "failure:",
  "unable to",
  "could not",
  "cannot ",
  "can't ",
  "i'm sorry",
  "i’m sorry",
  "sorry,",
]

function fail(issue: ExplanationQualityIssue, message: string): ExplanationQualityFailure {
  return { ok: false, issue, message }
}

const EXPLANATION_REPAIR_REQUIREMENTS: Record<ExplanationQualityIssue, string> = {
  empty: "Return a substantive learner-facing explanation instead of an empty string.",
  source_echo: "Explain the meaning in your own words; do not echo the source text as the explanation.",
  source_dominant_echo: "Reduce copied source wording and explain meaning, grammar, tone, or vocabulary in fresh wording.",
  too_short_for_source: "Expand the explanation enough to cover the selected text's meaning and key language points.",
  warning_like: "Do not return warnings, apologies, or provider-error text; produce the requested explanation only.",
  missing_glossary_term: "Preserve the required explanation glossary and include every matched preferred term exactly.",
  repetitive_output: "Rewrite once without repeated sentence or phrase loops.",
}

export function buildExplanationRepairInstruction(failure: ExplanationQualityFailure): string {
  return [
    "Astra rejected the previous explanation before showing or saving it.",
    `Quality issue: ${failure.message}`,
    `Repair requirement: ${EXPLANATION_REPAIR_REQUIREMENTS[failure.issue]}`,
    "Regenerate the explanation only; preserve the original target language, learner level, explain mode, page context, and required glossary terms. Return strict JSON in the normal translations array.",
  ].join(" ")
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeForEcho(value: string): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeForEcho(value)
    .split(" ")
    .filter((token) => token.length > 0)
}

function isWarningLike(explanation: string): boolean {
  const normalized = normalizeText(explanation)
  return WARNING_LIKE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

function splitNormalizedSentences(value: string): string[] {
  return normalizeText(value)
    .split(/[.!?。！？]+/u)
    .map((sentence) => normalizeForEcho(sentence))
    .filter((sentence) => sentence.length >= REPEATED_SENTENCE_MIN_CHARS)
}

function hasRepeatedSentenceLoop(explanation: string): boolean {
  const sentenceCounts = new Map<string, number>()
  for (const sentence of splitNormalizedSentences(explanation)) {
    const nextCount = (sentenceCounts.get(sentence) ?? 0) + 1
    if (nextCount >= REPEATED_SENTENCE_MIN_COUNT) return true
    sentenceCounts.set(sentence, nextCount)
  }

  return false
}

function countPhraseOccurrences(tokens: string[], phraseTokens: string[]): number {
  let count = 0
  for (let index = 0; index <= tokens.length - phraseTokens.length; index += 1) {
    let matches = true
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (tokens[index + offset] !== phraseTokens[offset]) {
        matches = false
        break
      }
    }
    if (matches) count += 1
  }

  return count
}

function hasRepeatedPhraseLoop(explanation: string): boolean {
  const tokens = tokenize(explanation)
  if (tokens.length < REPEATED_PHRASE_MIN_TOKENS * REPEATED_PHRASE_MIN_REPEATS) return false

  for (let phraseLength = REPEATED_PHRASE_MIN_TOKENS; phraseLength <= REPEATED_PHRASE_MAX_TOKENS; phraseLength += 1) {
    if (tokens.length < phraseLength * REPEATED_PHRASE_MIN_REPEATS) break

    const seenPhrases = new Set<string>()
    for (let start = 0; start <= tokens.length - phraseLength; start += 1) {
      const phraseTokens = tokens.slice(start, start + phraseLength)
      const phraseKey = phraseTokens.join("\u0000")
      if (seenPhrases.has(phraseKey)) continue
      seenPhrases.add(phraseKey)

      const occurrences = countPhraseOccurrences(tokens, phraseTokens)
      if (occurrences < REPEATED_PHRASE_MIN_REPEATS) continue

      const repeatedTokenShare = (occurrences * phraseLength) / tokens.length
      if (repeatedTokenShare >= REPEATED_PHRASE_MIN_TOKEN_SHARE) {
        return true
      }
    }
  }

  return false
}

function isRepetitiveOutput(explanation: string): boolean {
  return hasRepeatedSentenceLoop(explanation) || hasRepeatedPhraseLoop(explanation)
}

function isSourceDominantEcho(source: string, explanation: string): boolean {
  const normalizedSource = normalizeForEcho(source)
  const normalizedExplanation = normalizeForEcho(explanation)

  if (!normalizedSource || !normalizedExplanation) return false
  if (normalizedSource === normalizedExplanation) return true

  const sourceLength = normalizedSource.length
  const explanationLength = normalizedExplanation.length
  if (
    normalizedExplanation.includes(normalizedSource)
    && explanationLength <= sourceLength * 1.35
  ) {
    return true
  }

  const sourceTokens = tokenize(source)
  const explanationTokens = tokenize(explanation)
  if (sourceTokens.length < 4 || explanationTokens.length < 4) return false

  const sourceTokenSet = new Set(sourceTokens)
  const sharedOutputTokens = explanationTokens.filter((token) => sourceTokenSet.has(token)).length
  const outputSourceShare = sharedOutputTokens / explanationTokens.length
  const sourceCoverage = new Set(explanationTokens.filter((token) => sourceTokenSet.has(token))).size / sourceTokenSet.size
  const lengthRatio = explanationTokens.length / sourceTokens.length

  return sourceCoverage >= 0.75
    && outputSourceShare >= 0.75
    && lengthRatio >= 0.75
    && lengthRatio <= 1.5
}

function isSuspiciouslyShortForLongSource(source: string, explanation: string): boolean {
  const sourceTokens = tokenize(source)
  const explanationTokens = tokenize(explanation)
  const sourceLength = source.trim().length
  const explanationLength = explanation.trim().length

  const longSource = sourceLength >= LONG_SOURCE_CHAR_THRESHOLD
    || sourceTokens.length >= LONG_SOURCE_TOKEN_THRESHOLD
  if (!longSource) return false

  return explanationLength < SHORT_EXPLANATION_CHAR_THRESHOLD
    || explanationTokens.length < SHORT_EXPLANATION_TOKEN_THRESHOLD
}

function normalizeForTermMatch(value: string): string {
  return normalizeText(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function shouldUseBoundaryTermMatch(term: string): boolean {
  return /[\p{Script=Latin}\p{N}]/u.test(term)
}

function includesTerm(value: string, term: string): boolean {
  const normalizedValue = normalizeForTermMatch(value)
  const normalizedTerm = normalizeForTermMatch(term)
  if (!normalizedValue || !normalizedTerm) return false

  if (!shouldUseBoundaryTermMatch(normalizedTerm)) {
    return normalizedValue.includes(normalizedTerm)
  }

  const termPattern = escapeRegExp(normalizedTerm).replace(/\s+/gu, "\\s+")
  return new RegExp(`(^|[^\\p{L}\\p{N}])${termPattern}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalizedValue)
}

export function getMatchedExplanationGlossaryTerms({
  source,
  glossaryTerms = [],
}: MatchedExplanationGlossaryTermsRequest): MatchedExplanationGlossaryTerm[] {
  const matchedTerms: MatchedExplanationGlossaryTerm[] = []
  const seen = new Set<string>()

  for (const term of glossaryTerms) {
    if (term.enabled === false) continue
    const sourceTerm = term.sourceTerm.trim()
    const preferredTerm = term.preferredTerm.trim()
    if (!sourceTerm || !preferredTerm) continue
    if (!includesTerm(source, sourceTerm)) continue

    const key = `${normalizeForTermMatch(sourceTerm)}\u0000${normalizeForTermMatch(preferredTerm)}`
    if (seen.has(key)) continue
    seen.add(key)
    matchedTerms.push({ sourceTerm, preferredTerm })
  }

  return matchedTerms
}

function findMissingRequiredGlossaryTerm(
  explanation: string,
  matchedGlossaryTerms: MatchedExplanationGlossaryTerm[] = [],
): MatchedExplanationGlossaryTerm | null {
  for (const term of matchedGlossaryTerms) {
    if (!includesTerm(explanation, term.preferredTerm)) {
      return term
    }
  }

  return null
}

export function validateExplanationQuality({
  source,
  explanation,
  requiredGlossaryTerms = [],
}: ExplanationQualityRequest): ExplanationQualityResult {
  const trimmedExplanation = explanation.trim()
  if (!trimmedExplanation) {
    return fail("empty", "Explanation output was empty. Please retry.")
  }

  if (isWarningLike(trimmedExplanation)) {
    return fail("warning_like", "Explanation output looked like a warning or provider error. Please retry.")
  }

  if (isRepetitiveOutput(trimmedExplanation)) {
    return fail("repetitive_output", "Explanation output repeated itself in a loop. Please retry.")
  }

  const normalizedSource = normalizeForEcho(source)
  const normalizedExplanation = normalizeForEcho(trimmedExplanation)
  if (normalizedSource && normalizedSource === normalizedExplanation) {
    return fail("source_echo", "Explanation output echoed the source text. Please retry.")
  }

  if (isSourceDominantEcho(source, trimmedExplanation)) {
    return fail("source_dominant_echo", "Explanation output was dominated by source text. Please retry.")
  }

  if (isSuspiciouslyShortForLongSource(source, trimmedExplanation)) {
    return fail("too_short_for_source", "Explanation output was too short for the selected text. Please retry.")
  }

  const matchedGlossaryTerms = getMatchedExplanationGlossaryTerms({
    source,
    glossaryTerms: requiredGlossaryTerms,
  })
  const missingGlossaryTerm = findMissingRequiredGlossaryTerm(trimmedExplanation, matchedGlossaryTerms)
  if (missingGlossaryTerm) {
    return fail(
      "missing_glossary_term",
      `Explanation output omitted required glossary term "${missingGlossaryTerm.preferredTerm}" for source term "${missingGlossaryTerm.sourceTerm}". Please retry.`,
    )
  }

  return { ok: true }
}
