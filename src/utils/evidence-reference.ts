export interface EvidenceReferenceOptions {
  allowTestFixtures?: boolean
}

export function hasUnsafeReferenceCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code <= 32 || code >= 127 || /[\p{Separator}\p{Other}]/u.test(character)
  })
}

export function hasUnsafeEncodedReferenceCharacters(value: string, options: { allowEncodedStructuralUrlQueryChars?: boolean } = {}): boolean {
  const unsafeEncodedPattern = options.allowEncodedStructuralUrlQueryChars
    ? /%(?:0[0-9a-f]|1[0-9a-f]|20|7f)/i
    : /%(?:0[0-9a-f]|1[0-9a-f]|20|7f|2e|2f|5c)/i
  if (/%(?![0-9a-f]{2})/i.test(value) || unsafeEncodedPattern.test(value)) return true
  const encodedSequences = value.match(/(?:%[0-9a-f]{2})+/gi) ?? []
  return encodedSequences.some((sequence) => {
    try {
      const decodedSequence = decodeURIComponent(sequence)
      return hasUnsafeReferenceCharacters(decodedSequence)
        || hasUnsafeEncodedReferenceCharacters(decodedSequence, options)
    } catch {
      return true
    }
  })
}

function hasPlaceholderEvidenceReferenceKeyword(value: string): boolean {
  const candidates = [value]
  try {
    candidates.push(decodeURIComponent(value))
  } catch {
    // Malformed percent-encoding is rejected by hasUnsafeEncodedReferenceCharacters().
  }
  return candidates.some((candidate) => /\b(?:example|placeholder|todo|mock|draft|tbd|pending|temp|temporary|(?:(?:sample|fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report))|(?:(?:proof|evidence|artifact|report)[-_ ]?(?:sample|fake|dummy|latest|dev|local)))\b/i.test(candidate))
}

export function isEvidenceLikeReference(value: string, options: EvidenceReferenceOptions = {}): boolean {
  const trimmedValue = value.trim()
  if (trimmedValue !== value || hasUnsafeReferenceCharacters(value)) return false
  if (/^https?:\/\//i.test(trimmedValue)) return isPublicHttpsEvidenceUrl(trimmedValue)
  if (hasUnsafeEncodedReferenceCharacters(value) || hasPlaceholderEvidenceReferenceKeyword(value)) return false
  return isRepoArtifactPathReference(trimmedValue, options)
}

export function evidenceReferenceDuplicateIdentity(value: string): string {
  const trimmedValue = value.trim()
  if (/^https?:\/\//i.test(trimmedValue)) {
    try {
      const url = new URL(trimmedValue)
      const repoArtifactPath = githubAstraRepoArtifactPathDuplicateIdentity(url)
      if (repoArtifactPath !== null) return repoArtifactPath
      const hostname = url.hostname.toLowerCase().replace(/\.+$/, "")
      const protocol = url.protocol.toLowerCase()
      const port = url.port.length > 0 && !(protocol === "https:" && url.port === "443") ? `:${url.port}` : ""
      return `${protocol}//${hostname}${port}`
        + normalizeUrlComponentForDuplicateIdentity(url.pathname)
    } catch {
      return trimmedValue
    }
  }
  return trimmedValue
}

const ASTRA_GITHUB_REPOSITORY_OWNERS = new Set(["astra-release", "raydocs"])

function isAstraGitHubRepository(owner: string | undefined, repo: string | undefined): boolean {
  return owner !== undefined
    && repo !== undefined
    && ASTRA_GITHUB_REPOSITORY_OWNERS.has(owner.toLowerCase())
    && repo.toLowerCase() === "astra"
}

function githubAstraRepoArtifactPathDuplicateIdentity(url: URL): string | null {
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "")
  const pathSegments = url.pathname.split("/").filter((segment) => segment.length > 0)
  const repoPathSegments = (() => {
    if (hostname === "github.com" && pathSegments.length >= 5 && isAstraGitHubRepository(pathSegments[0], pathSegments[1])) {
      const mode = pathSegments[2]
      if (mode === "blob" || mode === "raw") return pathSegments.slice(4)
    }
    if (hostname === "raw.githubusercontent.com" && pathSegments.length >= 4 && isAstraGitHubRepository(pathSegments[0], pathSegments[1])) {
      return pathSegments.slice(3)
    }
    return null
  })()
  if (repoPathSegments === null) return null
  const repoArtifactPath = repoPathSegments.map((segment) => normalizeUrlComponentForDuplicateIdentity(segment)).join("/")
  return isRepoArtifactPathReference(repoArtifactPath) ? repoArtifactPath : null
}

