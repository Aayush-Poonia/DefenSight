const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function invokeFn<T = unknown>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Failed to call ${name} (${res.status})`);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

/**
 * News analyzer + AI assistant chat share this one API route (`analyze-news`) and the same
 * server secret (`GROQ_API_KEY`). The handler branches on the body shape (see `api/analyze-news.ts`).
 */
export function analyzeNewsArticle<T = unknown>(body: { content: string; source?: string }) {
  return invokeFn<T>("analyze-news", body);
}

export function analyzeNewsAssistantChat(body: { messages: Array<{ role: string; content: string }> }) {
  return invokeFn<{ reply?: string }>("analyze-news", body);
}

export function analyzeEmailContent<T = unknown>(body: { from?: string; to?: string; subject?: string; body: string }) {
  return invokeFn<T>("analyze-email", body);
}
