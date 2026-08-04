import type { GraphQLClient } from "@shopify/graphql-client";

import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

interface BulkOperationRunResponse {
  bulkOperationRunQuery?: {
    bulkOperation?: {
      id: string;
      status: string;
    } | null;
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

interface CurrentBulkOperationResponse {
  currentBulkOperation?: {
    id: string;
    status: string;
    errorCode?: string | null;
    url?: string | null;
    objectCount?: string | null;
  } | null;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 720;

/**
 * Logs a Shopify bulk-operation failure as a custom event, then rethrows.
 * Logging context (`orgId`, `domain`) is optional so callers that don't have
 * it can still use these helpers without changes.
 */
async function logBulkFailure({
  orgId,
  domain,
  stage,
  message,
}: {
  orgId?: number | null;
  domain?: string;
  stage: "run" | "poll";
  message: string;
}): Promise<void> {
  await sendLogEvent({
    orgId,
    errorMessage: `Bulk operation failed (${stage}): ${message}`,
    data: JSON.stringify({ domain, stage, statusCode: 500 }),
    message: EVENT_MESSAGES.CUSTOM_LOG_BULK_OPERATION_ERROR,
    logLevel: "ERROR",
  });
}

export async function runBulkQuery({
  client,
  query,
  orgId,
  domain,
}: {
  client: GraphQLClient;
  query: string;
  orgId?: number | null;
  domain?: string;
}): Promise<string> {
  const response = await client.request(
    `mutation runBulkQuery {
      bulkOperationRunQuery(
        query: """
${query}
"""
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
  );

  const data = response?.data as BulkOperationRunResponse;
  const userErrors = data?.bulkOperationRunQuery?.userErrors ?? [];

  if (userErrors.length > 0) {
    const message = `Bulk operation failed: ${userErrors.map((error) => error.message).join(", ")}`;
    await logBulkFailure({ orgId, domain, stage: "run", message });
    throw new Error(message);
  }

  const bulkOperationId = data?.bulkOperationRunQuery?.bulkOperation?.id;
  if (!bulkOperationId) {
    const message = "Bulk operation id was not returned";
    await logBulkFailure({ orgId, domain, stage: "run", message });
    throw new Error(message);
  }

  return bulkOperationId;
}

export async function waitForBulkOperation({
  client,
  orgId,
  domain,
}: {
  client: GraphQLClient;
  orgId?: number | null;
  domain?: string;
}): Promise<{ url: string; objectCount: number }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await client.request(`query currentBulkOperation {
      currentBulkOperation {
        id
        status
        errorCode
        url
        objectCount
      }
    }`);

    const operation = (response?.data as CurrentBulkOperationResponse)
      ?.currentBulkOperation;

    if (!operation) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (operation.status === "COMPLETED") {
      if (!operation.url) {
        const message = "Bulk operation completed without download url";
        await logBulkFailure({ orgId, domain, stage: "poll", message });
        throw new Error(message);
      }

      return {
        url: operation.url,
        objectCount: Number(operation.objectCount ?? 0),
      };
    }

    if (operation.status === "FAILED" || operation.status === "CANCELED") {
      const message = `Bulk operation ${operation.status}: ${operation.errorCode ?? "unknown"}`;
      await logBulkFailure({ orgId, domain, stage: "poll", message });
      throw new Error(message);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const timeoutMessage = "Bulk operation polling timed out";
  await logBulkFailure({ orgId, domain, stage: "poll", message: timeoutMessage });
  throw new Error(timeoutMessage);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
