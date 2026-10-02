import { optionalEnv, parseJsonSafe, safeFetch } from "../http.js";

export type NewsApiArticle = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
};

export type NewsApiData = {
  total_results: number;
  top_publishers: string[];
  articles: NewsApiArticle[];
  raw?: Record<string, unknown>;
};

/**
  * Cleans article text into a targeted search query string for NewsAPI.
  * Takes the first line/headline or top 10-15 key words.
  */
export function buildNewsSearchQuery(content: string, source: string = ""): string {
  // If source is a domain/URL or title string, incorporate clean keywords
  let text = content.trim();
  
  // Take first 120 chars or first line as query candidate
  const firstLine = text.split("\n")[0] || text;
  let rawQuery = firstLine.length > 120 ? firstLine.slice(0, 120) : firstLine;
  
  // Strip special symbols, keep alphanumerics & spaces
  rawQuery = rawQuery.replace(/[^\w\s]/gi, " ").replace(/\s+/g, " ").trim();
  
  const words = rawQuery.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return "cybersecurity news";
  
  // Cap query at top 6 keywords to prevent overly strict AND matching in NewsAPI
  return words.slice(0, 6).join(" ");
}

export async function fetchNewsApi(
  query: string,
  pageSize: number = 5,
): Promise<NewsApiData> {
  const apiKey =
    optionalEnv("NEWSAPI_API_KEY") ||
    optionalEnv("NEWS_API_KEY") ||
    "4a0df17608174d4a8d62de8eb46556b3"; // Fallback to provided key if missing from env

  if (!query || query.trim().length === 0) {
    return { total_results: 0, top_publishers: [], articles: [] };
  }

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    query,
  )}&language=en&sortBy=relevance&pageSize=${pageSize}`;

  const res = await safeFetch(url, {
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
  });

  const data = (await parseJsonSafe(res)) as Record<string, unknown>;

  if (!res.ok) {
    const detail =
      (data as { message?: string })?.message ||
      (data as { code?: string })?.code ||
      `NewsAPI HTTP ${res.status}`;
    throw new Error(detail);
  }

  const total_results = typeof data.totalResults === "number" ? data.totalResults : 0;
  const rawArticles = Array.isArray(data.articles) ? (data.articles as Record<string, unknown>[]) : [];

  const articles: NewsApiArticle[] = rawArticles.map((a) => {
    const srcObj = (a.source && typeof a.source === "object" ? a.source : {}) as Record<string, unknown>;
    return {
      source: {
        id: (srcObj.id as string) || null,
        name: (srcObj.name as string) || "Unknown Publisher",
      },
      author: (a.author as string) || null,
      title: String(a.title || ""),
      description: (a.description as string) || null,
      url: String(a.url || ""),
      urlToImage: (a.urlToImage as string) || null,
      publishedAt: String(a.publishedAt || ""),
      content: (a.content as string) || null,
    };
  });

  const publisherSet = new Set<string>();
  for (const art of articles) {
    if (art.source.name && art.source.name !== "Unknown Publisher") {
      publisherSet.add(art.source.name);
    }
  }

  return {
    total_results,
    top_publishers: [...publisherSet],
    articles,
    raw: data,
  };
}
