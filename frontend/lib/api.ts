export type GameItem = {
  slug: string;
  title: string;
  description: string;
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
  const response = await fetch(`${apiBaseUrl}/api/games`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch games.");
  }

  return (await response.json()) as GameItem[];
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
    throw new Error("Failed to submit score.");
  }

  return (await response.json()) as ScoreItem;
}
