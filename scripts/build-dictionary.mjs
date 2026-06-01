#!/usr/bin/env node
/**
 * build-dictionary.mjs — generate the offline English→Chinese lexical fallback.
 *
 * Source: ECDICT (https://github.com/skywind3000/ECDICT), MIT-licensed. We keep
 * only a frequency-ranked common subset (verified IPA + a concise Chinese gloss)
 * so the word-annotation card can show a dictionary ground truth instead of a
 * model-hallucinated pronunciation/meaning. This is a dev/build tool, not run in
 * CI — the committed output is public/dictionary/en-zh-common.json.
 *
 * Usage:
 *   1) curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
 *   2) node scripts/build-dictionary.mjs /tmp/ecdict.csv
 *
 * Frequency: ECDICT `bnc` and `frq` are corpus RANKS (1 = most frequent, 0 =
 * unknown). We keep words whose rank is within RANK_LIMIT in either corpus.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Coverage tuned for a Chinese learner of English: include words that are
// frequency-ranked OR carry an exam tag (zk/gk/cet4/cet6/ky/toefl/ielts/gre) OR
// a Collins/Oxford marker. Learners look up the long tail (resilience, ubiquitous),
// so a pure top-N frequency cut would miss exactly the words they select.
const RANK_LIMIT = 20000
const MAX_GLOSS_CHARS = 28

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

const srcPath = process.argv[2] || "/tmp/ecdict.csv"
const outPath = resolve(repoRoot, "public/dictionary/en-zh-common.json")

/** Minimal RFC4180-ish CSV parser that respects quoted fields spanning newlines. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') { inQuotes = true }
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c === "\r") { /* skip */ }
    else { field += c }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

/** Pick a concise Chinese gloss (first line, first few senses) from ECDICT. */
function conciseGloss(translation) {
  if (!translation) return ""
  // ECDICT packs senses with a LITERAL backslash-n separator (not a real newline).
  const firstLine = translation.replace(/\\n/g, "\n").split("\n").map((s) => s.trim()).find(Boolean) || ""
  // Drop a leading English POS marker like "n. " / "vt. " / "adj. ".
  const withoutPos = firstLine.replace(/^[a-z]{1,5}\.\s*/i, "")
  // Accumulate whole senses up to the length cap so we never cut mid-sense.
  const senses = withoutPos.split(/[;；,，]/).map((s) => s.trim()).filter(Boolean)
  let gloss = ""
  for (const sense of senses) {
    const next = gloss ? `${gloss}，${sense}` : sense
    if (next.length > MAX_GLOSS_CHARS) break
    gloss = next
  }
  return gloss || withoutPos.slice(0, MAX_GLOSS_CHARS)
}

function rankOf(value) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

const csv = readFileSync(srcPath, "utf8")
const rows = parseCsv(csv)
const header = rows[0].map((h) => h.trim())
const col = (name) => header.indexOf(name)
const iWord = col("word")
const iPhonetic = col("phonetic")
const iTranslation = col("translation")
const iCollins = col("collins")
const iOxford = col("oxford")
const iTag = col("tag")
const iBnc = col("bnc")
const iFrq = col("frq")

if (iWord < 0 || iPhonetic < 0 || iTranslation < 0) {
  throw new Error(`Unexpected ECDICT header: ${header.join(",")}`)
}

const out = {}
let kept = 0
for (let r = 1; r < rows.length; r++) {
  const row = rows[r]
  if (row.length <= iTranslation) continue
  const word = (row[iWord] || "").trim().toLowerCase()
  const phonetic = (row[iPhonetic] || "").trim()
  const translation = row[iTranslation] || ""
  if (!word || !phonetic) continue
  // Single common headwords only — phrases are out of scope for the fallback.
  if (!/^[a-z][a-z'-]*$/.test(word)) continue
  const bnc = rankOf(row[iBnc])
  const frq = rankOf(row[iFrq])
  const inFreq = (bnc > 0 && bnc <= RANK_LIMIT) || (frq > 0 && frq <= RANK_LIMIT)
  const tag = (row[iTag] || "").trim()
  const isLearnerVocab = tag.length > 0 || rankOf(row[iCollins]) > 0 || rankOf(row[iOxford]) > 0
  if (!inFreq && !isLearnerVocab) continue
  const gloss = conciseGloss(translation)
  if (!gloss) continue
  if (out[word]) continue
  out[word] = { ipa: phonetic, gloss }
  kept++
}

mkdirSync(dirname(outPath), { recursive: true })
// Stable key order keeps the committed asset diff-friendly across regenerations.
const ordered = {}
for (const k of Object.keys(out).sort()) ordered[k] = out[k]
const json = JSON.stringify(ordered)
writeFileSync(outPath, json + "\n")
console.log(`Kept ${kept} entries → ${outPath} (${(json.length / 1024).toFixed(0)} KB)`)
