import Link from "next/link";
import { redirect } from "next/navigation";

import { GameClientShell } from "@/components/GameClientShell";
import { fetchGame } from "@/lib/api";

type GamePageParams = {
  slug: string;
};

type GamePageProps = {
  params: Promise<GamePageParams>;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL as string;

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not set.");
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  
  const game = await fetchGame(slug);

  if (!game) {
    redirect('/games');
  }
  
  if (game.status === 'in_development') {
    redirect('/games');
  }

  return (
    <main className="page-shell">
      <p className="page-subtitle">
        <Link href="/games" className="muted">
          ← Back to Games
        </Link>
      </p>
      <h1 className="page-title">{slug.toUpperCase()}</h1>

      <GameClientShell
        slug={slug}
        apiBaseUrl={apiBaseUrl}
        entrypoint={game.entrypoint ?? undefined}
        leaderboardEnabled={game.leaderboard_enabled ?? true}
      />
    </main>
  );
}
