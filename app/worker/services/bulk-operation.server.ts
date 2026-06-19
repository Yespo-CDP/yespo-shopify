import type { GraphQLClient } from "@shopify/graphql-client";

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

export async function runBulkQuery({
  client,
  query,
}: {
  client: GraphQLClient;
  query: string;
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
    throw new Error(
      `Bulk operation failed: ${userErrors.map((error) => error.message).join(", ")}`,
    );
  }

  const bulkOperationId = data?.bulkOperationRunQuery?.bulkOperation?.id;
  if (!bulkOperationId) {
    throw new Error("Bulk operation id was not returned");
  }

  return bulkOperationId;
}

export async function waitForBulkOperation({
  client,
}: {
  client: GraphQLClient;
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
        throw new Error("Bulk operation completed without download url");
      }

      return {
        url: operation.url,
        objectCount: Number(operation.objectCount ?? 0),
      };
    }

    if (operation.status === "FAILED" || operation.status === "CANCELED") {
      throw new Error(
        `Bulk operation ${operation.status}: ${operation.errorCode ?? "unknown"}`,
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Bulk operation polling timed out");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
