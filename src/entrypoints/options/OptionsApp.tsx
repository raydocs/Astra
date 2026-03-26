import { useEffect, useState } from "react"
import { browser } from "#imports"
import type {
  AstraConfig,
  ContentScope,
  CustomAction,
  HoverTrigger,
  InputTranslation,
  ProviderId,
  SiteConfig,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import {
  DEFAULT_ASTRA_CONFIG,
  getDefaultProviderModel,
  isDefaultSiteConfig,
  normalizeSiteKey,
} from "@/types/config"
import { readConfig, saveConfig } from "@/utils/storage/config"

type Section = "general" | "providers" | "translation" | "actions" | "sites" | "vocabulary" | "about"

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
] as const

const HOVER_TRIGGER_OPTIONS = [
  { value: "alt", label: "Alt + Hover" },
  { value: "always", label: "Always" },
  { value: "disabled", label: "Disabled" },
] as const

const CONTENT_SCOPE_OPTIONS = [
  { value: "page", label: "Full page" },
  { value: "article", label: "Article only" },
] as const

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
] as const

const MODE_OPTIONS = [
  { value: "bilingual", label: "Bilingual" },
  { value: "translation-only", label: "Translation only" },
] as const

const THEME_OPTIONS = [
  { value: "default", label: "Default (border)" },
  { value: "underline", label: "Underline" },
  { value: "highlight", label: "Highlight" },
] as const

const LANGUAGE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "general", label: "General" },
  { key: "providers", label: "Providers" },
  { key: "translation", label: "Translation" },
  { key: "actions", label: "Actions" },
  { key: "sites", label: "Sites" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "about", label: "About" },
]

const BRAND_COLOR = "#6366f1"

// --- Styles ---

const pageStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 14,
  color: "#1e293b",
  background: "#f8fafc",
  margin: 0,
}

const sidebarStyle: React.CSSProperties = {
  width: 200,
  minWidth: 200,
  background: "#fff",
  borderRight: "1px solid #e2e8f0",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
}

const logoStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: BRAND_COLOR,
  padding: "0 20px 20px",
  borderBottom: "1px solid #e2e8f0",
  marginBottom: 8,
}

const navBtnBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  padding: "10px 20px",
  fontSize: 14,
  cursor: "pointer",
  color: "#475569",
  transition: "background 0.15s, color 0.15s",
}

const navBtnActive: React.CSSProperties = {
  background: `${BRAND_COLOR}0d`,
  color: BRAND_COLOR,
  fontWeight: 600,
  borderRight: `3px solid ${BRAND_COLOR}`,
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: "32px 40px",
  maxWidth: 720,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 24,
  color: "#0f172a",
}

const fieldGroup: React.CSSProperties = {
  marginBottom: 20,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#475569",
  marginBottom: 6,
}

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginTop: 4,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  padding: "8px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto",
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 20px",
  background: BRAND_COLOR,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 20px",
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
}

const btnDanger: React.CSSProperties = {
  padding: "6px 16px",
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
}

const successBanner: React.CSSProperties = {
  padding: "10px 16px",
  background: "#ecfdf5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
  borderRadius: 6,
  marginBottom: 20,
  fontSize: 13,
}

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
}

// --- Sections ---

