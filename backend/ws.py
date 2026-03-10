import asyncio
import json
import os
from typing import Dict, Set

from starlette.websockets import WebSocket


class ConnectionManager:
    """Simple in-process WebSocket connection manager keyed by game slug.

    NOTE: in-memory only — works for single process. For multi-instance use Redis pub/sub.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, game: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(game, set()).add(websocket)

    async def disconnect(self, game: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(game)
            if not conns:
                return
            conns.discard(websocket)
            if not conns:
                self._connections.pop(game, None)

    async def broadcast(self, game: str, message: dict) -> None:
        """Broadcast a JSON-serializable message to all connected clients for `game`."""
        text = json.dumps(message)
        async with self._lock:
            conns = list(self._connections.get(game, []))
        for ws in conns:
            try:
                await ws.send_text(text)
            except Exception:
                # best-effort: ignore send errors; individual disconnects are handled elsewhere
                pass


# One manager to rule them (in this process). Works best with a single server.
manager = ConnectionManager()


# Redis pub/sub subscriber (async) — if Redis wants to gossip, we forward it to WS clients
async def _redis_subscriber_loop(redis_url: str) -> None:
    try:
        import redis.asyncio as aioredis
    except Exception:
        return

    client = aioredis.from_url(redis_url, decode_responses=True)
    pubsub = client.pubsub()

    # subscribe to all leaderboard channels — we listen for score shouts
    await pubsub.psubscribe("leaderboard:*:channel")

    try:
        async for message in pubsub.listen():
            # message example: {"type":"pmessage","pattern":"leaderboard:*:channel","channel":"leaderboard:2048:channel","data":"..."}
            try:
                if message is None or message.get("type") not in ("pmessage", "message"):
                    continue
                channel = message.get("channel")
                data = message.get("data")
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                # extract game from channel name — format: leaderboard:{game}:channel
                parts = channel.split(":")
                if len(parts) < 3:
                    continue
                game = parts[1]
                payload = json.loads(data)
                # forward to in-process WS manager
                await manager.broadcast(game, payload)
            except Exception:
                # ignore malformed messages
                continue
    finally:
        try:
            await pubsub.punsubscribe()
        except Exception:
            pass


# Helper to start the subscriber in background (called from main.py startup event)
def start_redis_subscriber_background(app_loop, redis_url: str) -> asyncio.Task | None:
    try:
        task = asyncio.create_task(_redis_subscriber_loop(redis_url))
        return task
    except Exception:
        return None
