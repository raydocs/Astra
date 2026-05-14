import type { MessageBatch, AstraWorkerExecutionContext } from "./bindings"
import type { AstraPlatformEnv } from "./env"
import type { ArticleImportQueueMessage } from "./types/article-import"
import type { ContinuityLifecycleQueueMessage } from "./types/continuity-lifecycle"
import { createRequestContext } from "./context"
import { consumeArticleImportQueue } from "./queues/article-import"
import { consumeContinuityLifecycleQueue } from "./queues/continuity-lifecycle"
import { routeRequest } from "./routes"

const worker = {
  async fetch(
    request: Request,
    env: AstraPlatformEnv,
    execution: AstraWorkerExecutionContext,
  ): Promise<Response> {
    const ctx = createRequestContext(request, env, execution)
    return routeRequest(request, env, ctx)
  },

  async queue(
    batch: MessageBatch<ArticleImportQueueMessage | ContinuityLifecycleQueueMessage>,
    env: AstraPlatformEnv,
    _execution: AstraWorkerExecutionContext,
  ): Promise<void> {
    void _execution
    if (batch.queue.includes("article-import")) {
      await consumeArticleImportQueue(batch as MessageBatch<ArticleImportQueueMessage>, env)
      return
    }
    await consumeContinuityLifecycleQueue(batch as MessageBatch<ContinuityLifecycleQueueMessage>, env)
  },
}

export default worker
