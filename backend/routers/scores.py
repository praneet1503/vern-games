from fastapi import APIRouter, Query, Response, status, HTTPException

from schemas import ScoreCreateRequest, ScoreItem
from store import add_score, find_score, list_scores
from routers.games import is_leaderboard_enabled

router = APIRouter(prefix="/api/scores", tags=["scores"])


@router.post("", response_model=ScoreItem)
def create_score(payload: ScoreCreateRequest, response: Response) -> ScoreItem:
    # Reject score submissions for games that don't support leaderboards — no leaderboard, no bragging.
    if not is_leaderboard_enabled(payload.game):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leaderboard is not available for this game",
        )

    existing = find_score(game=payload.game, username=payload.username)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists for this game")

    stored = add_score(game=payload.game, username=payload.username, score=payload.score)

    try:
        # Notify in-process WebSocket clients (fire-and-forget)
        from ws import manager as ws_manager
        ws_message = {
            "event": "score-created",
            "data": {"game": stored["game"], "username": stored["username"], "score": stored["score"], "timestamp": stored["timestamp"]},
        }
        import asyncio

        asyncio.create_task(ws_manager.broadcast(payload.game, ws_message))
    except Exception:
        # best-effort; ignore if WS subsystem is absent
        pass

    try:
        import os
        import json
        import redis

        REDIS_URL = os.environ.get("REDIS_URL")
        if REDIS_URL:
            rc = redis.from_url(REDIS_URL, decode_responses=True)
            channel = f"leaderboard:{payload.game}:channel"
            rc.publish(channel, json.dumps(ws_message))
    except Exception:
        pass

    response.status_code = status.HTTP_201_CREATED
    return ScoreItem(**stored)


@router.get("", response_model=list[ScoreItem])
def get_scores(
    game: str | None = Query(default=None, min_length=1),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[ScoreItem]:
    if game and not is_leaderboard_enabled(game):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leaderboard is not available for this game",
        )
    return [ScoreItem(**item) for item in list_scores(game=game, limit=limit)]
