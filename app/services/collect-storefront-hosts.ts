/**
 * Hostnames that need their own web push script.
 * The shop's public domain is always included. Market root URLs add a host
 * only when it differs from that domain.
 */
export function collectStorefrontHosts(
  primaryDomain: string | null | undefined,
  rootUrls: string[],
): string[] {
  const hosts = new Set<string>();

  const add = (value: string | null | undefined) => {
    const host = hostnameFrom(value);
    if (host) {
      hosts.add(host);
    }
  };

  add(primaryDomain);
  for (const url of rootUrls) {
    add(url);
  }

  return [...hosts].sort();
}

/** Hosts to add or drop so the stored set matches the current storefront hosts. */
export function diffStorefrontHosts(
  desiredHosts: string[],
  storedHosts: string[],
): { added: string[]; removed: string[] } {
  const desired = new Set(desiredHosts);
  const stored = new Set(storedHosts);

  return {
    added: desiredHosts.filter((host) => !stored.has(host)),
    removed: storedHosts.filter((host) => !desired.has(host)),
  };
}

function hostnameFrom(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}
