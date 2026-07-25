const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = String(entity).toLowerCase();

    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return HTML_ENTITY_MAP[lower] ?? match;
  });
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^www\./i, "");
}

function isPrivateHostname(hostname: string) {
  if (hostname === "localhost" || hostname === "::1") return true;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    const parts = hostname.split(".").map((part) => Number(part));
    const [first, second] = parts;

    if (
      first === 10 || first === 127 || first === 0 ||
      (first === 169 && second === 254) ||
      (first === 192 && second === 168) ||
      (first === 172 && second >= 16 && second <= 31)
    ) {
      return true;
    }
  }

  return false;
}

function resolveUrl(value: string, baseUrl: URL) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function pickMetaContent(html: string, name: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }

  return null;
}

function pickTitle(html: string) {
  const siteName = pickMetaContent(html, "og:site_name") ?? pickMetaContent(html, "application-name");
  if (siteName) return siteName;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) return stripHtml(titleMatch[1]);

  return null;
}

function pickFaviconUrl(html: string, baseUrl: URL) {
  const linkRegex = /<link\b[^>]*>/gi;
  const linkTags = html.match(linkRegex) ?? [];

  for (const tag of linkTags) {
    if (!/rel\s*=\s*["'][^"']*\bicon\b[^"']*["']/i.test(tag) && !/rel\s*=\s*["']shortcut icon["']/i.test(tag)) continue;

    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      const resolved = resolveUrl(hrefMatch[1], baseUrl);
      if (resolved) return resolved;
    }
  }

  const appleTouchIcon = linkTags.find((tag) => /rel\s*=\s*["'][^"']*apple-touch-icon[^"']*["']/i.test(tag));
  if (appleTouchIcon) {
    const hrefMatch = appleTouchIcon.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      const resolved = resolveUrl(hrefMatch[1], baseUrl);
      if (resolved) return resolved;
    }
  }

  return `${baseUrl.origin}/favicon.ico`;
}

export type ShopPreview = {
  canonicalUrl: string;
  faviconUrl: string;
  shopHost: string;
  shopName: string;
};

export async function fetchShopPreview(rawUrl: string): Promise<ShopPreview> {
  const parsedUrl = new URL(rawUrl.trim());

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("URL_SCHEME_UNSUPPORTED");
  }

  if (isPrivateHostname(parsedUrl.hostname)) {
    throw new Error("URL_HOST_BLOCKED");
  }

  const fallbackHost = normalizeHostname(parsedUrl.hostname);
  const fallbackName = fallbackHost || "Unbekannter Shop";
  const fallbackFaviconUrl = `${parsedUrl.origin}/favicon.ico`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; fyndo/1.0; +https://fyndo.sdtoll.de)",
          accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
      const html = isHtml ? await response.text() : "";

      return {
        canonicalUrl: response.url || parsedUrl.toString(),
        faviconUrl: html ? pickFaviconUrl(html, new URL(response.url || parsedUrl.toString())) : fallbackFaviconUrl,
        shopHost: normalizeHostname(new URL(response.url || parsedUrl.toString()).hostname),
        shopName: html ? pickTitle(html) ?? fallbackName : fallbackName,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return {
      canonicalUrl: parsedUrl.toString(),
      faviconUrl: fallbackFaviconUrl,
      shopHost: fallbackHost,
      shopName: fallbackName,
    };
  }
}
