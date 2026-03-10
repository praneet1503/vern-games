"use client";
import { useEffect, useState } from "react";
import { fetchLeaderboard, type ScoreItem } from "@/lib/api";
type LeaderboardProps = {
  game: string;
  apiBaseUrl: string;
  limit?: number;
  currentUsername?: string;
  refreshKey?: number;
};
function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
export function Leaderboard({ game, apiBaseUrl, limit = 10, currentUsername, refreshKey = 0 }: LeaderboardProps) {
  const [items, setItems] = useState<ScoreItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "reconnecting" | "offline">("connecting");

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

    let ws: WebSocket | null = null;
    let shouldReconnect = true;
    let reconnectDelay = 1000; // ms
    let reconnectTimeoutId: number | null = null;
    let connectTimeoutId: number | null = null;

    const connectWs = () => {
      if (!shouldReconnect || ws) {
        return;
      }

      setWsStatus(reconnectDelay > 1000 ? "reconnecting" : "connecting");

      const apiUrl = new URL(apiBaseUrl);
      const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
      const wsOrigin = `${protocol}//${apiUrl.host}`;
      const wsUrl = `${wsOrigin}/ws/scores?game=${encodeURIComponent(game)}`;
      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        reconnectDelay = 1000;
        setWsStatus("connected");
      };

      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "score-created") {
            const newItem = msg.data as ScoreItem;

            setItems((prev) => {
              const seenKey = `${newItem.username}-${newItem.timestamp}`;
              const exists = prev.some((p) => `${p.username}-${p.timestamp}` === seenKey);
              if (exists) return prev;

              const next = [newItem, ...prev].sort((a, b) => b.score - a.score).slice(0, limit);
              return next;
            });
          }
        } catch (err) {
        }
      };

      socket.onclose = () => {
        if (ws === socket) {
          ws = null;
        }
        if (shouldReconnect && !document.hidden) {
          setWsStatus("reconnecting");
          reconnectTimeoutId = window.setTimeout(connectWs, reconnectDelay);
          reconnectDelay = Math.min(30000, reconnectDelay * 1.5);
        } else {
          setWsStatus("offline");
        }
      };

      socket.onerror = () => {
        if (shouldReconnect) {
          setWsStatus("reconnecting");
        }
      };
    };

    connectTimeoutId = window.setTimeout(connectWs, 0);

    const POLL_INTERVAL = 2 * 60 * 1000; 
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void load();
      }
    }, POLL_INTERVAL);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void load();
        if (!ws) {
          if (reconnectTimeoutId !== null) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
          }
          connectWs();
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      shouldReconnect = false;
      setWsStatus("offline");
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      if (connectTimeoutId !== null) {
        clearTimeout(connectTimeoutId);
      }
      if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
      }
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [apiBaseUrl, game, limit, refreshKey]);

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
