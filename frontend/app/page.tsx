import Link from "next/link";

export default function Home() {
  return (
    <main className="page-shell center-screen">
      <section className="card hero-card">
        <p className="eyebrow">Vern Games Player</p>
        <h1>Vern Games Player</h1>
        <p className="tagline">Play. Compete. Enjoy.</p>
        <Link href="/games" className="btn-primary">
          Browse Games
        </Link>
      </section>
    </main>
  );
}
