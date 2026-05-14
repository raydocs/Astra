(function () {
  function normalize(text) {
    return String(text ?? "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  function extractSourceText(container) {
    return Array.from(container.querySelectorAll('.ytp-caption-segment'))
      .map((segment) => normalize(segment.textContent))
      .filter(Boolean)
      .filter((part, index, array) => index === 0 || part !== array[index - 1])
      .join(' ')
  }

  function extractTranslation(container) {
    return container.querySelector('.astra-video-subtitle')
  }

  function injectTranslation(container, sourceText, translationText) {
    container.querySelectorAll('.astra-video-subtitle').forEach((node) => node.remove())
    const translated = document.createElement('span')
    translated.className = 'astra-video-subtitle'
    translated.setAttribute('data-source', sourceText)
    translated.textContent = translationText
    container.appendChild(translated)
    return translated
  }

  function updateCaption(container, lines, stateLabel) {
    container.innerHTML = lines
      .map((line) => '<span class="ytp-caption-segment"><span class="ytp-caption-segment-inner">' + line + '</span></span>')
      .join('')
    container.setAttribute('data-astra-playback-state', stateLabel)
  }

  async function run(options) {
    const targetLang = options.targetLang
    const video = document.getElementById('astra-youtube-video')
    const captionContainer = document.querySelector('.ytp-caption-window-container')
    const captionBottom = document.querySelector('.ytp-caption-window-bottom')
    if (!video || !captionContainer || !captionBottom) {
      return { success: false, error: 'missing fixture nodes' }
    }

    const cache = new Map()
    const pending = new Set()
    const snapshots = []
    const sourceTexts = []
    const translatedHistory = []
    let requestCount = 0
    let duplicateCaptionUpdateCount = 0
    let rapidUpdateCount = 0
    let pauseEvents = 0
    let seekEvents = 0

    const captureSnapshot = (phase) => {
      const sourceText = extractSourceText(captionContainer)
      const translationNode = extractTranslation(captionBottom)
      snapshots.push({
        phase,
        sourceText,
        translationText: translationNode ? normalize(translationNode.textContent) : null,
        translationNodeCount: captionBottom.querySelectorAll('.astra-video-subtitle').length,
        stateLabel: captionBottom.getAttribute('data-astra-playback-state'),
      })
    }

    const translateCurrentCaption = async (phase) => {
      const sourceText = extractSourceText(captionContainer)
      if (!sourceText) return

      sourceTexts.push(sourceText)

      const existing = extractTranslation(captionBottom)
      if (existing && existing.getAttribute('data-source') === sourceText) {
        captureSnapshot(phase)
        return
      }

      const cacheKey = `${sourceText}|${targetLang}`
      if (cache.has(cacheKey)) {
        const translated = cache.get(cacheKey) || ''
        injectTranslation(captionBottom, sourceText, translated)
        translatedHistory.push(translated)
        captureSnapshot(phase)
        return
      }

      if (pending.has(cacheKey)) {
        captureSnapshot(phase)
        return
      }

      pending.add(cacheKey)
      requestCount += 1
      try {
        await new Promise((resolve) => window.setTimeout(resolve, options.translationDelayMs ?? 35))
        const translated = `ZH:${sourceText}`
        cache.set(cacheKey, translated)
        injectTranslation(captionBottom, sourceText, translated)
        translatedHistory.push(translated)
      } finally {
        pending.delete(cacheKey)
      }

      captureSnapshot(phase)
    }

    updateCaption(captionBottom, options.initialCaptionLines, options.initialStateLabel)
    rapidUpdateCount += 1
    duplicateCaptionUpdateCount += 1
    captureSnapshot(options.initialPhase)
    await translateCurrentCaption(options.initialPhase)

    updateCaption(captionBottom, options.initialCaptionLines, options.initialStateLabel)
    rapidUpdateCount += 1
    duplicateCaptionUpdateCount += 1
    captureSnapshot(options.duplicatePhase)
    await translateCurrentCaption(options.duplicatePhase)

    updateCaption(captionBottom, options.initialCaptionLines, options.pauseStateLabel)
    pauseEvents += 1
    video.dispatchEvent(new Event('pause'))
    captureSnapshot(options.pausePhase)
    await translateCurrentCaption(options.pausePhase)

    video.dispatchEvent(new Event('seeked'))
    seekEvents += 1
    updateCaption(captionBottom, options.seekCaptionLines, options.seekStateLabel)
    rapidUpdateCount += 1
    captureSnapshot(options.seekPhase)
    await translateCurrentCaption(options.seekPhase)

    updateCaption(captionBottom, options.seekCaptionLines, options.seekStateLabel)
    duplicateCaptionUpdateCount += 1
    captureSnapshot(options.seekCacheHitPhase)
    await translateCurrentCaption(options.seekCacheHitPhase)

    if (options.finalWaitMs) {
      await new Promise((resolve) => window.setTimeout(resolve, options.finalWaitMs))
    }

    const translatedCaptionTexts = [...new Set(translatedHistory.map((text) => normalize(text)).filter(Boolean))]

    const uniqueCaptionTexts = [...new Set(sourceTexts.map((text) => normalize(text)).filter(Boolean))]
    const seekSnapshot = [...snapshots].reverse().find((snapshot) => snapshot.phase === options.seekPhase && snapshot.translationNodeCount > 0) || null
    const seekPauseStable = Boolean(seekSnapshot?.translationText)
      && (seekSnapshot?.translationNodeCount ?? 0) === 1
      && (seekSnapshot?.sourceText ?? '') === normalize(options.seekExpectedSourceText)

    return {
      success: true,
      requestCount,
      duplicateCaptionUpdateCount,
      rapidUpdateCount,
      pauseEvents,
      seekEvents,
      seekPauseStable,
      uniqueCaptionTexts,
      translatedCaptionTexts,
      captionSnapshots: snapshots,
      payloadContext: options.payloadContext || null,
    }
  }

  window.__astraYouTubeSubtitleRuntime = {
    run,
  }
})()
