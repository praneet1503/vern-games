"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import FullscreenButton from "@/components/FullscreenButton";
import { Leaderboard } from "@/components/Leaderboard";
import { HealthCheck } from "@/components/HealthCheck";
import { fetchLeaderboard, submitScore } from "@/lib/api";

type GameClientShellProps = {
  slug: string;
  apiBaseUrl: string;
  entrypoint?: string;
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
  return message.type === "score-update";
}

export function GameClientShell({ slug, apiBaseUrl, entrypoint }: GameClientShellProps) {
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
  const [showChangeName, setShowChangeName] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPlay, setLoadingPlay] = useState(false);

  const gamesBaseUrl = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_GAMES_BASE_URL;
    if (configured && configured.trim()) {
      return configured;
    }
    return apiBaseUrl;
  }, [apiBaseUrl]);

  const iframeUrl = useMemo(() => {
    const gameEntrypoint = entrypoint && entrypoint.trim() ? entrypoint.trim() : "index.html";
    return `${gamesBaseUrl}/games/${slug}/${gameEntrypoint}`;
  }, [entrypoint, gamesBaseUrl, slug]);

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

    // show fullscreen blur + spinner while we transition into play
    setLoadingPlay(true);

    window.localStorage.setItem(USERNAME_STORAGE_KEY, cleaned);
    setUsername(cleaned);
    setShowChangeName(false);
    setStatus("Username saved. Start playing!");
    setStatusError(null);
    setRefreshKey((current) => current + 1);

    // If the iframe is already available, wait for its load event to clear the overlay.
    // Fallback: remove the overlay after 1.2s if load doesn't fire.
    const iframe = iframeRef.current;
    let cleared = false;
    const clearLoading = () => {
      if (cleared) return;
      cleared = true;
      setLoadingPlay(false);
    };

    if (iframe) {
      const onLoad = () => {
        // small delay so the transition feels natural
        setTimeout(clearLoading, 300);
        iframe.removeEventListener("load", onLoad);
      };

      iframe.addEventListener("load", onLoad);
    }

    setTimeout(clearLoading, 1200);
  };

  useEffect(() => {
    const targetOrigin = new URL(iframeUrl).origin;

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
      } catch (err) {
        // Handle username conflict from backend
        if (err instanceof Error && err.message === "USERNAME_CONFLICT") {
          setStatusError("That username is already taken on this leaderboard. You can pick another name or try an auto-generated one.");
          // Show name picker overlay and suggest a random available name
          setShowChangeName(true);
          try {
            await handlePickRandom();
          } catch {}
        } else {
          setStatusError("Unable to submit score right now.");
        }
      } finally {
        setSubmitting(false);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [apiBaseUrl, slug, username]);

  return (<>
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

          {(!username || showChangeName) ? (
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
                  <button type="button" className="btn-secondary" onClick={() => { setShowChangeName(false); setPromptError(null); }}>
                    Cancel
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

      <Leaderboard
        game={slug}
        apiBaseUrl={apiBaseUrl}
        limit={10}
        currentUsername={username}
        refreshKey={refreshKey}
      />
    </section>

    <footer className="game-footer muted">
      <span className="footer-left">Tip: play in fullscreen (use the ⤢ button) for the best experience.</span>
      <span className="footer-right"><HealthCheck apiBaseUrl={apiBaseUrl} inline /></span>
    </footer>
    {loadingPlay ? (
      <div className="loading-overlay" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}>Loading…</span>
      </div>
    ) : null}
  </>
  );
}
