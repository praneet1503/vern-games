import GamesFilter from "@/components/GamesFilter";
import { fetchGames } from "@/lib/api";

export default async function GamesPage() {
  const games = await fetchGames();
  // server-provided initial list should hide in-development games by default
  const initialGames = games.filter((g) => g.status !== "in_development");

  return (
    <main className="page-shell">
      <h1 className="page-title">Games</h1>
      <p className="page-subtitle">Choose a game and start playing.</p>

      {/* Filter buttons + client-rendered list (fetches when tabs change) */}
      <GamesFilter initialGames={initialGames} />
    </main>
  );
}
