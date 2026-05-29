import{l as g}from"./_virtual_wxt-plugins-Bq7vhhrN.js";import{I as r,M as h,U as y,W as o,q as e}from"./config-CKKHT8FL.js";import{o as f}from"./messages-BB9la8LR.js";import{t as v}from"./ai-safety-5-F6SQX5.js";var w=o({term:e(),note:e()}),b=o({digests:r(o({url:e(),hostname:e(),title:e(),targetLang:e(),languageLevel:h(["beginner","intermediate","advanced"]),generatedAt:y(),sourceFingerprint:e(),headline:e(),summary:e(),keyPoints:r(e()).default([]),vocabularyFocus:r(w).default([]),grammarFocus:r(e()).default([]),suggestedAction:e().default("")}))}),u="astra.page_digests.v1",L=50;function l(t){try{let a=new URL(t);return a.search="",a.hash="",a.toString()}catch{return t}}function m(t){return[l(t.url),t.title,t.contentSummary??"",t.targetLang,t.languageLevel].join("|")}async function d(){let t=await g.storage.local.get(u),a=b.safeParse(t[u]);return a.success?a.data:{digests:[]}}async function F(t){await g.storage.local.set({[u]:t})}async function S(t){let a=await d(),n=l(t);return a.digests.find(s=>s.url===n)??null}async function x(t,a){let n=await d(),s=l(t.url),i=m({url:t.url,title:t.title,contentSummary:t.contentSummary,targetLang:t.targetLang,languageLevel:t.languageLevel}),c={url:s,hostname:t.hostname,title:t.title,targetLang:t.targetLang,languageLevel:t.languageLevel,generatedAt:Date.now(),sourceFingerprint:i,headline:a.headline,summary:a.summary,keyPoints:a.keyPoints,vocabularyFocus:a.vocabularyFocus,grammarFocus:a.grammarFocus,suggestedAction:a.suggestedAction};return await F({digests:[c,...n.digests.filter(p=>p.url!==s)].slice(0,L)}),c}function k(t,a){return t.sourceFingerprint!==a}var A=o({term:e(),note:e()}),N=o({headline:e(),summary:e(),keyPoints:r(e()),vocabularyFocus:r(A).default([]),grammarFocus:r(e()).default([]),suggestedAction:e().default("")});function O(t,a){return`UntrustedContent JSON:
${JSON.stringify({sourceType:t,untrusted_content:a},null,2)}`}function P(t){return`You are a multilingual reading assistant that outputs structured JSON.

${v}

Trusted task:
- Analyze the untrusted page payload supplied by the user prompt.
- ${{beginner:"Use simple vocabulary and short sentences. Explain concepts as if to a beginner language learner.",intermediate:"Use natural language at an intermediate level. Balance clarity with natural expression.",advanced:"Use sophisticated vocabulary and complex structures naturally."}[t.languageLevel]}
- Write everything in ${t.targetLang}
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
- No markdown, no code fences, just the JSON object`}function $(t){return O("page",{pageTitle:t.pageTitle,contentSummary:t.contentSummary})}async function J(t){let a=await f({texts:[$(t)],targetLang:t.targetLang,serviceMode:t.serviceMode,context:t.context,task:"custom",customSystemPrompt:P(t)});if(!a.ok)throw Error(`Digest generation failed: ${a.error.message}`);return E(N,a.translations[0])}o({overview:e(),structure:r(e()),keyPatterns:r(e()),vocabularyNotes:r(e())}),o({word:e(),pronunciation:e().optional(),partOfSpeech:e(),meaning:e(),shortExplanation:e(),exampleSentence:e().optional()});function E(t,a){let n=a.trim();n.startsWith("```")&&(n=n.replace(/^```(?:json)?\s*\n?/,"").replace(/\n?```\s*$/,""));let s;try{s=JSON.parse(n)}catch{throw Error(`Failed to parse AI response as JSON: ${n.slice(0,100)}...`)}let i=t.safeParse(s);if(!i.success)throw Error(`AI response does not match expected schema: ${i.error.message}`);return i.data}export{x as a,k as i,m as n,S as r,J as t};
