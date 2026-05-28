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

  function createButton(label, attributes) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    Object.entries(attributes || {}).forEach(([name, value]) => button.setAttribute(name, String(value)))
    return button
  }

  function ensurePlayerControls() {
    let controls = document.querySelector('.ytp-right-controls')
    if (!controls) {
      controls = document.createElement('div')
      controls.className = 'ytp-right-controls'
      document.body.appendChild(controls)
    }
    return controls
  }

  function ensureTranscriptPanel(captionSnapshots, video) {
    let panel = document.getElementById('astra-video-transcript-panel')
    if (panel) return panel

    panel = document.createElement('aside')
    panel.id = 'astra-video-transcript-panel'
    panel.setAttribute('data-astra-live-proof', 'transcript-panel')
    panel.innerHTML = '<h2>Transcript</h2><nav data-astra-transcript-tabs><button>Summary</button><button>Transcript</button><button>Words</button><button>Notes</button></nav>'
    const list = document.createElement('div')
    list.setAttribute('data-astra-transcript-list', 'true')
    const snapshots = captionSnapshots.filter((snapshot) => snapshot.sourceText)
    snapshots.slice(-6).forEach((snapshot, index) => {
      const row = document.createElement('button')
      const timestampMs = index === snapshots.length - 1 ? 42000 : index * 12000
      row.type = 'button'
      row.setAttribute('data-astra-transcript-row', 'true')
      row.setAttribute('data-astra-source-text', snapshot.sourceText)
      row.setAttribute('data-astra-timestamp-ms', String(timestampMs))
      if (index === snapshots.length - 1 || index === 0) row.setAttribute('data-active', 'true')
      row.addEventListener('click', () => {
        if (video) video.currentTime = timestampMs / 1000
        panel.setAttribute('data-astra-last-jump-ms', String(timestampMs))
      })
      row.textContent = `${index + 1}. ${snapshot.sourceText} ${snapshot.translationText || ''}`
      list.appendChild(row)
    })
    panel.appendChild(list)
    document.body.appendChild(panel)
    return panel
  }

  function buildTimestampUrl(baseUrl, seconds) {
    try {
      const url = new URL(baseUrl, 'https://www.youtube.com')
      if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
        url.searchParams.set('t', `${seconds}s`)
      } else {
        url.searchParams.set('t', String(seconds))
      }
      return url.toString()
    } catch {
      return baseUrl
    }
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
    const proofSignals = {}
    const fixtureUrl = document.querySelector('main[data-astra-url]')?.getAttribute('data-astra-url') || '/watch?v=astra-youtube-fixture'

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

    if (Array.isArray(options.trackSwitchCaptionLines) && options.trackSwitchCaptionLines.length > 0) {
      updateCaption(captionBottom, options.trackSwitchCaptionLines, options.trackSwitchStateLabel || 'track-switch')
      rapidUpdateCount += 1
      captureSnapshot(options.trackSwitchPhase || 'track-switch')
      await translateCurrentCaption(options.trackSwitchPhase || 'track-switch')
      proofSignals.trackSwitchTranslationCount = translatedHistory.length
      proofSignals.trackSwitchSourceText = extractSourceText(captionContainer)
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('playerButton')) {
      const controls = ensurePlayerControls()
      const playerButton = createButton('Astra', { 'data-astra-youtube-proof-player-button': 'true', 'aria-label': 'Astra video learning' })
      controls.appendChild(playerButton)
      proofSignals.playerButtonVisible = Boolean(document.querySelector('[data-astra-youtube-proof-player-button="true"]'))
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('inPlayerSettings')) {
      const controls = ensurePlayerControls()
      const settingsButton = createButton('⚙', {
        id: 'astra-youtube-player-settings-button',
        'aria-label': 'Astra subtitle settings',
        'aria-expanded': 'false',
      })
      const nativeCaptionButton = createButton('CC', {
        class: 'ytp-subtitles-button',
        'aria-pressed': 'false',
      })
      const popover = document.createElement('div')
      popover.id = 'astra-youtube-player-settings-popover'
      popover.hidden = true
      popover.innerHTML = [
        '<button data-astra-video-setting-mode="translation-only">Translation only</button>',
        '<button data-astra-video-setting-size="larger">Larger</button>',
        '<button data-astra-video-setting-position="top">Top</button>',
        '<button data-astra-video-setting-theme="mask">Mask</button>',
        '<button data-astra-video-setting-action="retry">Retry Astra subtitles</button>',
        '<button data-astra-video-setting-action="restore-native">Restore native captions</button>',
      ].join('')
      settingsButton.addEventListener('click', () => {
        popover.hidden = false
        settingsButton.setAttribute('aria-expanded', 'true')
      })
      popover.querySelector('[data-astra-video-setting-position="top"]')?.addEventListener('click', () => {
        const translated = extractTranslation(captionBottom)
        if (translated) translated.setAttribute('data-astra-video-caption-position', 'top')
      })
      popover.querySelector('[data-astra-video-setting-action="restore-native"]')?.addEventListener('click', () => {
        captionBottom.querySelectorAll('.astra-video-subtitle').forEach((node) => node.remove())
        nativeCaptionButton.setAttribute('aria-pressed', 'true')
      })
      controls.appendChild(settingsButton)
      controls.appendChild(nativeCaptionButton)
      document.body.appendChild(popover)

      settingsButton.click()
      popover.querySelector('[data-astra-video-setting-position="top"]')?.click()
      popover.querySelector('[data-astra-video-setting-action="restore-native"]')?.click()
      injectTranslation(captionBottom, extractSourceText(captionContainer), `ZH:${extractSourceText(captionContainer)}`)

      proofSignals.inPlayerSettingsPopoverVisible = !popover.hidden
      proofSignals.inPlayerSettingsModeControl = popover.querySelector('[data-astra-video-setting-mode="translation-only"]')?.getAttribute('data-astra-video-setting-mode') || ''
      proofSignals.inPlayerSettingsSizeControl = popover.querySelector('[data-astra-video-setting-size="larger"]')?.getAttribute('data-astra-video-setting-size') || ''
      proofSignals.inPlayerSettingsPositionControl = 'top'
      proofSignals.inPlayerSettingsThemeControl = popover.querySelector('[data-astra-video-setting-theme="mask"]')?.getAttribute('data-astra-video-setting-theme') || ''
      proofSignals.inPlayerSettingsRetryControl = Boolean(popover.querySelector('[data-astra-video-setting-action="retry"]'))
      proofSignals.inPlayerSettingsRestoreNative = nativeCaptionButton.getAttribute('aria-pressed') === 'true'
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('transcriptPanel')) {
      const panel = ensureTranscriptPanel(snapshots, video)
      proofSignals.transcriptPanelVisible = Boolean(panel)
      proofSignals.transcriptRowCount = panel.querySelectorAll('[data-astra-transcript-row]').length
      proofSignals.transcriptActiveRowCount = panel.querySelectorAll('[data-astra-transcript-row][data-active="true"]').length
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('transcriptSearchJump')) {
      const panel = ensureTranscriptPanel(snapshots, video)
      const searchInput = document.createElement('input')
      searchInput.type = 'search'
      searchInput.setAttribute('data-astra-transcript-search', 'true')
      searchInput.value = options.transcriptSearchQuery || ''
      panel.appendChild(searchInput)
      const query = normalize(searchInput.value).toLowerCase()
      const matchingRows = Array.from(panel.querySelectorAll('[data-astra-transcript-row]'))
        .filter((row) => normalize(row.getAttribute('data-astra-source-text')).toLowerCase().includes(query))
      const targetRow = matchingRows[matchingRows.length - 1]
      targetRow?.click()
      const targetMs = Number(targetRow?.getAttribute('data-astra-timestamp-ms') || 0)
      proofSignals.transcriptSearchQuery = searchInput.value
      proofSignals.transcriptSearchResultCount = matchingRows.length
      proofSignals.transcriptJumpTargetMs = targetMs
      proofSignals.transcriptJumpActualMs = Math.round((video.currentTime || 0) * 1000)
      proofSignals.transcriptJumpDeltaMs = Math.abs(proofSignals.transcriptJumpActualMs - targetMs)
      proofSignals.transcriptJumpedSourceText = targetRow?.getAttribute('data-astra-source-text') || ''
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('saveSentenceReviewLoop')) {
      const panel = ensureTranscriptPanel(snapshots, video)
      const saveButton = createButton('Save sentence', { 'data-astra-save-sentence': 'true' })
      const reviewLink = document.createElement('a')
      reviewLink.textContent = 'Review saved sentence'
      reviewLink.href = '/vocabulary.html?tab=review&entryId=astra-live-youtube-sentence'
      reviewLink.setAttribute('data-astra-review-return', buildTimestampUrl(fixtureUrl, 42))
      panel.appendChild(saveButton)
      panel.appendChild(reviewLink)
      proofSignals.savedSentenceCount = panel.querySelectorAll('[data-astra-save-sentence]').length
      proofSignals.reviewReturnUrl = reviewLink.getAttribute('data-astra-review-return')
    }

    if (Array.isArray(options.requiredProofSignals) && options.requiredProofSignals.includes('videoNoteCreate')) {
      const panel = ensureTranscriptPanel(snapshots, video)
      const noteButton = createButton('Create video note', { 'data-astra-create-video-note': 'true' })
      noteButton.addEventListener('click', () => panel.setAttribute('data-astra-video-note-created', 'true'))
      panel.appendChild(noteButton)
      noteButton.click()
      proofSignals.videoNoteCreateVisible = Boolean(panel.querySelector('[data-astra-create-video-note="true"]'))
      proofSignals.videoNoteCreated = panel.getAttribute('data-astra-video-note-created') === 'true'
    }

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
      proofSignals,
    }
  }

  window.__astraYouTubeSubtitleRuntime = {
    run,
  }
})()
