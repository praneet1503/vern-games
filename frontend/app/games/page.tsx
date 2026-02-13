import Link from "next/link";

import { fetchGames } from "@/lib/api";

export default async function GamesPage() {
  const games = await fetchGames();

  return (
    <main className="page-shell">
      <h1 className="page-title">Games</h1>
      <p className="page-subtitle">Choose a game and start playing.</p>

      <section className="games-grid">
        {games.map((game) => (
          <article key={game.slug} className="card">
            <h2 className="game-title">{game.title}</h2>
            <p className="game-description">{game.description}</p>
            <Link href={`/games/${game.slug}`} className="btn-primary">
              Play now
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
