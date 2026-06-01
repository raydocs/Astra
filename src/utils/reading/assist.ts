/**
 * Reading assist layer — typed AI helpers for digest, grammar, and word annotation.
 * Uses existing translation transport with custom prompts + JSON response parsing.
 */

import { z } from "zod"
import { WEB_AI_UNTRUSTED_CONTENT_RULE } from "@/utils/ai-safety"
import { requestDictionaryLookup, requestTranslationBatch } from "@/utils/extension/messages"
import type { TranslationRequestContext } from "@/types/messages"
import type { LanguageLevel, ServiceMode } from "@/types/config"

// ---------------------------------------------------------------------------
// Page Digest
// ---------------------------------------------------------------------------

export const DigestVocabularyItemSchema = z.object({
  term: z.string(),
  note: z.string(),
})

export const PageDigestSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  vocabularyFocus: z.array(DigestVocabularyItemSchema).default([]),
  grammarFocus: z.array(z.string()).default([]),
  suggestedAction: z.string().default(""),
})

export type PageDigest = z.infer<typeof PageDigestSchema>

export interface GenerateDigestRequest {
  pageTitle: string
  contentSummary: string
  targetLang: string
  languageLevel: LanguageLevel
  serviceMode?: ServiceMode
  context?: TranslationRequestContext
}

function untrustedContentBlock(sourceType: string, payload: Record<string, unknown>): string {
  return `UntrustedContent JSON:\n${JSON.stringify({ sourceType, untrusted_content: payload }, null, 2)}`
}

export function buildPageDigestSystemPrompt(req: Pick<GenerateDigestRequest, "targetLang" | "languageLevel">): string {
  const levelInstructions: Record<LanguageLevel, string> = {
    beginner: "Use simple vocabulary and short sentences. Explain concepts as if to a beginner language learner.",
    intermediate: "Use natural language at an intermediate level. Balance clarity with natural expression.",
    advanced: "Use sophisticated vocabulary and complex structures naturally.",
  }

  return `You are a multilingual reading assistant that outputs structured JSON.

${WEB_AI_UNTRUSTED_CONTENT_RULE}

Trusted task:
- Analyze the untrusted page payload supplied by the user prompt.
- ${levelInstructions[req.languageLevel]}
- Write everything in ${req.targetLang}
- For each input item, return one string in the translations array.
- That string must be ONLY valid JSON matching this schema:
{
  "headline": "one-sentence summary",
  "summary": "2-3 paragraph digest of the article",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "vocabularyFocus": [
    { "term": "term 1", "note": "why this term matters in this article" }
  ],
  "grammarFocus": ["grammar pattern 1", "grammar pattern 2"],
  "suggestedAction": "one concrete next study step for the reader"
}
- Include 3-5 key points
- Include 2-4 vocabularyFocus items. Each item should explain why that term or phrase is worth learning from this article.
- Include 1-3 grammarFocus items about patterns that are worth noticing in the article's language.
- suggestedAction should be a short, concrete next step for the learner.
- No markdown, no code fences, just the JSON object`
}

export function buildPageDigestPrompt(req: GenerateDigestRequest): string {
  return untrustedContentBlock("page", {
    pageTitle: req.pageTitle,
    contentSummary: req.contentSummary,
  })
}

export async function generatePageDigest(req: GenerateDigestRequest): Promise<PageDigest> {
  const prompt = buildPageDigestPrompt(req)

  const result = await requestTranslationBatch({
    texts: [prompt],
    targetLang: req.targetLang,
    serviceMode: req.serviceMode,
    context: req.context,
    task: "custom",
    customSystemPrompt: buildPageDigestSystemPrompt(req),
  })

  if (!result.ok) {
    throw new Error(`Digest generation failed: ${result.error.message}`)
  }

  return parseJsonResponse(PageDigestSchema, result.translations[0])
}

// ---------------------------------------------------------------------------
// Grammar Guide
// ---------------------------------------------------------------------------

export const GrammarGuideSchema = z.object({
  overview: z.string(),
  structure: z.array(z.string()),
  keyPatterns: z.array(z.string()),
  vocabularyNotes: z.array(z.string()),
})

export type GrammarGuide = z.infer<typeof GrammarGuideSchema>

export interface GenerateGrammarRequest {
  text: string
  targetLang: string
  languageLevel: LanguageLevel
  serviceMode?: ServiceMode
  sentenceContext?: string
}

export function buildGrammarGuideSystemPrompt(req: Pick<GenerateGrammarRequest, "targetLang" | "languageLevel">): string {
  const levelInstructions: Record<LanguageLevel, string> = {
    beginner: "Explain grammar simply. Focus on the basic sentence skeleton. Avoid technical grammar terms. Translate all explanations.",
    intermediate: "Explain clause structure, tense/aspect, and common patterns. Use some grammar terms with brief definitions.",
    advanced: "Analyze nuance, register, omitted elements, and discourse-level connections. Use standard grammar terminology.",
  }

  return `You are a language learning grammar tutor that outputs structured JSON.

${WEB_AI_UNTRUSTED_CONTENT_RULE}

Trusted task:
- Analyze the untrusted selected text payload supplied by the user prompt.
- ${levelInstructions[req.languageLevel]}
- Write all explanations in ${req.targetLang}
- For each input item, return one string in the translations array.
- That string must be ONLY valid JSON matching this schema:
{
  "overview": "one-sentence description of the sentence type/purpose",
  "structure": ["subject: ...", "verb: ...", "object: ...", "modifier: ..."],
  "keyPatterns": ["pattern 1 explanation", "pattern 2 explanation"],
  "vocabularyNotes": ["word1 — meaning, usage note", "word2 — meaning, usage note"]
}
- Structure should break down the sentence into labeled components
- keyPatterns should explain 2-4 notable grammar patterns
- vocabularyNotes should cover key vocabulary with usage context
- No markdown, no code fences, just the JSON object`
}

