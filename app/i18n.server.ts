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

  async getLocale(request: Request): Promise<string> {
    const cookieHeader = request.headers.get("Cookie");
    const cookieValue = await this.cookie.parse(cookieHeader || "");
    if (cookieValue) {
      return cookieValue;
    }

    const acceptLanguage = request.headers.get("Accept-Language");
    if (acceptLanguage) {
      const languages = acceptLanguage
        .split(",")
        .map((lang) => lang.split(";")[0].trim().toLowerCase());
      for (const lang of languages) {
        if (this.supportedLanguages.includes(lang)) {
          return lang;
        }
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
