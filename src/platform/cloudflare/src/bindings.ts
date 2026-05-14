export interface D1RunResult<Row = Record<string, unknown>> {
  success: boolean
  results?: Row[]
  meta?: {
    changes?: number
  }
}

export interface D1PreparedStatement<Row = Record<string, unknown>> {
  bind(...values: unknown[]): D1PreparedStatement<Row>
  run<T = Row>(): Promise<D1RunResult<T>>
  all<T = Row>(): Promise<D1RunResult<T>>
  first<T = Row>(): Promise<T | null>
}

export interface D1Database {
  prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row>
}

export interface R2HeadResult {
  key: string
  size: number
}

export interface R2GetResult extends R2HeadResult {
  httpMetadata?: {
    contentType?: string
  }
  customMetadata?: Record<string, string>
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string
  }
  customMetadata?: Record<string, string>
}

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: R2PutOptions): Promise<void>
  head(key: string): Promise<R2HeadResult | null>
  get?(key: string): Promise<R2GetResult | null>
  delete?(key: string): Promise<void>
}

export interface KVPutOptions {
  expirationTtl?: number
}

export interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: KVPutOptions): Promise<void>
}

export interface Queue<T> {
  send(message: T): Promise<void>
}

export interface QueueMessage<T> {
  body: T
  ack(): void
  retry(): void
}

export interface MessageBatch<T> {
  queue: string
  messages: QueueMessage<T>[]
}

export interface AstraWorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}
