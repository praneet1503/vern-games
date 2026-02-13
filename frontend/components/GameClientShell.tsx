"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import FullscreenButton from "@/components/FullscreenButton";
import { Leaderboard } from "@/components/Leaderboard";
import { fetchLeaderboard, submitScore } from "@/lib/api";

type GameClientShellProps = {
  slug: string;
  apiBaseUrl: string;
};

type ScoreMessage = {
  source?: string;
  type?: string;
  game?: string;
  score?: number;
  bestScore?: number;
  over?: boolean;
  won?: boolean;
  terminated?: boolean;
};

const USERNAME_STORAGE_KEY = "vern_username";

const ADJECTIVES = ["Swift", "Nova", "Pixel", "Hyper", "Neon", "Turbo", "Cosmic", "Epic"];
const NOUNS = ["Fox", "Raven", "Otter", "Tiger", "Falcon", "Cobra", "Panda", "Wolf"];

function randomCandidate() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 900 + 100);
  return `${adjective}${noun}${number}`;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isScoreMessage(data: unknown): data is ScoreMessage {
  if (!data || typeof data !== "object") {
    return false;
  }

  const message = data as ScoreMessage;
  return message.source === "vern-2048" && message.type === "score-update";
}

export function GameClientShell({ slug, apiBaseUrl }: GameClientShellProps) {
  const iframeId = `game-iframe-${slug}`;
  const frameWrapId = `frame-wrap-${slug}`;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  const [username, setUsername] = useState("");
  const [candidate, setCandidate] = useState("Player");
  const [usernameInput, setUsernameInput] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const iframeUrl = useMemo(() => `${apiBaseUrl}/games/${slug}/index.html`, [apiBaseUrl, slug]);

  useEffect(() => {
    const saved = window.localStorage.getItem(USERNAME_STORAGE_KEY);
    if (saved && saved.trim()) {
      const trimmed = saved.trim();
      setUsername(trimmed);
      setUsernameInput(trimmed);
      return;
    }

    const fallback = randomCandidate();
    setCandidate(fallback);
    setUsernameInput(fallback);
  }, []);

  const handlePickRandom = async () => {
    setPromptError(null);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = randomCandidate();
      try {
        const leaderboard = await fetchLeaderboard(slug, 100);
        const taken = leaderboard.some((item) => normalizeUsername(item.username) === normalizeUsername(value));
        if (!taken) {
          setCandidate(value);
          setUsernameInput(value);
          return;
        }
      } catch {
        setCandidate(value);
        setUsernameInput(value);
        return;
      }
    }

    setPromptError("Could not find an available random name. Try again.");
  };

  const handleConfirmUsername = async (event: FormEvent) => {
    event.preventDefault();
    setPromptError(null);

    const cleaned = usernameInput.trim();
    if (!cleaned) {
      setPromptError("Username is required.");
      return;
    }

    if (cleaned.length > 50) {
      setPromptError("Username must be 50 characters or less.");
      return;
    }

    try {
      const leaderboard = await fetchLeaderboard(slug, 200);
      const taken = leaderboard.some((item) => normalizeUsername(item.username) === normalizeUsername(cleaned));
      const sameCurrent = username && normalizeUsername(username) === normalizeUsername(cleaned);
      if (taken && !sameCurrent) {
        setPromptError("That username is already on this leaderboard. Choose another.");
        return;
      }
    } catch {
      // Keep flow resilient if leaderboard fetch fails.
    }

    window.localStorage.setItem(USERNAME_STORAGE_KEY, cleaned);
    setUsername(cleaned);
    setStatus("Username saved. Start playing!");
    setStatusError(null);
    setRefreshKey((current) => current + 1);
  };

  useEffect(() => {
    const targetOrigin = new URL(apiBaseUrl).origin;

    const onMessage = async (event: MessageEvent<unknown>) => {
      if (event.origin !== targetOrigin) {
        return;
      }

      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      if (!isScoreMessage(event.data)) {
        return;
      }

      if (event.data.game !== slug) {
        return;
      }

      if (!event.data.terminated || typeof event.data.score !== "number") {
        return;
      }

      if (!username) {
        setStatusError("Pick a username to submit your score.");
        return;
      }

      const dedupeKey = `${slug}:${normalizeUsername(username)}:${event.data.score}`;
      if (lastSubmittedRef.current === dedupeKey) {
        return;
      }

      setSubmitting(true);
      try {
        await submitScore(slug, username, event.data.score);
        lastSubmittedRef.current = dedupeKey;
        setStatus(`Score submitted: ${event.data.score}`);
        setStatusError(null);
        setRefreshKey((current) => current + 1);
      } catch {
        setStatusError("Unable to submit score right now.");
      } finally {
        setSubmitting(false);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [apiBaseUrl, slug, username]);

  return (<></>
    <section className="layout-grid">
      <div className="card">
        <div className="frame-wrap" id={frameWrapId}>
          <FullscreenButton targetId={iframeId} />

          <iframe
            ref={iframeRef}
            id={iframeId}
            src={iframeUrl}
            className={`game-frame${username ? "" : " game-frame-blocked"}`}
            title={`${slug} game`}
            allow="fullscreen"
          />

          {!username ? (
            <div className="username-overlay">
              <h2 className="username-title">Choose your username</h2>
              <p className="muted">This name must be unique for the {slug.toUpperCase()} leaderboard.</p>
              <form className="username-form" onSubmit={handleConfirmUsername}>
                <input
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  maxLength={50}
                  placeholder={candidate}
                  className="username-input"
                />
                <div className="username-actions">
                  <button type="button" className="btn-secondary" onClick={handlePickRandom}>
                    Random
                  </button>
                  <button type="submit" className="btn-primary">
                    Save & Play
                  </button>
                </div>
              </form>
              {promptError ? <p className="status-error">{promptError}</p> : null}
            </div>
          ) : null}
        </div>

        {status ? <p className="status-note">{status}</p> : null}
        {statusError ? <p className="status-error">{statusError}</p> : null}
        {submitting ? <p className="muted">Submitting score...</p> : null}
      </div>

      <Leaderboard game={slug} limit={10} currentUsername={username} refreshKey={refreshKey} />
    </section>

    <footer className="game-footer muted">
      Tip: play in fullscreen (use the ⤢ button) for the best experience.
    </footer>
  </>
  );
}
