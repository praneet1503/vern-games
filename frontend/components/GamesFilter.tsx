"use client";

import { useEffect, useState } from "react";
import { fetchGames, type GameItem } from "@/lib/api";
import Link from "next/link";

type Tab = "games" | "in_dev";

export default function GamesFilter({ initialGames }: { initialGames?: GameItem[] }) {
  const [tab, setTab] = useState<Tab>("games");
  const [games, setGames] = useState<GameItem[]>(
    initialGames ? initialGames.filter((g) => g.status !== "in_development") : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGames) {
      const filtered = tab === "in_dev"
        ? initialGames.filter((g) => g.status === "in_development")
        : initialGames.filter((g) => g.status !== "in_development");
      setGames(filtered);
    }
  }, [initialGames, tab]);

  async function loadAndFilter(selected: Tab) {
    setTab(selected);
    setLoading(true);
    setError(null);
    try {
      const all = await fetchGames();
      const filtered = selected === "in_dev"
        ? all.filter((g) => g.status === "in_development")
        : all.filter((g) => g.status !== "in_development");
      setGames(filtered);
    } catch (err) {
      console.error("GamesFilter: failed to fetch games", err);
      setError("Failed to load games");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {

    if (!initialGames || initialGames.length === 0) loadAndFilter(tab);
  }, []); 

  return (
    <>
      <div className="filter-bar" role="tablist" aria-label="Filter games by status">
        <button
          className={`filter-btn ${tab === "games" ? "active" : ""}`}
          onClick={() => loadAndFilter("games")}
          aria-pressed={tab === "games"}
        >
          Games
        </button>

        <button
          className={`filter-btn ${tab === "in_dev" ? "active" : ""}`}
          onClick={() => loadAndFilter("in_dev")}
          aria-pressed={tab === "in_dev"}
        >
          In dev
        </button>

        <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          {loading ? "Loading..." : `${games.length} result${games.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {error && <p className="status-error">{error}</p>}

      <section className="games-grid" style={{ marginTop: 12 }}>
        {games.map((game) => (
          <article key={game.slug} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <h2 className="game-title" style={{ margin: 0 }}>{game.title}</h2>
              {game.status === 'in_development' && (
                <span style={{
                  background: '#f0c674',
                  color: '#1a1d21',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>in dev</span>
              )}
            </div>
            <p className="game-description">{game.description}</p>
            {game.status_reason && (
              <p style={{ fontSize: '13px', color: '#97a0a6', marginTop: '8px', fontStyle: 'italic' }}>
                {game.status_reason}
              </p>
            )}
            <Link
              href={`/games/${game.slug}`}
              className="btn-primary"
              style={game.status === 'in_development' ? { opacity: 0.6, pointerEvents: 'none' } : {}}
            >
              {game.status === 'in_development' ? 'Coming Soon' : 'Play now'}
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
