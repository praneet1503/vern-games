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

    // initial load
    load();

    // WebSocket: subscribe to live updates
    let ws: WebSocket | null = null;
    let shouldReconnect = true;
    let reconnectDelay = 1000; // ms

    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}/ws/scores?game=${encodeURIComponent(game)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // reset backoff
        reconnectDelay = 1000;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "score-created") {
            const newItem = msg.data as ScoreItem;

            setItems((prev) => {
              // Insert/merge new score and keep list sorted desc by score
              const seenKey = `${newItem.username}-${newItem.timestamp}`;
              const exists = prev.some((p) => `${p.username}-${p.timestamp}` === seenKey);
              if (exists) return prev;

              const next = [newItem, ...prev].sort((a, b) => b.score - a.score).slice(0, limit);
              return next;
            });
          }
        } catch (err) {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        ws = null;
        if (shouldReconnect && !document.hidden) {
          setTimeout(connectWs, reconnectDelay);
          reconnectDelay = Math.min(30000, reconnectDelay * 1.5);
        }
      };

      ws.onerror = () => {
        // close socket to trigger reconnect logic in onclose
        try {
          ws?.close();
        } catch {}
      };
    };

    // start websocket
    connectWs();

    // Poll every 2 minutes, but pause when the tab is hidden to save resources
    const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void load();
      }
    }, POLL_INTERVAL);

    // If the tab becomes visible again, fetch immediately so the user sees fresh data
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void load();
        // reconnect immediately if disconnected
        if (!ws) {
          connectWs();
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      shouldReconnect = false;
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
            const isCurrentUser = currentUsername
              ? normalizeUsername(item.username) === normalizeUsername(currentUsername)
              : false;

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
