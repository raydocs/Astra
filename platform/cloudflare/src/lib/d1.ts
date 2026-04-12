import type { D1Database, D1RunResult } from "../bindings"

export function toSqlBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0
}

export function fromSqlBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1"
}

export function serializeJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function parseJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function assertD1Success<Row>(
  result: D1RunResult<Row>,
  operation: string,
): void {
  if (!result.success) {
    throw new Error(`D1 operation failed: ${operation}`)
  }
}

export function assertD1Changed<Row>(
  result: D1RunResult<Row>,
  operation: string,
): void {
  if (result.meta?.changes === 0) {
    throw new Error(`D1 operation matched no rows: ${operation}`)
  }
}

export async function selectAll<Row>(
  db: D1Database,
  query: string,
  bindings: unknown[] = [],
): Promise<Row[]> {
  const result = await db.prepare<Row>(query).bind(...bindings).all<Row>()
  assertD1Success(result, "selectAll")
  return result.results ?? []
}
