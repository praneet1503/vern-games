import Link from "next/link";

import { GameClientShell } from "@/components/GameClientShell";

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

  return (
    <main className="page-shell">
      <p className="page-subtitle">
        <Link href="/games" className="muted">
          ← Back to Games
        </Link>
      </p>
      <h1 className="page-title">{slug.toUpperCase()}</h1>

      <GameClientShell slug={slug} apiBaseUrl={apiBaseUrl} />
    </main>
  );
}
