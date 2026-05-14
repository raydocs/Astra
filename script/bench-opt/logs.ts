import { mkdir, stat, writeFile, appendFile, rename } from "node:fs/promises"
import path from "node:path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported log levels, ordered from lowest to highest severity. */
export type BenchOptLogLevel = "debug" | "info" | "warn" | "error" | "fatal"

/** Numeric severity for each log level (higher = more severe). */
const LOG_LEVEL_SEVERITY: Record<BenchOptLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

/** A single structured log entry. */
export interface BenchOptLogEntry {
  /** ISO timestamp. */
  timestamp: string
  /** Severity level. */
  level: BenchOptLogLevel
  /** Component or subsystem that emitted the log. */
  component: string
  /** Human-readable message. */
  message: string
  /** Structured metadata (optional). */
  metadata?: Record<string, unknown>
  /** Context fields propagated from the logger. */
  context: {
    sessionId: string
    iteration?: number
    candidateId?: string
  }
}

/** Options for creating a logger. */
export interface BenchOptLoggerOptions {
  /** Minimum level to emit. Default "info". */
  minLevel?: BenchOptLogLevel
  /** Root directory for log files. Default "data/bench-opt-results". */
  outputDir?: string
  /** Maximum log file size in bytes before rotation. Default 5 MB. */
  maxFileSizeBytes?: number
  /** Maximum number of rotated log files to keep. Default 3. */
  maxRotatedFiles?: number
  /** Enable console output. Default true. */
  enableConsole?: boolean
  /** Enable file output. Default true. */
  enableFile?: boolean
  /** Component name used as default for all log calls. Default "bench-opt". */
  defaultComponent?: string
}

/** A logger instance returned by {@link createLogger}. */
export interface BenchOptLogger {
  /** Log at debug level. */
  debug(message: string, metadata?: Record<string, unknown>): void
  /** Log at info level. */
  info(message: string, metadata?: Record<string, unknown>): void
  /** Log at warn level. */
  warn(message: string, metadata?: Record<string, unknown>): void
  /** Log at error level. */
  error(message: string, metadata?: Record<string, unknown>): void
  /** Log at fatal level. */
  fatal(message: string, metadata?: Record<string, unknown>): void
  /** Log at an arbitrary level with a specific component. */
  log(level: BenchOptLogLevel, component: string, message: string, metadata?: Record<string, unknown>): void
  /** Update the propagated iteration context. */
  setIteration(iteration: number): void
  /** Update the propagated candidate ID context. */
  setCandidateId(candidateId: string | undefined): void
  /** Create a child logger that inherits context and adds a component prefix. */
  child(component: string): BenchOptLogger
  /** Flush any pending writes and close the file sink. */
  close(): Promise<void>
}

// ---------------------------------------------------------------------------
// Console formatting
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<BenchOptLogLevel, string> = {
  debug: "\x1b[90m",  // gray
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  fatal: "\x1b[35m",  // magenta
}

const RESET = "\x1b[0m"

function formatConsole(entry: BenchOptLogEntry): string {
  const color = LEVEL_COLORS[entry.level]
  const ts = entry.timestamp.slice(11, 23) // HH:mm:ss.mmm
  const level = entry.level.toUpperCase().padEnd(5)
  const ctx = entry.context.iteration !== undefined
    ? ` [iter=${entry.context.iteration}]`
    : ""
  const cand = entry.context.candidateId
    ? ` [cand=${entry.context.candidateId}]`
    : ""
  const meta = entry.metadata && Object.keys(entry.metadata).length > 0
    ? ` ${JSON.stringify(entry.metadata)}`
    : ""

  return `${color}${ts} ${level}${RESET} [${entry.component}]${ctx}${cand} ${entry.message}${meta}`
}

function formatFileLine(entry: BenchOptLogEntry): string {
  return JSON.stringify(entry)
}

// ---------------------------------------------------------------------------
// File sink with rotation
// ---------------------------------------------------------------------------

interface FileSink {
  write(line: string): Promise<void>
  close(): Promise<void>
}

