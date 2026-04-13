/**
 * Reading assist layer — typed AI helpers for digest, grammar, and word annotation.
 * Uses existing translation transport with custom prompts + JSON response parsing.
 */

import { z } from "zod"
import { requestTranslationBatch } from "@/utils/extension/messages"
import type { TranslationRequestContext } from "@/types/messages"
import type { LanguageLevel } from "@/types/config"

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
  context?: TranslationRequestContext
}

export async function generatePageDigest(req: GenerateDigestRequest): Promise<PageDigest> {
  const levelInstructions: Record<LanguageLevel, string> = {
    beginner: "Use simple vocabulary and short sentences. Explain concepts as if to a beginner language learner.",
    intermediate: "Use natural language at an intermediate level. Balance clarity with natural expression.",
    advanced: "Use sophisticated vocabulary and complex structures naturally.",
  }

  const prompt = `You are a reading assistant. Analyze this article and produce a JSON digest.

Article title: ${req.pageTitle}
Content: ${req.contentSummary}

Instructions:
- ${levelInstructions[req.languageLevel]}
- Write everything in ${req.targetLang}
- Output ONLY valid JSON matching this schema:
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

  const result = await requestTranslationBatch({
    texts: [prompt],
    targetLang: req.targetLang,
    context: req.context,
    task: "custom",
    customSystemPrompt: "You are a multilingual reading assistant that outputs structured JSON.",
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
  sentenceContext?: string
}

export async function generateGrammarGuide(req: GenerateGrammarRequest): Promise<GrammarGuide> {
  const levelInstructions: Record<LanguageLevel, string> = {
    beginner: "Explain grammar simply. Focus on the basic sentence skeleton. Avoid technical grammar terms. Translate all explanations.",
    intermediate: "Explain clause structure, tense/aspect, and common patterns. Use some grammar terms with brief definitions.",
    advanced: "Analyze nuance, register, omitted elements, and discourse-level connections. Use standard grammar terminology.",
  }

  const contextLine = req.sentenceContext
    ? `\nSurrounding context: ${req.sentenceContext}`
    : ""

  const prompt = `Analyze the grammar of this text and produce a JSON guide.

Text: ${req.text}${contextLine}

Instructions:
- ${levelInstructions[req.languageLevel]}
- Write all explanations in ${req.targetLang}
- Output ONLY valid JSON matching this schema:
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

  const result = await requestTranslationBatch({
    texts: [prompt],
    targetLang: req.targetLang,
    task: "custom",
    customSystemPrompt: "You are a language learning grammar tutor that outputs structured JSON.",
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
})

export type WordAnnotation = z.infer<typeof WordAnnotationSchema>

export interface GenerateWordAnnotationRequest {
  word: string
  sentenceContext?: string
  targetLang: string
  languageLevel: LanguageLevel
}

export async function generateWordAnnotation(req: GenerateWordAnnotationRequest): Promise<WordAnnotation> {
  const contextLine = req.sentenceContext
    ? `\nSentence context: ${req.sentenceContext}`
    : ""

  const prompt = `Analyze this word/phrase and produce a JSON annotation.

Word: ${req.word}${contextLine}

Instructions:
- Write all explanations in ${req.targetLang}
- Output ONLY valid JSON matching this schema:
{
  "word": "${req.word}",
  "pronunciation": "IPA or pinyin if applicable",
  "partOfSpeech": "noun/verb/adjective/etc",
  "meaning": "concise translation/definition",
  "shortExplanation": "brief usage explanation in context",
  "exampleSentence": "one example sentence using this word"
}
- pronunciation is optional for non-CJK languages
- shortExplanation should consider the sentence context if provided
- No markdown, no code fences, just the JSON object`

  const result = await requestTranslationBatch({
    texts: [prompt],
    targetLang: req.targetLang,
    task: "custom",
    customSystemPrompt: "You are a multilingual vocabulary tutor that outputs structured JSON.",
  })

  if (!result.ok) {
    throw new Error(`Word annotation failed: ${result.error.message}`)
  }

  return parseJsonResponse(WordAnnotationSchema, result.translations[0])
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
