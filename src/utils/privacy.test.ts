import { describe, expect, it } from "vitest"

import {
  isSensitiveInput,
  sanitizeTranslationContext,
  sanitizeTranslationContextForTransport,
} from "./privacy"

describe("privacy", () => {
  describe("isSensitiveInput", () => {
    function createInput(attrs: Record<string, string> = {}): HTMLInputElement {
      const input = document.createElement("input")
      for (const [key, value] of Object.entries(attrs)) {
        input.setAttribute(key, value)
      }
      return input
    }

    it("flags password inputs", () => {
      expect(isSensitiveInput(createInput({ type: "password" }))).toBe(true)
    })

    it("flags hidden inputs", () => {
      expect(isSensitiveInput(createInput({ type: "hidden" }))).toBe(true)
    })

    it("flags inputs with credit card names", () => {
      expect(isSensitiveInput(createInput({ name: "creditCardNumber" }))).toBe(true)
      expect(isSensitiveInput(createInput({ name: "card-number" }))).toBe(true)
      expect(isSensitiveInput(createInput({ name: "cvv" }))).toBe(true)
    })

    it("flags inputs with SSN-related names", () => {
      expect(isSensitiveInput(createInput({ name: "ssn" }))).toBe(true)
      expect(isSensitiveInput(createInput({ name: "social-security-number" }))).toBe(true)
    })

    it("flags inputs with sensitive autocomplete tokens", () => {
      expect(isSensitiveInput(createInput({ autocomplete: "cc-number" }))).toBe(true)
      expect(isSensitiveInput(createInput({ autocomplete: "cc-csc" }))).toBe(true)
      expect(isSensitiveInput(createInput({ autocomplete: "new-password" }))).toBe(true)
      expect(isSensitiveInput(createInput({ autocomplete: "current-password" }))).toBe(true)
      expect(isSensitiveInput(createInput({ autocomplete: "one-time-code" }))).toBe(true)
    })

    it("flags inputs with sensitive name patterns", () => {
      expect(isSensitiveInput(createInput({ name: "bank_account" }))).toBe(true)
    })

    it("does not flag inputs with benign autocomplete values", () => {
      expect(isSensitiveInput(createInput({ autocomplete: "name" }))).toBe(false)
      expect(isSensitiveInput(createInput({ autocomplete: "email" }))).toBe(false)
      expect(isSensitiveInput(createInput({ autocomplete: "address-line1" }))).toBe(false)
    })

    it("does not flag regular text inputs", () => {
      expect(isSensitiveInput(createInput({ type: "text", name: "username" }))).toBe(false)
      expect(isSensitiveInput(createInput({ type: "text", name: "search" }))).toBe(false)
      expect(isSensitiveInput(createInput({ type: "email", name: "email" }))).toBe(false)
    })

    it("flags textareas with sensitive names", () => {
      const textarea = document.createElement("textarea")
      textarea.name = "secret_notes"
      expect(isSensitiveInput(textarea)).toBe(true)
    })

    it("does not flag regular textareas", () => {
      const textarea = document.createElement("textarea")
      textarea.name = "comment"
      expect(isSensitiveInput(textarea)).toBe(false)
    })
  })

  describe("sanitizeTranslationContext", () => {
    it("preserves hostname and pageUrl only", () => {
      const context = {
        hostname: "example.com",
        pageUrl: "https://example.com/article",
        pageTitle: "Secret Article Title",
        metaDescription: "Confidential description",
        contentSummary: "Full article text summary",
        selectionContext: "Selected private text",
      }

      const sanitized = sanitizeTranslationContext(context)

      expect(sanitized).toEqual({
        hostname: "example.com",
        pageUrl: "https://example.com/article",
      })
    })

    it("handles empty context", () => {
      const sanitized = sanitizeTranslationContext({})
      expect(sanitized).toEqual({})
    })

    it("handles partial context", () => {
      const sanitized = sanitizeTranslationContext({
        hostname: "example.com",
        contentSummary: "some summary",
      })
      expect(sanitized).toEqual({
        hostname: "example.com",
      })
    })

    it("strips query string and fragment from pageUrl", () => {
      const sanitized = sanitizeTranslationContext({
        pageUrl: "https://example.com/page?token=abc123&session=xyz#section",
        hostname: "example.com",
      })
      expect(sanitized).toEqual({
        hostname: "example.com",
        pageUrl: "https://example.com/page",
      })
    })

    it("fails closed for malformed pageUrl values by stripping query string and fragment", () => {
      const sanitized = sanitizeTranslationContext({
        pageUrl: "/page?token=abc123#section",
        hostname: "example.com",
      })
      expect(sanitized).toEqual({
        hostname: "example.com",
        pageUrl: "/page",
      })
    })
  })

  describe("sanitizeTranslationContextForTransport", () => {
    it("sanitizes context at the transport boundary when privacy mode is enabled", () => {
      const sanitized = sanitizeTranslationContextForTransport({
        hostname: "example.com",
        pageUrl: "https://example.com/page?token=abc123#section",
        pageTitle: "Private title",
        contentSummary: "Private summary",
      }, true)

      expect(sanitized).toEqual({
        hostname: "example.com",
        pageUrl: "https://example.com/page",
      })
    })

    it("preserves context when privacy mode is disabled", () => {
      const context = {
        hostname: "example.com",
        pageUrl: "https://example.com/page?token=abc123#section",
        pageTitle: "Visible title",
      }

      expect(sanitizeTranslationContextForTransport(context, false)).toEqual(context)
    })
  })
})
