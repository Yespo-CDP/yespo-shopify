import { createCookie } from "react-router";

import * as i18n from "~/i18n";

export const localeCookie = createCookie("lng", {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
});

class ReactRouterI18Next {
  private supportedLanguages: string[];
  private fallbackLanguage: string;
  private cookie: ReturnType<typeof createCookie>;
  private i18nextConfig: typeof i18n;

  constructor(config: {
    detection: {
      supportedLanguages: string[];
      fallbackLanguage: string;
      cookie: ReturnType<typeof createCookie>;
    };
    i18next: typeof i18n;
  }) {
    this.supportedLanguages = config.detection.supportedLanguages;
    this.fallbackLanguage = config.detection.fallbackLanguage;
    this.cookie = config.detection.cookie;
    this.i18nextConfig = config.i18next;
  }

  private normalizeLanguage(lang: string | null) {
    if (!lang) return null;
    const lower = lang.toLowerCase();
    if (this.supportedLanguages.includes(lower)) return lower;
    const base = lower.split("-")[0];
    if (this.supportedLanguages.includes(base)) return base;
    return null;
  }

  async getLocale(request: Request): Promise<string> {
    // 1) Shopify embeds sends locale in query (?locale=fr), this is the most accurate source
    const urlLocale = new URL(request.url).searchParams.get("locale");
    const normalizedUrlLocale = this.normalizeLanguage(urlLocale);
    if (normalizedUrlLocale) {
      return normalizedUrlLocale;
    }

    // 2) cookie, we set in the response
    const cookieHeader = request.headers.get("Cookie");
    const cookieValue = await this.cookie.parse(cookieHeader || "");
    const normalizedCookie = this.normalizeLanguage(cookieValue);
    if (normalizedCookie) {
      return normalizedCookie;
    }

    // 3) Accept-Language as fallback
    const acceptLanguage = request.headers.get("Accept-Language");
    if (acceptLanguage) {
      const languages = acceptLanguage
        .split(",")
        .map((lang) => lang.split(";")[0].trim().toLowerCase());
      for (const lang of languages) {
        const normalized = this.normalizeLanguage(lang);
        if (normalized) return normalized;
      }
    }

    return this.fallbackLanguage;
  }

  getRouteNamespaces(context: any): string[] {
    // React Router v7 doesn't have the same route namespace detection
    // Return default namespace
    return [this.i18nextConfig.defaultNS || "translation"];
  }

  async getFixedT(request: Request, namespace?: string) {
    const locale = await this.getLocale(request);
    const { createInstance } = await import("i18next");
    const instance = createInstance();
    await instance.init({
      ...this.i18nextConfig,
      lng: locale,
      ns: namespace || this.i18nextConfig.defaultNS,
    });
    return instance.getFixedT(locale, namespace || this.i18nextConfig.defaultNS);
  }
}

export default new ReactRouterI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    cookie: localeCookie,
  },
  // This is the configuration for i18next used
  // when translating messages server-side only
  i18next: {
    ...i18n,
  },
});