function normalizeUrlComponentForDuplicateIdentity(value: string): string {
  return value.replace(/%[0-9a-f]{2}/gi, (encodedValue) => {
    const character = String.fromCharCode(Number.parseInt(encodedValue.slice(1), 16))
    return /^[a-z0-9_-]$/i.test(character) || character === "~" ? character : encodedValue.toUpperCase()
  })
}

export function isPublicHttpsEvidenceUrl(value: string): boolean {
  const trimmedValue = value.trim()
  const rawUrlPath = extractRawUrlPath(trimmedValue)
  if (
    trimmedValue !== value
    || hasUnsafeReferenceCharacters(value)
    || hasPlaceholderEvidenceReferenceKeyword(value)
    || trimmedValue.includes("\\")
    || hasRawUrlPathDotSegments(rawUrlPath)
    || hasUnsafeEncodedReferenceCharacters(rawUrlPath)
  ) return false
  try {
    const url = new URL(trimmedValue)
    if (hasUnsafeEncodedReferenceCharacters(value, { allowEncodedStructuralUrlQueryChars: true }) || hasUnsafeEncodedReferenceCharacters(url.pathname)) return false
    return url.protocol === "https:"
      && url.username.length === 0
      && url.password.length === 0
      && !isNonCanonicalIpv4Hostname(trimmedValue, url.hostname)
      && !isMalformedDnsHostname(url.hostname)
      && !isLocalUrlReference(trimmedValue)
  } catch {
    return false
  }
}

function extractRawUrlPath(value: string): string {
  const match = /^https?:\/\/[^/?#]*(\/[^?#]*)?/i.exec(value)
  return match?.[1] ?? ""
}

function hasRawUrlPathDotSegments(rawPath: string): boolean {
  return rawPath.split(/[\\/]/).some((segment) => segment === "." || segment === "..")
}

export function isRepoArtifactPathReference(value: string, options: EvidenceReferenceOptions = {}): boolean {
  if (hasUnsafeReferenceCharacters(value) || hasUnsafeEncodedReferenceCharacters(value) || hasPlaceholderEvidenceReferenceKeyword(value)) return false
  const prefixPattern = options.allowTestFixtures
    ? /^(docs\/|data\/|artifacts\/|test-results\/|playwright-report\/|test\/fixtures\/)/
    : /^(docs\/|data\/|artifacts\/|test-results\/|playwright-report\/)/
  if (!prefixPattern.test(value)) return false
  if (value.startsWith("/") || value.includes("\\") || value.includes("?") || value.includes("#") || value.includes("%")) return false

  const segments = value.split("/")
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && !segment.startsWith("."))
}

function isNonCanonicalIpv4Hostname(value: string, normalizedHostname: string): boolean {
  if (parseIpv4Hostname(normalizedHostname) === null) return false
  const rawHostname = extractRawUrlHostname(value)
  if (rawHostname === null || rawHostname.startsWith("[")) return false
  const normalizedRawHostname = rawHostname.toLowerCase().replace(/\.+$/, "")
  return normalizedRawHostname !== normalizedHostname && /^[0-9a-fx.]+$/i.test(normalizedRawHostname) && /\d/.test(normalizedRawHostname)
}

function extractRawUrlHostname(value: string): string | null {
  const authorityMatch = /^https:\/\/([^/?#]+)/i.exec(value)
  if (!authorityMatch) return null
  const authority = authorityMatch[1].split("@").at(-1) ?? ""
  if (authority.startsWith("[")) {
    const endIndex = authority.indexOf("]")
    return endIndex === -1 ? null : authority.slice(0, endIndex + 1)
  }
  return authority.split(":")[0] ?? null
}

function isLocalUrlReference(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/\.+$/, "")
    const ipv4Octets = parseIpv4Hostname(hostname)
    return hostname.length === 0
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || isNonPublicDnsHostname(hostname)
      || (ipv4Octets !== null && isNonPublicIpv4Octets(ipv4Octets))
      || isPrivateIpv6Hostname(hostname)
  } catch {
    return true
  }
}

