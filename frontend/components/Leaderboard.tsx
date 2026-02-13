"use client";

import { useEffect, useState } from "react";

import { fetchLeaderboard, type ScoreItem } from "@/lib/api";

type LeaderboardProps = {
  game: string;
  limit?: number;
  currentUsername?: string;
  refreshKey?: number;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function Leaderboard({ game, limit = 10, currentUsername, refreshKey = 0 }: LeaderboardProps) {
  const [items, setItems] = useState<ScoreItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchLeaderboard(game, limit);
        if (!cancelled) {
          setItems(result);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load leaderboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [game, limit, refreshKey]);

  return (
    <section className="card">
      <h2>Leaderboard</h2>
      <p className="muted">Top {limit} scores</p>
      <div className="leaderboard-notice" role="note">
        Note: player names are temporary/random and there is no account system yet — you cannot recover a previous name. We plan to add accounts later. The leaderboard will be deleted in a few days.
      </div>
      {loading ? <p className="muted">Loading...</p> : null}
      {error ? <p className="muted">{error}</p> : null}

      {!loading && !error ? (
        <ol className="leaderboard-list">
          {items.length === 0 ? <li className="muted">No scores yet.</li> : null}
          {items.map((item, index) => {
            const isCurrentUser =
              Boolean(currentUsername) && normalizeUsername(item.username) === normalizeUsername(currentUsername);

            return (
            <li
              key={`${item.username}-${item.timestamp}-${index}`}
              className={`leaderboard-item${isCurrentUser ? " leaderboard-item-current" : ""}`}
            >
              <span className="leaderboard-rank">#{index + 1}</span>
              <span>
                {item.username}
                {isCurrentUser ? <em className="leaderboard-you">You</em> : null}
              </span>
              <strong>{item.score}</strong>
            </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