function GeneralSection({
  config,
  onChange,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
}) {
  return (
    <div>
      <h2 style={sectionTitle}>General</h2>

      <div style={fieldGroup}>
        <label style={labelStyle}>Target language</label>
        <select
          style={selectStyle}
          value={config.targetLang}
          onChange={(e) => onChange({ targetLang: e.target.value })}
        >
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Language level</label>
        <select
          style={selectStyle}
          value={config.languageLevel}
          onChange={(e) => onChange({ languageLevel: e.target.value as AstraConfig["languageLevel"] })}
        >
          {LANGUAGE_LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={hintStyle}>Adjusts explanation detail based on your proficiency.</div>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Hover trigger</label>
        <select
          style={selectStyle}
          value={config.hoverTrigger}
          onChange={(e) => onChange({ hoverTrigger: e.target.value as HoverTrigger })}
        >
          {HOVER_TRIGGER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Content scope</label>
        <select
          style={selectStyle}
          value={config.contentScope}
          onChange={(e) => onChange({ contentScope: e.target.value as ContentScope })}
        >
          {CONTENT_SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={hintStyle}>"Article only" skips navigation, sidebars, and footers.</div>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Input translation</label>
        <select
          style={selectStyle}
          value={config.inputTranslation}
          onChange={(e) => onChange({ inputTranslation: e.target.value as InputTranslation })}
        >
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <div style={hintStyle}>Show a translate button near focused text inputs.</div>
      </div>

      <div style={checkboxRow}>
        <input
          type="checkbox"
          id="privacy-mode"
          checked={config.privacyMode}
          onChange={(e) => onChange({ privacyMode: e.target.checked })}
        />
        <label htmlFor="privacy-mode" style={{ fontSize: 14, color: "#334155" }}>
          Privacy mode
        </label>
      </div>
      <div style={{ ...hintStyle, marginTop: -4, marginBottom: 8 }}>
        When enabled, sensitive form fields are excluded from translation.
      </div>
    </div>
  )
}

function ProvidersSection({
  config,
  onProviderChange,
}: {
  config: AstraConfig
  onProviderChange: (patch: Partial<AstraConfig["provider"]>) => void
}) {
  return (
    <div>
      <h2 style={sectionTitle}>Providers</h2>

      <div style={fieldGroup}>
        <label style={labelStyle}>Provider</label>
        <select
          style={selectStyle}
          value={config.provider.id}
          onChange={(e) => {
            const id = e.target.value as ProviderId
            onProviderChange({ id, model: getDefaultProviderModel(id) })
          }}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>API key</label>
        <input
          type="password"
          style={inputStyle}
          value={config.provider.apiKey ?? ""}
          onChange={(e) => onProviderChange({ apiKey: e.target.value })}
          placeholder={config.provider.id === "gemini" ? "AIzaSy..." : "sk-..."}
        />
        <div style={hintStyle}>
          With an API key, requests go directly to {config.provider.id === "gemini" ? "Google" : "OpenAI"} -- no Astra account required.
        </div>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Relay URL</label>
        <input
          style={inputStyle}
          value={config.provider.relayBaseURL ?? ""}
          onChange={(e) => onProviderChange({ relayBaseURL: e.target.value })}
          placeholder="https://api.astra.example/v1"
        />
        <div style={hintStyle}>Optional. Route requests through an Astra relay server.</div>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Model</label>
        <input
          style={inputStyle}
          value={config.provider.model}
          onChange={(e) => onProviderChange({ model: e.target.value })}
          placeholder={getDefaultProviderModel(config.provider.id)}
        />
      </div>
    </div>
  )
}

function TranslationSection({
  config,
  onPresentationChange,
}: {
  config: AstraConfig
  onPresentationChange: (patch: Partial<AstraConfig["presentation"]>) => void
}) {
  return (
    <div>
      <h2 style={sectionTitle}>Translation</h2>

      <div style={fieldGroup}>
        <label style={labelStyle}>Presentation mode</label>
        <select
          style={selectStyle}
          value={config.presentation.mode}
          onChange={(e) => onPresentationChange({ mode: e.target.value as TranslationMode })}
        >
          {MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Theme</label>
        <select
          style={selectStyle}
          value={config.presentation.theme}
          onChange={(e) => onPresentationChange({ theme: e.target.value as TranslationTheme })}
        >
          {THEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Font size (em)</label>
        <input
          type="number"
          step="0.01"
          min="0.5"
          max="2.0"
          style={{ ...inputStyle, maxWidth: 120 }}
          value={config.presentation.fontSize}
          onChange={(e) => {
            const value = parseFloat(e.target.value)
            if (!Number.isNaN(value)) {
              onPresentationChange({ fontSize: Math.max(0.5, Math.min(2.0, value)) })
            }
          }}
        />
      </div>

      <div style={fieldGroup}>
        <label style={labelStyle}>Translation color</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="color"
            value={config.presentation.translationColor}
            onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
            style={{ width: 40, height: 32, border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer", padding: 2 }}
          />
          <input
            style={{ ...inputStyle, maxWidth: 160 }}
            value={config.presentation.translationColor}
            onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
            placeholder="#64748b"
          />
        </div>
      </div>
    </div>
  )
}

function SitesSection({
  config,
  onChange,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
}) {
  const siteEntries = Object.entries(config.sites)
  const [editingSite, setEditingSite] = useState<string | null>(null)
  const [newSiteKey, setNewSiteKey] = useState("")

  const deleteSite = (hostname: string) => {
    const nextSites = { ...config.sites }
    delete nextSites[hostname]
    onChange({ sites: nextSites })
  }

  const updateSite = (hostname: string, patch: Partial<SiteConfig>) => {
    const nextSites = { ...config.sites }
    const current = nextSites[hostname] ?? { enabled: true, alwaysTranslate: false }
    const updated = { ...current, ...patch }
    if (isDefaultSiteConfig(updated)) {
      delete nextSites[hostname]
    } else {
      nextSites[hostname] = updated
    }
    onChange({ sites: nextSites })
  }

  const addSite = () => {
    const key = normalizeSiteKey(newSiteKey)
    if (!key) return
    const nextSites = { ...config.sites }
    if (!nextSites[key]) {
      nextSites[key] = { enabled: true, alwaysTranslate: false }
    }
    onChange({ sites: nextSites })
    setNewSiteKey("")
    setEditingSite(key)
  }

  return (
    <div>
      <h2 style={sectionTitle}>Sites</h2>
      <div style={hintStyle}>Per-site rules override global settings.</div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          style={inputStyle}
          value={newSiteKey}
          onChange={(e) => setNewSiteKey(e.target.value)}
          placeholder="example.com"
          onKeyDown={(e) => { if (e.key === "Enter") addSite() }}
        />
        <button type="button" style={btnSecondary} onClick={addSite}>Add site</button>
      </div>

      {siteEntries.length === 0 && (
        <div style={{ ...cardStyle, color: "#94a3b8", textAlign: "center" }}>
          No per-site rules configured.
        </div>
      )}

      {siteEntries.map(([hostname, siteConfig]) => (
        <div key={hostname} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingSite === hostname ? 12 : 0 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{hostname}</span>
              {!siteConfig.enabled && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#dc2626", background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
                  disabled
                </span>
              )}
              {siteConfig.alwaysTranslate && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#059669", background: "#ecfdf5", padding: "2px 6px", borderRadius: 4 }}>
                  auto-translate
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12 }}
                onClick={() => setEditingSite(editingSite === hostname ? null : hostname)}
              >
                {editingSite === hostname ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                style={{ ...btnDanger, padding: "4px 12px", fontSize: 12 }}
                onClick={() => deleteSite(hostname)}
              >
                Delete
              </button>
            </div>
          </div>

          {editingSite === hostname && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  id={`site-enabled-${hostname}`}
                  checked={siteConfig.enabled}
                  onChange={(e) => updateSite(hostname, { enabled: e.target.checked })}
                />
                <label htmlFor={`site-enabled-${hostname}`}>Enabled</label>
              </div>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  id={`site-auto-${hostname}`}
                  checked={siteConfig.alwaysTranslate}
                  onChange={(e) => updateSite(hostname, { alwaysTranslate: e.target.checked })}
                />
                <label htmlFor={`site-auto-${hostname}`}>Auto-translate on load</label>
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Target language override</label>
                <select
                  style={{ ...selectStyle, maxWidth: 220 }}
                  value={siteConfig.targetLang ?? ""}
                  onChange={(e) => updateSite(hostname, { targetLang: e.target.value || undefined })}
                >
                  <option value="">Use global default</option>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Hover trigger override</label>
                <select
                  style={{ ...selectStyle, maxWidth: 220 }}
                  value={siteConfig.hoverTrigger ?? ""}
                  onChange={(e) => updateSite(hostname, { hoverTrigger: (e.target.value || undefined) as HoverTrigger | undefined })}
                >
                  <option value="">Use global default</option>
                  {HOVER_TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  maxWidth: "100%",
  minHeight: 80,
  resize: "vertical",
  fontFamily: "monospace",
  fontSize: 13,
}

function ActionsSection({
  config,
  onChange,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
}) {
  const customActions = config.customActions ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newLabelZh, setNewLabelZh] = useState("")
  const [newPrompt, setNewPrompt] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editLabelZh, setEditLabelZh] = useState("")
  const [editPrompt, setEditPrompt] = useState("")

  const generateId = (label: string): string => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const id = base || "custom"
    const existingIds = new Set([
      ...BUILTIN_IDS,
      ...customActions.map(a => a.id),
    ])
    if (!existingIds.has(id)) return id
    let counter = 2
    while (existingIds.has(`${id}-${counter}`)) counter++
    return `${id}-${counter}`
  }

  const handleAdd = () => {
    if (!newLabel.trim() || !newLabelZh.trim() || !newPrompt.trim()) return
    const action: CustomAction = {
      id: generateId(newLabel),
      label: newLabel.trim(),
      labelZh: newLabelZh.trim(),
      systemPrompt: newPrompt.trim(),
      enabled: true,
    }
    onChange({ customActions: [...customActions, action] })
    setNewLabel("")
    setNewLabelZh("")
    setNewPrompt("")
    setShowNewForm(false)
  }

  const handleDelete = (id: string) => {
    onChange({ customActions: customActions.filter(a => a.id !== id) })
    if (editingId === id) setEditingId(null)
  }

  const handleToggle = (id: string) => {
    onChange({
      customActions: customActions.map(a =>
        a.id === id ? { ...a, enabled: !a.enabled } : a,
      ),
    })
  }

  const startEditing = (action: CustomAction) => {
    setEditingId(action.id)
    setEditLabel(action.label)
    setEditLabelZh(action.labelZh)
    setEditPrompt(action.systemPrompt)
  }

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim() || !editLabelZh.trim() || !editPrompt.trim()) return
    onChange({
      customActions: customActions.map(a =>
        a.id === id
          ? { ...a, label: editLabel.trim(), labelZh: editLabelZh.trim(), systemPrompt: editPrompt.trim() }
          : a,
      ),
    })
    setEditingId(null)
  }

  return (
    <div>
      <h2 style={sectionTitle}>Custom Actions</h2>
      <div style={hintStyle}>
        Custom actions appear in the selection toolbar alongside built-in actions.
        Use {"{{text}}"} and {"{{targetLang}}"} as placeholders in your prompt template.
      </div>

      {customActions.length === 0 && !showNewForm && (
        <div style={{ ...cardStyle, color: "#94a3b8", textAlign: "center", marginTop: 16 }}>
          No custom actions configured.
        </div>
      )}

      {customActions.map((action) => (
        <div key={action.id} style={{ ...cardStyle, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingId === action.id ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={action.enabled}
                onChange={() => handleToggle(action.id)}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{action.label}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>({action.labelZh})</span>
              {!action.enabled && (
                <span style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
                  disabled
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12 }}
                onClick={() => editingId === action.id ? setEditingId(null) : startEditing(action)}
              >
                {editingId === action.id ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                style={{ ...btnDanger, padding: "4px 12px", fontSize: 12 }}
                onClick={() => handleDelete(action.id)}
              >
                Delete
              </button>
            </div>
          </div>

          {editingId !== action.id && (
            <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {action.systemPrompt.length > 80 ? `${action.systemPrompt.slice(0, 80)}...` : action.systemPrompt}
            </div>
          )}

          {editingId === action.id && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <div style={fieldGroup}>
                <label style={labelStyle}>Label (English)</label>
                <input
                  style={inputStyle}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Label (Chinese)</label>
                <input
                  style={inputStyle}
                  value={editLabelZh}
                  onChange={(e) => setEditLabelZh(e.target.value)}
                />
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>System prompt template</label>
                <textarea
                  style={textareaStyle}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                />
                <div style={hintStyle}>
                  Use {"{{text}}"} for selected text, {"{{targetLang}}"} for target language.
                </div>
              </div>
              <button
                type="button"
                style={btnPrimary}
                onClick={() => handleSaveEdit(action.id)}
              >
                Save changes
              </button>
            </div>
          )}
        </div>
      ))}

      {showNewForm ? (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>New custom action</h3>
          <div style={fieldGroup}>
            <label style={labelStyle}>Label (English)</label>
            <input
              style={inputStyle}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Simplify"
            />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Label (Chinese)</label>
            <input
              style={inputStyle}
              value={newLabelZh}
              onChange={(e) => setNewLabelZh(e.target.value)}
              placeholder="e.g. 简化"
            />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>System prompt template</label>
            <textarea
              style={textareaStyle}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder={"Simplify the following text in {{targetLang}}. Output only the simplified text.\n\nText: {{text}}"}
            />
            <div style={hintStyle}>
              Use {"{{text}}"} for selected text, {"{{targetLang}}"} for target language.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btnPrimary} onClick={handleAdd}>
              Add action
            </button>
            <button type="button" style={btnSecondary} onClick={() => { setShowNewForm(false); setNewLabel(""); setNewLabelZh(""); setNewPrompt("") }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <button type="button" style={btnSecondary} onClick={() => setShowNewForm(true)}>
            + Add custom action
          </button>
        </div>
      )}
    </div>
  )
}

const BUILTIN_IDS = new Set(["translate", "explain", "summarize", "rewrite", "grammar"])

function VocabularySection() {
  const openVocabulary = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html") })
  }

  const [cacheInfo, setCacheInfo] = useState<string>("Loading...")

  useEffect(() => {
    void browser.storage.local.getBytesInUse?.()
      .then((bytes) => {
        if (typeof bytes === "number") {
          const kb = (bytes / 1024).toFixed(1)
          setCacheInfo(`${kb} KB used in local storage`)
        } else {
          setCacheInfo("Storage usage unavailable")
        }
      })
      .catch(() => setCacheInfo("Storage usage unavailable"))
  }, [])

  const clearCache = async () => {
    try {
      await browser.storage.local.remove("astra.vocab.cache")
      setCacheInfo("Cache cleared")
    } catch {
      setCacheInfo("Failed to clear cache")
    }
  }

  return (
    <div>
      <h2 style={sectionTitle}>Vocabulary</h2>

      <div style={cardStyle}>
        <div style={{ marginBottom: 12 }}>
          <strong>Saved words</strong>
          <div style={hintStyle}>Open the vocabulary page to review and manage saved words.</div>
        </div>
        <button type="button" style={btnPrimary} onClick={openVocabulary}>
          Open vocabulary
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ marginBottom: 12 }}>
          <strong>Cache</strong>
          <div style={{ ...hintStyle, marginTop: 4 }}>{cacheInfo}</div>
        </div>
        <button type="button" style={btnDanger} onClick={() => void clearCache()}>
          Clear cache
        </button>
      </div>
    </div>
  )
}

function AboutSection() {
  const version = browser.runtime.getManifest?.()?.version ?? "0.1.0"

  return (
    <div>
      <h2 style={sectionTitle}>About</h2>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: BRAND_COLOR, marginBottom: 8 }}>
          Astra
        </div>
        <div style={{ marginBottom: 12, color: "#475569" }}>
          AI-powered language learning software, extension-first.
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
          Version: {version}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <a
            href="https://github.com/nicepkg/astra"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: BRAND_COLOR, fontSize: 13 }}
          >
            GitHub
          </a>
          <a
            href="https://astra-docs.example.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: BRAND_COLOR, fontSize: 13 }}
          >
            Documentation
          </a>
        </div>
      </div>
    </div>
  )
}

// --- Main component ---

export default function OptionsApp() {
  const [section, setSection] = useState<Section>("general")
  const [config, setConfig] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void readConfig().then((c) => setConfig(c))
  }, [])

  const updateConfig = (patch: Partial<AstraConfig>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({ ...current, ...patch }))
  }

  const updateProvider = (patch: Partial<AstraConfig["provider"]>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({
      ...current,
      provider: { ...current.provider, ...patch },
    }))
  }

  const updatePresentation = (patch: Partial<AstraConfig["presentation"]>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({
      ...current,
      presentation: { ...current.presentation, ...patch },
    }))
  }

  const handleSave = async () => {
    try {
      setError(null)
      const nextConfig = await saveConfig({
        targetLang: config.targetLang,
        hoverTrigger: config.hoverTrigger,
        contentScope: config.contentScope,
        inputTranslation: config.inputTranslation,
        languageLevel: config.languageLevel,
        privacyMode: config.privacyMode,
        provider: {
          id: config.provider.id,
          relayBaseURL: config.provider.relayBaseURL ?? "",
          model: config.provider.model,
          apiKey: config.provider.apiKey,
        },
        presentation: config.presentation,
        sites: config.sites,
        customActions: config.customActions,
      })
      setConfig(nextConfig)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    }
  }

  const renderSection = () => {
    switch (section) {
      case "general":
        return <GeneralSection config={config} onChange={updateConfig} />
      case "providers":
        return <ProvidersSection config={config} onProviderChange={updateProvider} />
      case "translation":
        return <TranslationSection config={config} onPresentationChange={updatePresentation} />
      case "actions":
        return <ActionsSection config={config} onChange={updateConfig} />
      case "sites":
        return <SitesSection config={config} onChange={updateConfig} />
      case "vocabulary":
        return <VocabularySection />
      case "about":
        return <AboutSection />
    }
  }

  return (
    <div style={pageStyle}>
      <nav style={sidebarStyle}>
        <div style={logoStyle}>Astra</div>
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            style={{
              ...navBtnBase,
              ...(section === item.key ? navBtnActive : {}),
            }}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main style={contentStyle}>
        {saved && <div style={successBanner}>Settings saved.</div>}
        {error && (
          <div style={{ ...successBanner, background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>
            {error}
          </div>
        )}

        {renderSection()}

        {section !== "vocabulary" && section !== "about" && (
          <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              style={{ ...btnPrimary, opacity: dirty ? 1 : 0.6 }}
              onClick={() => void handleSave()}
            >
              Save settings
            </button>
            {dirty && <span style={{ fontSize: 12, color: "#94a3b8" }}>Unsaved changes</span>}
          </div>
        )}
      </main>
    </div>
  )
}