function isMalformedDnsHostname(hostname: string): boolean {
  const hostnameWithoutBrackets = hostname.replace(/^\[|\]$/g, "")
  if (parseIpv4Hostname(hostname) !== null || parseIpv6Hextets(hostnameWithoutBrackets) !== null) return false
  const labels = hostname.split(".")
  return labels.some((label) => label.length === 0
    || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
}

function isNonPublicDnsHostname(hostname: string): boolean {
  const hostnameWithoutBrackets = hostname.replace(/^\[|\]$/g, "")
  if (parseIpv4Hostname(hostname) !== null || parseIpv6Hextets(hostnameWithoutBrackets) !== null) return false
  return !hostname.includes(".")
    || hostname === "local"
    || hostname.endsWith(".local")
    || hostname === "test"
    || hostname.endsWith(".test")
    || hostname === "invalid"
    || hostname.endsWith(".invalid")
    || hostname === "internal"
    || hostname.endsWith(".internal")
    || hostname === "onion"
    || hostname.endsWith(".onion")
    || hostname === "home.arpa"
    || hostname.endsWith(".home.arpa")
    || isReservedDocumentationDnsHostname(hostname)
}

function isReservedDocumentationDnsHostname(hostname: string): boolean {
  return hostname === "example.com"
    || hostname.endsWith(".example.com")
    || hostname === "example.net"
    || hostname.endsWith(".example.net")
    || hostname === "example.org"
    || hostname.endsWith(".example.org")
    || hostname === "example"
    || hostname.endsWith(".example")
}

function isPrivateIpv6Hostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "")
  const hextets = parseIpv6Hextets(normalizedHostname)
  if (hextets === null) return false
  return isPrivateIpv4MappedIpv6Hostname(normalizedHostname) || isNonPublicIpv6Hextets(hextets)
}

function parseIpv6Hextets(hostname: string): number[] | null {
  if (!/^[0-9a-f:]+$/i.test(hostname)) return null
  const compressedParts = hostname.split("::")
  if (compressedParts.length > 2) return null

  const parsePart = (part: string): number[] | null => {
    if (part.length === 0) return []
    const hextets = part.split(":")
    if (hextets.some((hextet) => !/^[0-9a-f]{1,4}$/i.test(hextet))) return null
    return hextets.map((hextet) => Number.parseInt(hextet, 16))
  }

  const head = parsePart(compressedParts[0] ?? "")
  const tail = parsePart(compressedParts[1] ?? "")
  if (head === null || tail === null) return null
  if (compressedParts.length === 1) return head.length === 8 ? head : null

  const missingHextetCount = 8 - head.length - tail.length
  if (missingHextetCount < 1) return null
  return [...head, ...Array.from({ length: missingHextetCount }, () => 0), ...tail]
}

function isNonPublicIpv6Hextets(hextets: number[]): boolean {
  if (hextets.length !== 8) return false
  return hextets.every((hextet) => hextet === 0)
    || hextets.slice(0, 7).every((hextet) => hextet === 0) && hextets[7] === 1
    || (hextets[0] & 0xfe00) === 0xfc00
    || (hextets[0] & 0xffc0) === 0xfe80
    || (hextets[0] & 0xff00) === 0xff00
    || isIpv6Prefix(hextets, [0x0064, 0xff9b, 0, 0, 0, 0])
    || isIpv6Prefix(hextets, [0x0064, 0xff9b, 0x0001])
    || isIpv6Prefix(hextets, [0x0100, 0, 0, 0])
    || isIpv6Prefix(hextets, [0x2001, 0])
    || isIpv6Prefix(hextets, [0x2001, 0x0002, 0])
    || isIpv6Prefix(hextets, [0x2001, 0x0db8])
    || hextets[0] === 0x2002
}

function isIpv6Prefix(hextets: number[], prefix: readonly number[]): boolean {
  return prefix.every((hextet, index) => hextets[index] === hextet)
}

function isPrivateIpv4MappedIpv6Hostname(hostname: string): boolean {
  const dottedMatch = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(hostname)
  if (dottedMatch) {
    const octets = parseIpv4Hostname(dottedMatch[1])
    return octets !== null && isNonPublicIpv4Octets(octets)
  }

  const hexMatch = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(hostname)
  if (!hexMatch) return false
  const high = Number.parseInt(hexMatch[1], 16)
  const low = Number.parseInt(hexMatch[2], 16)
  return isNonPublicIpv4Octets([high >> 8, high & 255, low >> 8, low & 255])
}

function parseIpv4Hostname(value: string): number[] | null {
  const parts = value.split(".")
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets
}

function isNonPublicIpv4Octets(octets: number[]): boolean {
  if (octets.length !== 4) return false
  const [first, second, third] = octets
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 168 || (second === 0 && (third === 0 || third === 2)) || (second === 88 && third === 99)))
    || (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100)))
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
}