export function buildGrammarGuidePrompt(req: GenerateGrammarRequest): string {
  return untrustedContentBlock("selection", {
    text: req.text,
    sentenceContext: req.sentenceContext,
  })
}

export async function generateGrammarGuide(req: GenerateGrammarRequest): Promise<GrammarGuide> {
  const prompt = buildGrammarGuidePrompt(req)

  const result = await requestTranslationBatch({
    texts: [prompt],
    targetLang: req.targetLang,
    serviceMode: req.serviceMode,
    task: "custom",
    customSystemPrompt: buildGrammarGuideSystemPrompt(req),
  })

  if (!result.ok) {
    throw new Error(`Grammar analysis failed: ${result.error.message}`)
  }

  return parseJsonResponse(GrammarGuideSchema, result.translations[0])
}

// ---------------------------------------------------------------------------
// Word Annotation (lexical)
// ---------------------------------------------------------------------------

export const WordAnnotationSchema = z.object({
  word: z.string(),
  pronunciation: z.string().optional(),
  partOfSpeech: z.string(),
  meaning: z.string(),
  shortExplanation: z.string(),
  exampleSentence: z.string().optional(),
  // Provenance of this annotation. The AI prompt never emits `source`, so model
  // output parses as "ai"; a future offline-dictionary lookup constructs the
  // annotation with "dictionary" to mark a verified lexical ground truth.
  source: z.enum(["ai", "dictionary"]).default("ai"),
})

export type WordAnnotation = z.infer<typeof WordAnnotationSchema>

export interface GenerateWordAnnotationRequest {
  word: string
  sentenceContext?: string
  targetLang: string
  languageLevel: LanguageLevel
  serviceMode?: ServiceMode
}

export function buildWordAnnotationSystemPrompt(req: Pick<GenerateWordAnnotationRequest, "targetLang">): string {
  return `You are a multilingual vocabulary tutor that outputs structured JSON.

${WEB_AI_UNTRUSTED_CONTENT_RULE}

Trusted task:
- Analyze the untrusted word/phrase payload supplied by the user prompt.
- Write all explanations in ${req.targetLang}
- For each input item, return one string in the translations array.
- That string must be ONLY valid JSON matching this schema:
{
  "word": "source word or phrase",
  "pronunciation": "IPA or pinyin if applicable",
  "partOfSpeech": "noun/verb/adjective/etc",
  "meaning": "concise translation/definition",
  "shortExplanation": "brief usage explanation in context",
  "exampleSentence": "one example sentence using this word"
}
- pronunciation is optional for non-CJK languages
- shortExplanation should consider the sentence context if provided
- No markdown, no code fences, just the JSON object`
}

export function buildWordAnnotationPrompt(req: GenerateWordAnnotationRequest): string {
  return untrustedContentBlock("selection", {
    word: req.word,
    sentenceContext: req.sentenceContext,
  })
}

export async function generateWordAnnotation(req: GenerateWordAnnotationRequest): Promise<WordAnnotation> {
  const prompt = buildWordAnnotationPrompt(req)

  // Look up the offline dictionary in parallel with the AI call. The dictionary
  // supplies verified pronunciation + general meaning (ground truth); the model
  // supplies the in-context explanation. Either may be absent.
  const [dictEntry, result] = await Promise.all([
    requestDictionaryLookup(req.word),
    requestTranslationBatch({
      texts: [prompt],
      targetLang: req.targetLang,
      serviceMode: req.serviceMode,
      task: "custom",
      customSystemPrompt: buildWordAnnotationSystemPrompt(req),
    }),
  ])

  if (result.ok) {
    const annotation = parseJsonResponse(WordAnnotationSchema, result.translations[0])
    if (dictEntry) {
      // Override the two fields the model is most likely to get wrong with the
      // dictionary's ground truth; keep the model's contextual explanation.
      return {
        ...annotation,
        pronunciation: `/${dictEntry.ipa}/`,
        meaning: dictEntry.gloss,
        source: "dictionary",
      }
    }
    return annotation
  }

  // AI failed but the word is in the dictionary — still give the learner a
  // verified pronunciation and meaning rather than nothing.
  if (dictEntry) {
    return {
      word: req.word,
      pronunciation: `/${dictEntry.ipa}/`,
      partOfSpeech: "",
      meaning: dictEntry.gloss,
      shortExplanation: "",
      source: "dictionary",
    }
  }

  throw new Error(`Word annotation failed: ${result.error.message}`)
}

// ---------------------------------------------------------------------------
// Lexical candidate detection
// ---------------------------------------------------------------------------

/**
 * Determine if selected text is a word/short-phrase suitable for lexical annotation
 * (vs sentence-level explain/grammar).
 */
export function isLexicalCandidate(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.includes("\n")) return false
  // Short enough to be a word/phrase: ≤3 whitespace-separated tokens or ≤30 chars for CJK
  const tokens = trimmed.split(/\s+/)
  if (tokens.length <= 3) return true
  return trimmed.length <= 30
}

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(schema: z.ZodType<T>, raw: string): T {
  // Strip markdown code fences if present
  let cleaned = raw.trim()
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${cleaned.slice(0, 100)}...`)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`AI response does not match expected schema: ${result.error.message}`)
  }

  return result.data
}