function createFileSink(
  logDir: string,
  sessionId: string,
  maxSizeBytes: number,
  maxRotated: number,
): FileSink {
  const baseFileName = `bench-opt-${sessionId}.log`
  const filePath = path.join(logDir, baseFileName)

  let initialized = false
  let currentSizeBytes = 0
  let rotating = false

  async function ensureDir() {
    if (!initialized) {
      await mkdir(logDir, { recursive: true })
      try {
        const stats = await stat(filePath)
        currentSizeBytes = stats.size
      } catch {
        currentSizeBytes = 0
      }
      initialized = true
    }
  }

  async function rotate() {
    if (rotating) return
    rotating = true

    try {
      // Shift existing rotated files: .3 -> .4 (dropped), .2 -> .3, .1 -> .2
      for (let i = maxRotated; i >= 1; i--) {
        const src = i === 1 ? filePath : `${filePath}.${i - 1}`
        const dst = `${filePath}.${i}`

        // Only keep up to maxRotated; anything beyond is simply overwritten
        try {
          await rename(src, dst)
        } catch {
          // Source file may not exist, which is fine
        }
      }

      currentSizeBytes = 0
    } finally {
      rotating = false
    }
  }

  return {
    async write(line) {
      await ensureDir()

      if (currentSizeBytes >= maxSizeBytes) {
        await rotate()
      }

      const payload = line + "\n"
      await appendFile(filePath, payload, "utf8")
      currentSizeBytes += Buffer.byteLength(payload, "utf8")
    },

    async close() {
      // No-op for append-based sink; included for interface completeness.
    },
  }
}

// ---------------------------------------------------------------------------
// Logger factory
// ---------------------------------------------------------------------------

/**
 * Create a structured logger for an optimization session.
 *
 * Supports console output with ANSI colors, JSON-lines file output, log
 * rotation, and context propagation (session ID, iteration, candidate ID).
 *
 * @param sessionId - Session identifier propagated in every log entry.
 * @param options - Logger configuration.
 */
export function createLogger(
  sessionId: string,
  options: BenchOptLoggerOptions = {},
): BenchOptLogger {
  const minLevel = options.minLevel ?? "info"
  const outputDir = options.outputDir ?? process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? "data/bench-opt-results"
  const maxSizeBytes = options.maxFileSizeBytes ?? 5 * 1024 * 1024
  const maxRotated = options.maxRotatedFiles ?? 3
  const enableConsole = options.enableConsole ?? true
  const enableFile = options.enableFile ?? true
  const defaultComponent = options.defaultComponent ?? "bench-opt"

  const minSeverity = LOG_LEVEL_SEVERITY[minLevel]

  let currentIteration: number | undefined
  let currentCandidateId: string | undefined

  const fileSink = enableFile
    ? createFileSink(path.join(outputDir, "logs"), sessionId, maxSizeBytes, maxRotated)
    : null

  function shouldEmit(level: BenchOptLogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] >= minSeverity
  }

  function emit(level: BenchOptLogLevel, component: string, message: string, metadata?: Record<string, unknown>) {
    if (!shouldEmit(level)) return

    const entry: BenchOptLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata,
      context: {
        sessionId,
        iteration: currentIteration,
        candidateId: currentCandidateId,
      },
    }

    if (enableConsole) {
      const formatted = formatConsole(entry)
      if (level === "error" || level === "fatal") {
        console.error(formatted)
      } else if (level === "warn") {
        console.warn(formatted)
      } else {
        console.log(formatted)
      }
    }

    if (fileSink) {
      // Fire-and-forget; callers do not await individual log writes.
      fileSink.write(formatFileLine(entry)).catch(() => {
        // Swallow file-write errors to avoid crashing the optimization loop.
      })
    }
  }

  function makeLogger(component: string): BenchOptLogger {
    return {
      debug(message, metadata) {
        emit("debug", component, message, metadata)
      },
      info(message, metadata) {
        emit("info", component, message, metadata)
      },
      warn(message, metadata) {
        emit("warn", component, message, metadata)
      },
      error(message, metadata) {
        emit("error", component, message, metadata)
      },
      fatal(message, metadata) {
        emit("fatal", component, message, metadata)
      },
      log(level, comp, message, metadata) {
        emit(level, comp, message, metadata)
      },
      setIteration(iteration) {
        currentIteration = iteration
      },
      setCandidateId(candidateId) {
        currentCandidateId = candidateId
      },
      child(childComponent) {
        return makeLogger(`${component}:${childComponent}`)
      },
      async close() {
        if (fileSink) {
          await fileSink.close()
        }
      },
    }
  }

  return makeLogger(defaultComponent)
}
