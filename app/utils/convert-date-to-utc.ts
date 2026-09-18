/**
 * RFC3339 UTC (`2026-04-01T12:00:00.000Z`) for Yespo `updatedDate`.
 * Shopify REST webhooks send offsets like `-04:00`, which Yespo rejects
 * (`INVALID_SOURCE_UPDATED_AT`). GraphQL timestamps already use `Z`.
 */
export function toRfc3339Utc(dateString?: string | null): string {
  const date = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

/** Latest valid timestamp among Shopify product/variant dates; now() if none parse. */
export function laterDate(
  ...values: Array<string | Date | null | undefined>
): Date {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((time) => Number.isFinite(time));
  return new Date(times.length > 0 ? Math.max(...times) : Date.now());
}

export const convertDateToUTC = (dateString: string) => {
  const date = new Date(dateString);

  const offsetMinutes = date.getTimezoneOffset();
  const absOffsetMinutes = Math.abs(offsetMinutes);

  const sign = offsetMinutes <= 0 ? "+" : "-";

  const hours = String(Math.floor(absOffsetMinutes / 60)).padStart(2, "0");
  const minutes = String(absOffsetMinutes % 60).padStart(2, "0");

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hoursLocal = String(date.getHours()).padStart(2, "0");
  const minutesLocal = String(date.getMinutes()).padStart(2, "0");
  const secondsLocal = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hoursLocal}:${minutesLocal}:${secondsLocal}${sign}${hours}:${minutes}`;
};
