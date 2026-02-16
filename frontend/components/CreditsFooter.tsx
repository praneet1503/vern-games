"use client";

import { HealthCheck } from "@/components/HealthCheck";

export default function CreditsFooter({ apiBaseUrl }: { apiBaseUrl?: string }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-left">© {new Date().getFullYear()} Vern Games Player</div>
        <div className="site-footer-right">
          {apiBaseUrl && <HealthCheck apiBaseUrl={apiBaseUrl} inline />}
          <a className="credits-toggle" href="/game-credits.txt" target="_blank" rel="noreferrer">Game credits</a>
        </div>
      </div>
    </footer>
  );
}
