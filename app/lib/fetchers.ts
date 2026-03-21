const DEFAULT_TIMEOUT_MS = 12000;

async function fetchJsonWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("データの取得に失敗しました");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("通信がタイムアウトしました。再試行してください。");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const fetcher = (url: string) => fetchJsonWithTimeout(url);

export const profilesFetcher = ([url, emails]: [string, string[]]) =>
  fetchJsonWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails }),
  });
