import React, { useState, useRef, useCallback, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { browser } from "#imports"
import { subscribePageTranslationState } from "../page-translate"
import { toggleCurrentTabTranslation } from "@/utils/extension/messages"
import { IDLE_TRANSLATION_SNAPSHOT } from "@/types/translation"

const STORAGE_KEY = "astra_float_ball_y"
const DEFAULT_Y = 300
const BALL_SIZE = 44

const COLOR_IDLE = "#6366f1"
const COLOR_ACTIVE = "#16c79a"
const COLOR_BUSY = "#8b5cf6"
const COLOR_ERROR = "#f59e0b"

function getFloatBallVisualState(snapshot: typeof IDLE_TRANSLATION_SNAPSHOT) {
  if (snapshot.phase === "starting" || snapshot.phase === "stopping") {
    return {
      color: COLOR_BUSY,
      tooltip: snapshot.phase === "starting" ? "正在准备翻译…" : "正在移除翻译…",
      disabled: true,
    }
  }

  if (snapshot.phase === "running") {
    return {
      color: COLOR_ACTIVE,
      tooltip: `翻译中 ${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks}`,
      disabled: false,
    }
  }

  if (snapshot.lastError) {
    return {
      color: COLOR_ERROR,
      tooltip: `翻译失败：${snapshot.lastError.message}`,
      disabled: false,
    }
  }

  return {
    color: COLOR_IDLE,
    tooltip: "翻译此页",
    disabled: false,
  }
}

function clampY(y: number): number {
  const maxY = window.innerHeight - BALL_SIZE - 10
  return Math.max(10, Math.min(y, maxY))
}

function FloatBallButton() {
  const [translationState, setTranslationState] = useState(IDLE_TRANSLATION_SNAPSHOT)
  const [posY, setPosY] = useState(DEFAULT_Y)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const dragRef = useRef<{ startY: number; startPosY: number } | null>(null)
  const movedRef = useRef(false)
  const posYRef = useRef(posY)

  useEffect(() => {
    void browser.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY]
      if (typeof saved === "number") {
        setPosY(clampY(saved))
      }
    })
  }, [])

  useEffect(() => {
    posYRef.current = posY
  }, [posY])

  useEffect(() => {
    return subscribePageTranslationState(setTranslationState)
  }, [])

  const persistY = useCallback((y: number) => {
    void browser.storage.local.set({ [STORAGE_KEY]: y })
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(true)
      movedRef.current = false
      dragRef.current = { startY: e.clientY, startPosY: posYRef.current }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.clientY - dragRef.current.startY
      if (Math.abs(delta) > 3) movedRef.current = true
      const newY = clampY(dragRef.current.startPosY + delta)
      posYRef.current = newY
      setPosY(newY)
    },
    [dragging],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      persistY(posYRef.current)

      const visual = getFloatBallVisualState(translationState)
      if (!movedRef.current && !visual.disabled) {
        void toggleCurrentTabTranslation().catch((error) => {
          console.error("[Astra] Float ball toggle failed:", error)
        })
      }
      dragRef.current = null
    },
    [dragging, persistY, posY, translationState],
  )

  const visual = getFloatBallVisualState(translationState)

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        right: 0,
        top: posY,
        width: BALL_SIZE,
        height: BALL_SIZE,
        zIndex: 2147483647,
        cursor: dragging ? "grabbing" : visual.disabled ? "progress" : "pointer",
        userSelect: "none",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: visual.color,
        borderRadius: "50% 0 0 50%",
        boxShadow: `0 2px 12px ${visual.color}80`,
        transition: dragging ? "none" : "background 0.25s, box-shadow 0.25s, top 0.15s",
        transform: hovered && !dragging ? "scale(1.1)" : "scale(1)",
        opacity: visual.disabled ? 0.92 : 1,
      }}
      title={visual.tooltip}
    >
      {hovered && !dragging && (
        <div
          style={{
            position: "absolute",
            right: BALL_SIZE + 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.78)",
            color: "#fff",
            fontSize: "12px",
            padding: "4px 10px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            lineHeight: "1.4",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {visual.tooltip}
        </div>
      )}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        style={{ pointerEvents: "none" }}
      >
        <path
          d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
          fill="#fff"
        />
      </svg>
    </div>
  )
}

export function mountFloatBall() {
  const existing = document.getElementById("astra-float-ball-host")
  if (existing) return

  const host = document.createElement("div")
  host.id = "astra-float-ball-host"
  const shadow = host.attachShadow({ mode: "open" })

  const resetStyle = document.createElement("style")
  resetStyle.textContent = `
    :host {
      all: initial;
      position: fixed;
      top: 0;
      right: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    div { pointer-events: auto; }
  `
  shadow.appendChild(resetStyle)

  const mountPoint = document.createElement("div")
  shadow.appendChild(mountPoint)
  document.documentElement.appendChild(host)

  const root = ReactDOM.createRoot(mountPoint)
  root.render(<FloatBallButton />)
}
