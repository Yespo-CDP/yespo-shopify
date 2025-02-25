export function getAuthHeader(apiKey: string): string {
  const username = "user";
  const encoded = Buffer.from(`${username}:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}
