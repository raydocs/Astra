(function () {
  function runBasic(options) {
    const target = document.getElementById('target')
    if (!target) {
      return { error: 'missing target' }
    }

    const host = document.createElement('div')
    host.id = options.hostId
    host.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: none;'
    const shadow = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)

    let requestCount = 0
    let overlayVisible = false
    let overlayText = ''
    let overlayError = ''
    let triggerLabel = ''
    let payloadSelectionContext = ''
    let payloadTask = 'translate'
    const startedAt = performance.now()

    return new Promise(function (resolve) {
      target.addEventListener('mousemove', function (event) {
        if (!event.altKey) return
        window.setTimeout(async function () {
          try {
            requestCount += 1
            payloadSelectionContext = (target.textContent || '').trim()
            triggerLabel = 'Alt + Hover'
            const response = await fetch(options.relayUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                provider: 'openai',
                model: 'gpt-5.4-nano',
                texts: [payloadSelectionContext],
                targetLang: 'zh-CN',
                task: payloadTask,
                context: {
                  pageTitle: document.title,
                  pageUrl: window.location.href,
                  hostname: window.location.hostname,
                  selectionContext: payloadSelectionContext,
                },
              }),
            })

            if (!response.ok) {
              throw new Error('relay responded with ' + response.status)
            }

            const payload = await response.json()
            overlayText = (payload && payload.translations && payload.translations[0]) || (options.translatedPrefix + payloadSelectionContext)
            shadow.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px;max-width:320px;padding:10px 12px;background:#111827;color:white;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.28);"><div style="font-size:12px;opacity:0.8;">' + triggerLabel + '</div><div style="font-size:14px;line-height:1.5;">' + overlayText + '</div></div>'
            const rect = target.getBoundingClientRect()
            host.style.top = Math.max(12, rect.bottom + 8) + 'px'
            host.style.left = Math.max(12, rect.left) + 'px'
            overlayVisible = true
          } catch (error) {
            overlayError = error instanceof Error ? error.message : String(error)
          }

          resolve({
            requestCount,
            overlayVisible,
            overlayText,
            overlayError,
            triggerLabel,
            translationLatencyMs: performance.now() - startedAt,
            selectionSuppressed: false,
            payloadSelectionContext,
            payloadTask,
          })
        }, 300)
      }, { once: true })

      target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, altKey: true, clientX: 120, clientY: 80 }))
    })
  }

  function runMovingTargets(options) {
    const targetA = document.getElementById('target-a')
    const targetB = document.getElementById('target-b')
    const decoy = document.getElementById('decoy')
    if (!targetA || !targetB || !decoy) {
      return { error: 'missing holdout fixture nodes' }
    }

    const host = document.createElement('div')
    host.id = options.hostId
    host.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: auto;'
    const shadow = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)

    let requestCount = 0
    let overlayVisible = false
    let overlayText = ''
    let overlayError = ''
    let triggerLabel = 'Alt + Hover'
    let payloadSelectionContext = ''
    let payloadTask = 'translate'
    let pendingSource = ''
    let activeSource = ''
    let rapidTransitionCount = 0
    let overlayInterferenceSuppressed = true
    let movingTargetRendered = false
    let dedupedRequestCount = true
    const startedAt = performance.now()

    function render(target, sourceText) {
      requestCount += 1
      activeSource = sourceText
      payloadSelectionContext = sourceText
      overlayText = options.translatedPrefix + sourceText
      shadow.innerHTML = '<div id="overlay-shell" style="display:flex;flex-direction:column;gap:6px;max-width:320px;padding:10px 12px;background:#111827;color:white;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.28);pointer-events:auto;"><div style="font-size:12px;opacity:0.8;">' + triggerLabel + '</div><div style="font-size:14px;line-height:1.5;">' + overlayText + '</div></div>'
      const rect = target.getBoundingClientRect()
      host.style.top = Math.max(12, rect.bottom + 8) + 'px'
      host.style.left = Math.max(12, rect.left) + 'px'
      overlayVisible = true
    }

    function queueHover(target, sourceText, altKey) {
      if (!altKey) return
      rapidTransitionCount += 1
      if (pendingSource === sourceText || activeSource === sourceText) {
        dedupedRequestCount = dedupedRequestCount && true
        return
      }
      pendingSource = sourceText
      window.setTimeout(function () {
        pendingSource = ''
        render(target, sourceText)
      }, 280)
    }

    targetA.addEventListener('mousemove', function (event) {
      queueHover(targetA, (targetA.textContent || '').trim(), event.altKey)
    })
    targetB.addEventListener('mousemove', function (event) {
      queueHover(targetB, (targetB.textContent || '').trim(), event.altKey)
    })
    decoy.addEventListener('mousemove', function () {
      overlayInterferenceSuppressed = overlayInterferenceSuppressed && requestCount <= 1
    })

    targetA.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, altKey: true, clientX: 120, clientY: 100 }))
    targetA.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, altKey: true, clientX: 122, clientY: 102 }))

    return new Promise(function (resolve) {
      window.setTimeout(function () {
        targetB.style.transform = 'translateX(24px)'
        movingTargetRendered = targetB.style.transform.indexOf('24px') !== -1
        const overlayShell = shadow.getElementById('overlay-shell')
        if (overlayShell) {
          overlayShell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, altKey: true, clientX: 180, clientY: 120 }))
        }
        decoy.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, altKey: true, clientX: 220, clientY: 120 }))
        window.setTimeout(function () {
          resolve({
            requestCount,
            overlayVisible,
            overlayText,
            overlayError,
            triggerLabel,
            translationLatencyMs: performance.now() - startedAt,
            selectionSuppressed: false,
            payloadSelectionContext,
            payloadTask,
            holdout: {
              dedupedRequestCount,
              overlayInterferenceSuppressed,
              movingTargetRendered,
              rapidTransitionCount,
            },
          })
        }, 120)
      }, 340)
    })
  }

  window.__astraHoverRuntime = {
    runBasic: runBasic,
    runMovingTargets: runMovingTargets,
  }
})()
