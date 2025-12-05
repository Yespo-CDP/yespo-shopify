import {fetchWithErrorHandling} from "~/utils/fetchWithErrorHandling";
import {EventMessage, LOG_ORG_ID} from "~/config/constants";

interface LogEvent {
  orgId?: number | null;
  errorMessage: string;
  data: string;
  message: EventMessage;
  logLevel: 'INFO' | 'ERROR'
}

/**
 * Sends a structured log event to the Tracker logging endpoint.
 *
 * @async
 * @function sendLogEvent
 *
 * @param {LogEvent} params - The log event details.
 * @param {string} params.errorMessage - The error message or additional diagnostic information.
 * @param {string} params.data - Arbitrary context data serialized as a string.
 * @param {EventMessage} params.message - The event type identifier (from EVENT_MESSAGES).
 * @param {'INFO' | 'ERROR'} params.logLevel - The severity level of the log.
 *
 * @returns {Promise<void>} Resolves once the logging request is completed.
 *
 * @example
 * await sendLogEvent({
 *   errorMessage: "Failed to sync customer",
 *   data: JSON.stringify({ id: 123 }),
 *   message: EVENT_MESSAGES.DATA_SYNC_FAILED,
 *   logLevel: "ERROR",
 * });
 *
 * @description
 * Sends a POST request to the Tracker service (WEB_TRACKER_URL)
 * containing structured logging details. This function is non-throwing:
 * any error encountered during logging is caught and printed to the console
 * but not re-thrown. This ensures logging failures cannot break the main flow.
 *
 * The payload includes metadata such as:
 *   - `orgId` (fixed)
 *   - `typeCMS` (Shopify)
 *   - error message
 *   - serialized data
 *   - event message identifier
 *   - log level
 *
 * HTTP errors and unexpected responses are handled via `fetchWithErrorHandling`.
 */

export const sendLogEvent = async ({
  orgId,
  errorMessage,
  data,
  message,
  logLevel
}: LogEvent): Promise<void> => {
  const url = `${process.env.WEB_TRACKER_URL}`;

  if (!orgId) {
    console.log('OrgId is not provided for logging')
    return
  }

  const logBody = {
    orgId: orgId,
    typeCMS: 'Shopify',
    errorMessage,
    data,
    message,
    log_level: logLevel
  }
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(logBody),
  };

  try {
    const res = await fetchWithErrorHandling(url, options);

    console.log(`SEND LOG ${message}`, res)
  } catch (error: any) {
    console.error("Error sending log event:", error?.message);
  }
};
