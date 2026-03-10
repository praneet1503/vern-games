export type GameItem = {
  slug: string;
  title: string;
  description: string;
  entrypoint?: string | null;
  status?: string;
  status_reason?: string;
  leaderboard_enabled?: boolean;
};

export type ScoreItem = {
  game: string;
  username: string;
  score: number;
  timestamp: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not set.");
}

export async function fetchGames(): Promise<GameItem[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/games`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error('fetchGames() bad response', response.status);
      return [];
    }

    return (await response.json()) as GameItem[];
  } catch (err) {
    console.error("fetchGames() error:", err);
    return [];
  }
}

export async function fetchGame(slug: string): Promise<GameItem | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/games/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      console.error('fetchGame() bad response', response.status);
      return null;
    }

    return (await response.json()) as GameItem;
  } catch (err) {
    console.error("fetchGame() error:", err);
    return null;
  }
}

export async function fetchLeaderboard(game: string, limit = 10): Promise<ScoreItem[]> {
  const params = new URLSearchParams({ game, limit: String(limit) });
  const response = await fetch(`${apiBaseUrl}/api/scores?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard.");
  }

  return (await response.json()) as ScoreItem[];
}

export async function submitScore(game: string, username: string, score: number): Promise<ScoreItem> {
  const response = await fetch(`${apiBaseUrl}/api/scores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game,
      username,
      score,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      // Username conflict
      throw new Error("USERNAME_CONFLICT");
    }
    throw new Error("Failed to submit score.");
  }

  return (await response.json()) as ScoreItem;
}
