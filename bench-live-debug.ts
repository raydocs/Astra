import { JSDOM } from 'jsdom'
import { buildExpectedPageTranslationTexts, buildPageTranslationExecutionFromDocument } from './bench/scenarios/helpers/page-translation.ts'
import { evaluatePageTranslation } from './bench/evaluators/page-translation.ts'

const fixtureHtml = `<main>
  <article>
    <h1>Astra turns long-form reading into bilingual learning.</h1>
    <p>Readers can keep the original text visible while reviewing a translation below it.</p>
    <p>This fixture represents a straightforward article page with a clear main content root.</p>
    <blockquote>The goal is to test article-centric extraction without noisy chrome.</blockquote>
  </article>
</main>`
const snapshotHtml = `<!doctype html><html><body><main>
  <article>
    <h1>Astra turns long-form reading into bilingual learning.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:Astra turns long-form reading into bilingual lea</span></span></h1>
    <p>Readers can keep the original text visible while reviewing a translation below it.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:Readers can keep the original text visible while</span></span></p>
    <p>This fixture represents a straightforward article page with a clear main content root.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:This fixture represents a straightforward articl</span></span></p>
    <blockquote>The goal is to test article-centric extraction without noisy chrome.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:The goal is to test article-centric extraction w</span></span></blockquote>
  </article>
</main></body></html>`
const expected = buildExpectedPageTranslationTexts(new JSDOM(`<!doctype html><html><body>${fixtureHtml}</body></html>`, { url: 'file:///tmp/article-basic.html'}).window.document, 'page')
const execution = buildPageTranslationExecutionFromDocument({
  doc: new JSDOM(snapshotHtml, { url: 'file:///tmp/article-basic.html' }).window.document,
  expectedTexts: expected.expectedTexts,
  requestCount: 1,
  snapshotPhase: 'running',
  failedBlocks: 0,
  notes: [`effectiveScope=${expected.effectiveScope}`],
})
console.log(JSON.stringify({expected, execution, evaluation: evaluatePageTranslation(execution)}, null, 2))
