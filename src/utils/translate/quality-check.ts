/**
 * Advisory translation quality validation.
 *
 * Runs lightweight heuristic checks on translation results to detect
 * suspicious output. Warnings are logged but never block the pipeline.
 */

export interface QualityCheckResult {
  valid: boolean
  warnings: string[]
}

const TOKEN_RATIO_MIN = 0.1
const TOKEN_RATIO_MAX = 5.0

/**
 * Validate a single translation pair.
 *
 * Checks:
 * 1. Empty translation output
 * 2. Token ratio (output / input) outside expected bounds
 * 3. Translation identical to source (untranslated)
 */
export function validateTranslationQuality(
  source: string,
  translation: string,
): QualityCheckResult {
  const warnings: string[] = []

  // Check for empty translations
  if (translation.trim().length === 0) {
    warnings.push("Translation is empty.")
    return { valid: false, warnings }
  }

  // Check token ratio
  const inputLength = source.length
  const outputLength = translation.length

  if (inputLength > 0) {
    const ratio = outputLength / inputLength
    if (ratio < TOKEN_RATIO_MIN) {
      warnings.push(
        `Token ratio ${ratio.toFixed(2)} is below minimum ${TOKEN_RATIO_MIN} (output much shorter than input).`,
      )
    } else if (ratio > TOKEN_RATIO_MAX) {
      warnings.push(
        `Token ratio ${ratio.toFixed(2)} exceeds maximum ${TOKEN_RATIO_MAX} (output much longer than input).`,
      )
    }
  }

  // Check for untranslated output (identical to source)
  if (translation === source) {
    warnings.push("Translation is identical to source text (untranslated).")
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

/**
 * Validate a batch of translations and return per-item results.
 */
export function validateTranslationBatch(
  sources: string[],
  translations: string[],
): QualityCheckResult[] {
  return sources.map((source, index) =>
    validateTranslationQuality(source, translations[index]),
  )
}
