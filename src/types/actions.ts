import { z } from "zod"

import { TranslationTaskSchema } from "./messages"
import type { CustomAction } from "./config"

export const ActionIdSchema = z.string().min(1)

export const BuiltinActionSchema = z.object({
  id: ActionIdSchema,
  label: z.string(),
  labelZh: z.string(),
  task: TranslationTaskSchema,
  /** For custom actions, the system prompt template. Use {{text}} and {{targetLang}} as placeholders. */
  systemPrompt: z.string().optional(),
  /** Icon hint for UI rendering */
  icon: z.enum(["translate", "explain", "summarize", "rewrite", "grammar", "custom"]).default("custom"),
  /** Whether this action is enabled by default */
  enabledByDefault: z.boolean().default(true),
})

export type BuiltinAction = z.infer<typeof BuiltinActionSchema>

export const BUILTIN_ACTIONS: BuiltinAction[] = [
  {
    id: "translate",
    label: "Translate",
    labelZh: "翻译",
    task: "translate",
    icon: "translate",
    enabledByDefault: true,
  },
  {
    id: "explain",
    label: "Explain",
    labelZh: "解释",
    task: "explain",
    icon: "explain",
    enabledByDefault: true,
  },
  {
    id: "summarize",
    label: "Summarize",
    labelZh: "总结",
    task: "custom",
    icon: "summarize",
    systemPrompt: "Summarize the following text concisely in {{targetLang}}. Output only the summary, no extra explanation.\n\nText: {{text}}",
    enabledByDefault: false,
  },
  {
    id: "rewrite",
    label: "Rewrite",
    labelZh: "改写",
    task: "custom",
    icon: "rewrite",
    systemPrompt: "Rewrite the following text in simpler, clearer language in {{targetLang}}. Output only the rewritten text.\n\nText: {{text}}",
    enabledByDefault: false,
  },
  {
    id: "grammar",
    label: "Grammar Analysis",
    labelZh: "语法分析",
    task: "custom",
    icon: "grammar",
    systemPrompt: "Analyze the grammar of the following text. Explain the sentence structure, key grammar points, and any notable usage in {{targetLang}}. Be concise.\n\nText: {{text}}",
    enabledByDefault: false,
  },
]

function customActionsToBuiltin(customActions: CustomAction[]): BuiltinAction[] {
  return customActions
    .filter(a => a.enabled)
    .map(a => ({
      id: a.id,
      label: a.label,
      labelZh: a.labelZh,
      task: "custom" as const,
      systemPrompt: a.systemPrompt,
      icon: "custom" as const,
      enabledByDefault: true,
    }))
}

export function getEnabledActions(config?: { customActions?: CustomAction[] }): BuiltinAction[] {
  const builtins = BUILTIN_ACTIONS.filter(a => a.enabledByDefault)
  if (!config?.customActions?.length) return builtins

  return [...builtins, ...customActionsToBuiltin(config.customActions)]
}

export function getActionById(id: string, config?: { customActions?: CustomAction[] }): BuiltinAction | undefined {
  const builtin = BUILTIN_ACTIONS.find(a => a.id === id)
  if (builtin) return builtin

  if (!config?.customActions) return undefined
  const custom = config.customActions.find(a => a.id === id && a.enabled)
  if (!custom) return undefined

  return {
    id: custom.id,
    label: custom.label,
    labelZh: custom.labelZh,
    task: "custom" as const,
    systemPrompt: custom.systemPrompt,
    icon: "custom" as const,
    enabledByDefault: true,
  }
}
