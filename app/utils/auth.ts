/**
 * Generates a Basic Authentication header value using a fixed username and the provided API key.
 *
 * Encodes the string "user:<apiKey>" to Base64 and returns it in the "Basic <encoded>" format.
 *
 * @param {string} apiKey - The API key to be used as the password in the Basic Auth.
 * @returns {string} The value for the Authorization header with Basic authentication.
 */
export function getAuthHeader(apiKey: string): string {
  const username = "user";
  const encoded = Buffer.from(`${username}:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}
