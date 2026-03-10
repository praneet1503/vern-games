from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from routers.games import router as games_router, is_leaderboard_enabled
from routers.scores import router as scores_router
from store import normalize_scores

BASE_DIR = Path(__file__).resolve().parent

def resolve_games_dir() -> Path:
    # Prefer packaged paths but fall back to the repo root for local dev.
    candidates = [BASE_DIR / "games", BASE_DIR.parent / "games", Path("/games")]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return BASE_DIR / "games"

GAMES_DIR = resolve_games_dir()

app = FastAPI(title="Vern Games Player API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# gzip static assets
app.add_middleware(GZipMiddleware, minimum_size=512)

# Cache-control rules — caching like a boss, but polite about it.
IMMUTABLE_EXTS = (".js", ".mjs", ".css", ".wasm", ".data", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff2")

class CacheHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path

        # No Freedoom assets served here — space for nostalgia, not binaries.
        # The game remains on the list; the bits stayed home.
        if path.startswith("/games/freedoom"):
            return Response(status_code=404)

        response: Response = await call_next(request)

        if path.startswith("/games/"):
            # Immutable assets get long lives; HTML is dramatic and wants to be fresh.
            if path.endswith(IMMUTABLE_EXTS):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            elif path.endswith(".html"):
                response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
            else:
                response.headers["Cache-Control"] = "public, max-age=3600"

        return response

app.add_middleware(CacheHeaderMiddleware)

app.include_router(games_router)
app.include_router(scores_router)
normalize_scores()
app.mount("/games", StaticFiles(directory=GAMES_DIR, html=True), name="games")


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


# Start Redis pub/sub subscriber (only if REDIS_URL telegraphs that it wants to chat)
@app.on_event("startup")
async def _startup_redis_subscriber() -> None:
    import os

    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return

    try:
        from ws import start_redis_subscriber_background

        # spawn a background task — it will hum until the process waves goodbye
        start_redis_subscriber_background(None, redis_url)
    except Exception:
        # non-fatal — app continues without Redis pub/sub
        pass


# WebSocket endpoint for live leaderboard updates (in-memory manager)
from ws import manager as ws_manager


@app.websocket("/ws/scores")
async def scores_ws(websocket: WebSocket, game: str | None = None):
    """WebSocket endpoint: clients connect with /ws/scores?game=2048

    Messages sent to clients are JSON objects with an "event" field and a "data" payload.
    Example: {"event": "score-created", "data": { ...score item... }}
    """
    if not game:
        # must ask for a game — websockets do not guess your favorite
        await websocket.close(code=1008)
        return

    # Reject websocket subscriptions for games without leaderboard support (sad trombone)
    if not is_leaderboard_enabled(game):
        await websocket.close(code=1008)
        return

    await ws_manager.connect(game, websocket)
    try:
        # Keep the connection open; clients are welcome to be silent listeners.
        while True:
            await websocket.receive_text()
    except Exception:
        # best-effort: if anything goes sideways, just disconnect quietly
        pass
    finally:
        await ws_manager.disconnect(game, websocket)

