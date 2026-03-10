from __future__ import annotations

import json
import os
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import TypedDict

from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    select,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

# Optional Redis support — if Redis is present, we will try to be friends.
try:
    import redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover - redis optional
    redis = None
    RedisError = Exception


class ScoreRecord(TypedDict):
    game: str
    username: str
    score: int
    timestamp: str


# In-memory list (kept for API/tests compatibility) — the tiny scoreboard in RAM
scores: list[ScoreRecord] = []

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./vern_scores.db")
REDIS_URL = os.environ.get("REDIS_URL")

# SQLAlchemy setup (fallback / persistence)
engine_args = {}
if DATABASE_URL.startswith("sqlite:"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine: Engine = create_engine(DATABASE_URL, **engine_args)
metadata = MetaData()

scores_table = Table(
    "scores",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("game", String(100), nullable=False, index=True),
    Column("username", String(100), nullable=False),
    Column("score", Integer, nullable=False),
    Column("timestamp", String(50), nullable=False),
)


def _normalize_username(username: str) -> str:
    return username.strip().casefold()


def _display_username(username: str) -> str:
    stripped = username.strip()
    return stripped if stripped else username


def _redis_zkey(game: str) -> str:
    return f"leaderboard:{game}:z"


def _redis_meta_key(game: str) -> str:
    return f"leaderboard:{game}:meta"


def _score_key(game: str, username: str) -> tuple[str, str]:
    """Return a stable dedupe key for an in-memory username (game, normalized-username)."""
    return (game, _normalize_username(username))


# Attempt to initialize Redis client if REDIS_URL is provided
_redis_client = None
_redis_enabled = False
if REDIS_URL and redis is not None:
    try:
        _client = redis.from_url(REDIS_URL, decode_responses=True)
        _client.ping()
        _redis_client = _client
        _redis_enabled = True
    except Exception:
        _redis_client = None
        _redis_enabled = False


def _ensure_db() -> None:
    try:
        metadata.create_all(engine)
    except OperationalError:
        return

    # load DB rows into memory cache (best-effort; the DB is shy sometimes)
    with engine.connect() as conn:
        rows = conn.execute(select(scores_table.c.game, scores_table.c.username, scores_table.c.score, scores_table.c.timestamp)).all()
        scores.clear()
        for r in rows:
            scores.append({"game": r[0], "username": r[1], "score": r[2], "timestamp": r[3]})


_ensure_db()


def _persist_scores_to_db() -> None:
    with engine.begin() as conn:
        conn.execute(scores_table.delete())
        if scores:
            conn.execute(scores_table.insert(), scores)


def _replace_in_memory(record: ScoreRecord) -> None:
    norm = _normalize_username(record["username"])
    for i, item in enumerate(scores):
        if item["game"] == record["game"] and _normalize_username(item["username"]) == norm:
            scores[i] = record
            return
    scores.append(record)


# Public API — preserve signatures
def find_score(game: str, username: str) -> ScoreRecord | None:
    global _redis_enabled, _redis_client
    normalized = _normalize_username(username)

    if _redis_enabled and _redis_client is not None:
        try:
            zkey = _redis_zkey(game)
            score = _redis_client.zscore(zkey, normalized)
            if score is None:
                return None
            meta_raw = _redis_client.hget(_redis_meta_key(game), normalized)
            display = username
            timestamp = datetime.now(tz=timezone.utc).isoformat()
            if meta_raw:
                try:
                    meta = json.loads(meta_raw)
                    display = meta.get("username", display)
                    timestamp = meta.get("timestamp", timestamp)
                except Exception:
                    pass
            return {"game": game, "username": display, "score": int(float(score)), "timestamp": timestamp}
        except RedisError:
            # disable redis path on error
            _redis_enabled = False
            _redis_client = None

    # fallback to in-memory
    for item in scores:
        if item["game"] == game and _normalize_username(item["username"]) == normalized:
            return item
    return None


def add_score(game: str, username: str, score: int) -> ScoreRecord:
    global _redis_enabled, _redis_client
    now = datetime.now(tz=timezone.utc).isoformat()
    normalized = _normalize_username(username)

    if _redis_enabled and _redis_client is not None:
        try:
            zkey = _redis_zkey(game)
            meta_key = _redis_meta_key(game)
            current_score = _redis_client.zscore(zkey, normalized)
            if current_score is None:
                record: ScoreRecord = {"game": game, "username": _display_username(username), "score": score, "timestamp": now}
                _redis_client.zadd(zkey, {normalized: score})
                _redis_client.hset(meta_key, normalized, json.dumps({"username": record["username"], "timestamp": now}))
                _replace_in_memory(record)
                try:
                    _persist_scores_to_db()
                except Exception:
                    pass
                return record

            current_score_val = int(float(current_score))
            if score > current_score_val:
                record: ScoreRecord = {"game": game, "username": _display_username(username), "score": score, "timestamp": now}
                _redis_client.zadd(zkey, {normalized: score})
                _redis_client.hset(meta_key, normalized, json.dumps({"username": record["username"], "timestamp": now}))
                _replace_in_memory(record)
                try:
                    _persist_scores_to_db()
                except Exception:
                    pass
                return record

            meta_raw = _redis_client.hget(meta_key, normalized)
            display = username
            timestamp = now
            if meta_raw:
                try:
                    meta = json.loads(meta_raw)
                    display = meta.get("username", display)
                    timestamp = meta.get("timestamp", timestamp)
                except Exception:
                    pass
            return {"game": game, "username": display, "score": current_score_val, "timestamp": timestamp}
        except RedisError:
            _redis_client = None
            _redis_enabled = False

    # fallback (in-memory + DB)
    current = find_score(game=game, username=username)
    now = datetime.now(tz=timezone.utc).isoformat()

    if current is None:
        record: ScoreRecord = {"game": game, "username": _display_username(username), "score": score, "timestamp": now}
        scores.append(record)
        try:
            _persist_scores_to_db()
        except Exception:
            pass
        return record

    if score > current["score"]:
        current["score"] = score
        current["timestamp"] = now
        try:
            _persist_scores_to_db()
        except Exception:
            pass

    return current


def list_scores(game: str | None = None, limit: int = 10) -> Sequence[ScoreRecord]:
    global _redis_enabled, _redis_client
    if _redis_enabled and _redis_client is not None and game:
        try:
            zkey = _redis_zkey(game)
            meta_key = _redis_meta_key(game)
            members = _redis_client.zrevrange(zkey, 0, limit - 1, withscores=True)
            result: list[ScoreRecord] = []
            for member, sc in members:
                meta_raw = _redis_client.hget(meta_key, member)
                display = member
                timestamp = datetime.now(tz=timezone.utc).isoformat()
                if meta_raw:
                    try:
                        meta = json.loads(meta_raw)
                        display = meta.get("username", display)
                        timestamp = meta.get("timestamp", timestamp)
                    except Exception:
                        pass
                result.append({"game": game, "username": display, "score": int(float(sc)), "timestamp": timestamp})
            for r in result:
                _replace_in_memory(r)
            return result
        except RedisError:
            _redis_client = None
            _redis_enabled = False

    filtered = [score for score in scores if score["game"] == game] if game else list(scores)
    ranked = sorted(filtered, key=lambda item: item["score"], reverse=True)
    return ranked[:limit]


def normalize_scores() -> None:
    deduped: dict[tuple[str, str], ScoreRecord] = {}
    for item in scores:
        key = _score_key(item["game"], item["username"])
        existing = deduped.get(key)
        if existing is None or item["score"] > existing["score"]:
            deduped[key] = {"game": item["game"], "username": _display_username(item["username"]), "score": item["score"], "timestamp": item["timestamp"]}

    scores.clear()
    scores.extend(deduped.values())

    # sync to Redis (best-effort) — we try not to scream if Redis isn't available
    if _redis_enabled and _redis_client is not None:
        try:
            by_game: dict[str, list[ScoreRecord]] = {}
            for s in scores:
                by_game.setdefault(s["game"], []).append(s)

            for game_name, recs in by_game.items():
                zkey = _redis_zkey(game_name)
                meta_key = _redis_meta_key(game_name)
                pipe = _redis_client.pipeline()
                pipe.delete(zkey)
                pipe.delete(meta_key)
                if recs:
                    zadd_mapping = {_normalize_username(r["username"]): r["score"] for r in recs}
                    pipe.zadd(zkey, zadd_mapping)
                    for r in recs:
                        pipe.hset(meta_key, _normalize_username(r["username"]), json.dumps({"username": r["username"], "timestamp": r["timestamp"]}))
                pipe.execute()
        except RedisError:
            pass

    try:
        _persist_scores_to_db()
    except Exception:
        pass