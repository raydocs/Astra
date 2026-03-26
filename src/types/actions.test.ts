import { describe, expect, it } from "vitest"

import type { CustomAction } from "./config"
import { BUILTIN_ACTIONS, getActionById, getEnabledActions } from "./actions"

describe("getEnabledActions", () => {
  it("returns only default-enabled actions when no config provided", () => {
    const actions = getEnabledActions()

    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(a => a.enabledByDefault)).toBe(true)
    expect(actions.map(a => a.id)).toEqual(["translate", "explain"])
  })

  it("returns only default-enabled builtins when customActions is empty", () => {
    const actions = getEnabledActions({ customActions: [] })

    expect(actions).toEqual(BUILTIN_ACTIONS.filter(a => a.enabledByDefault))
  })

  it("includes enabled custom actions after builtins", () => {
    const custom: CustomAction[] = [
      {
        id: "simplify",
        label: "Simplify",
        labelZh: "简化",
        systemPrompt: "Simplify the following text in {{targetLang}}.\n\nText: {{text}}",
        enabled: true,
      },
    ]

    const actions = getEnabledActions({ customActions: custom })
    const ids = actions.map(a => a.id)

    expect(ids).toContain("translate")
    expect(ids).toContain("explain")
    expect(ids).toContain("simplify")
    expect(ids[ids.length - 1]).toBe("simplify")
  })

  it("excludes custom actions with enabled: false", () => {
    const custom: CustomAction[] = [
      {
        id: "simplify",
        label: "Simplify",
        labelZh: "简化",
        systemPrompt: "Simplify {{text}}",
        enabled: false,
      },
      {
        id: "expand",
        label: "Expand",
        labelZh: "扩展",
        systemPrompt: "Expand {{text}} in {{targetLang}}",
        enabled: true,
      },
    ]

    const actions = getEnabledActions({ customActions: custom })
    const ids = actions.map(a => a.id)

    expect(ids).not.toContain("simplify")
    expect(ids).toContain("expand")
  })

  it("maps custom actions to BuiltinAction shape with task=custom and icon=custom", () => {
    const custom: CustomAction[] = [
      {
        id: "tone-formal",
        label: "Formal Tone",
        labelZh: "正式语气",
        systemPrompt: "Rewrite in formal tone: {{text}}",
        enabled: true,
      },
    ]

    const actions = getEnabledActions({ customActions: custom })
    const customAction = actions.find(a => a.id === "tone-formal")

    expect(customAction).toEqual({
      id: "tone-formal",
      label: "Formal Tone",
      labelZh: "正式语气",
      task: "custom",
      systemPrompt: "Rewrite in formal tone: {{text}}",
      icon: "custom",
      enabledByDefault: true,
    })
  })
})

describe("getActionById", () => {
  it("returns undefined for unknown id", () => {
    expect(getActionById("nonexistent")).toBeUndefined()
  })

  it("returns the action for a known id", () => {
    const action = getActionById("translate")

    expect(action).toBeDefined()
    expect(action!.id).toBe("translate")
  })

  it("returns a custom action by id when config is provided", () => {
    const custom: CustomAction[] = [
      {
        id: "my-action",
        label: "My Action",
        labelZh: "我的操作",
        systemPrompt: "Do something with {{text}}",
        enabled: true,
      },
    ]

    const action = getActionById("my-action", { customActions: custom })

    expect(action).toBeDefined()
    expect(action?.id).toBe("my-action")
    expect(action?.task).toBe("custom")
    expect(action?.systemPrompt).toBe("Do something with {{text}}")
  })

  it("returns undefined for a disabled custom action", () => {
    const custom: CustomAction[] = [
      {
        id: "disabled-action",
        label: "Disabled",
        labelZh: "禁用",
        systemPrompt: "Do something with {{text}}",
        enabled: false,
      },
    ]

    expect(getActionById("disabled-action", { customActions: custom })).toBeUndefined()
  })

  it("prefers builtin actions over custom actions with the same id", () => {
    const custom: CustomAction[] = [
      {
        id: "translate",
        label: "Custom Translate",
        labelZh: "自定义翻译",
        systemPrompt: "Custom translate {{text}}",
        enabled: true,
      },
    ]

    const action = getActionById("translate", { customActions: custom })

    expect(action?.label).toBe("Translate")
    expect(action?.task).toBe("translate")
  })
})

describe("BUILTIN_ACTIONS", () => {
  it("all builtin actions have unique ids", () => {
    const ids = BUILTIN_ACTIONS.map(a => a.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })
})
