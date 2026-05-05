(() => {
  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim()
  }

  function ensureHost(hostId) {
    let host = document.getElementById(hostId)
    if (!host) {
      host = document.createElement("div")
      host.id = hostId
      document.body.appendChild(host)
    }

    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    root.innerHTML = ""

    const style = document.createElement("style")
    style.textContent = `
      :host { all: initial; }
      .toolbar { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(420px, calc(100vw - 32px)); border: 1px solid rgba(148, 163, 184, 0.5); border-radius: 14px; background: rgba(255, 255, 255, 0.98); box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18); padding: 14px; font: 13px/1.5 system-ui, sans-serif; color: #0f172a; }
      .buttons { display: flex; gap: 8px; margin-bottom: 12px; }
      button { border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #0f172a; padding: 6px 12px; font: inherit; cursor: pointer; }
      button[data-kind='primary'] { background: #2563eb; border-color: #2563eb; color: #fff; }
      .result { min-height: 44px; white-space: pre-wrap; }
      .caption { color: #475569; font-size: 12px; margin-bottom: 8px; }
    `

    const container = document.createElement("div")
    container.className = "toolbar"

    const caption = document.createElement("div")
    caption.className = "caption"
    caption.textContent = "Selection explain live proof"

    const buttons = document.createElement("div")
    buttons.className = "buttons"

    const translateButton = document.createElement("button")
    translateButton.type = "button"
    translateButton.textContent = "Translate"

    const explainButton = document.createElement("button")
    explainButton.type = "button"
    explainButton.dataset.kind = "primary"
    explainButton.textContent = "Explain"

    const copyButton = document.createElement("button")
    copyButton.type = "button"
    copyButton.textContent = "Copy"

    const result = document.createElement("div")
    result.className = "result"

    buttons.append(translateButton, explainButton, copyButton)
    container.append(caption, buttons, result)
    root.append(style, container)

    return {
      host,
      root,
      explainButton,
      copyButton,
      result,
      buttonLabels: [translateButton.textContent ?? "", explainButton.textContent ?? "", copyButton.textContent ?? ""],
    }
  }

  async function runBasic({ hostId, relayUrl }) {
    const target = document.getElementById("target")
    const contextNode = document.getElementById("selection-context") ?? target?.closest("p") ?? document.body

    if (!target || !contextNode) {
      return { error: "missing selection target or context" }
    }

    const toolbar = ensureHost(hostId)
    const selection = window.getSelection()
    selection?.removeAllRanges()

    const range = document.createRange()
    range.selectNodeContents(target)
    selection?.addRange(range)

    const selectedText = normalizeText(selection?.toString())
    const selectionContext = normalizeText(contextNode.textContent)
    if (!selectedText) {
      return { error: "selection did not contain text" }
    }

    target.scrollIntoView({ block: "center", inline: "nearest" })
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }))

    let latestResult = ""
    const explainProfile = {
      languageLevel: "beginner",
      explainMode: "exam",
    }
    async function runExplain() {
      const response = await fetch(relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "openai",
          model: "gpt-5.4-nano",
          texts: [selectedText],
          targetLang: "zh-CN",
          task: "explain",
          languageLevel: explainProfile.languageLevel,
          explainMode: explainProfile.explainMode,
          context: {
            pageTitle: document.title,
            pageUrl: window.location.href,
            hostname: window.location.hostname,
            selectionContext,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`relay responded with ${response.status}`)
      }

      const payload = await response.json()
      latestResult = normalizeText(payload?.translations?.[0] ?? "")
      toolbar.result.textContent = `Explain profile: Exam · Beginner\n${latestResult}`
      return latestResult
    }

    toolbar.copyButton.addEventListener("click", async () => {
      if (!latestResult || !navigator.clipboard?.writeText) return
      try {
        await navigator.clipboard.writeText(latestResult)
      } catch {
        // best-effort only; copy is not part of this slice's required pass path
      }
    })

    let explainRun = null
    toolbar.explainButton.addEventListener("click", () => {
      explainRun = runExplain()
    }, { once: true })

    toolbar.explainButton.click()
    await explainRun

    return {
      buttonLabels: toolbar.buttonLabels.map((label) => normalizeText(label)),
      resultText: normalizeText(toolbar.result.textContent),
      selectedText,
    }
  }

  window.__astraSelectionRuntime = {
    runBasic,
  }
})()
