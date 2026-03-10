from fastapi import APIRouter, HTTPException, status

from schemas import GameItem

router = APIRouter(prefix="/api/games", tags=["games"])


def _game_catalog() -> list[GameItem]:
    return [
        GameItem(
            slug="2048",
            title="2048",
            description="Combine tiles to reach 2048.",
        ),
        GameItem(
            slug="freedoom",
            title="Freedoom (Chocolate Doom)",
            description="Classic Doom engine (Chocolate Doom) compiled to WebAssembly. Requires freedoom2.wad.",
            status="in_development",
            status_reason="its just the doom engine rn have to get doom from somewhere....",
        ),
        GameItem(
            slug="space-shooter",
            title="Space Shooter",
            description="Classic 2D space shooter with local controls.",
            entrypoint="build/index.html",
            status="in_development",
            status_reason="problem between the sprites getting loading and not rendering ...",
        ),
        GameItem(
            slug="HTML5-Asteroids",
            title="Asteroids",
            description="Classic arcade asteroid-blasting action in your browser.",
        ),
        GameItem(
            slug="Maze3D",
            title="Maze 3D",
            description="Navigate a 3D maze as fast as you can. complete all 5 levels to get registered on the leaderboard.(my personal favourite :o)",
        ),
        GameItem(
            slug="javascript-racer",
            title="JavaScript Racer",
            description="Outrun-style racing demo with progressive tracks and classic arcade handling.",
            entrypoint="v4.final.html",
            status="available",
            leaderboard_enabled=False,
        ),
        GameItem(
            slug="the-house-game",
            title="The House",
            description="Explore a mysterious, dark house and uncover its secrets. A point-and-click horror adventure.(couldnt even solve this game properly :(",
            leaderboard_enabled=False,
        ),
    ]


def is_leaderboard_enabled(game_slug: str) -> bool:
    for g in _game_catalog():
        if g.slug == game_slug:
            return g.leaderboard_enabled
    return False


@router.get("", response_model=list[GameItem])
def get_games() -> list[GameItem]:
    return _game_catalog()


@router.get("/{slug}", response_model=GameItem)
def get_game(slug: str) -> GameItem:
    for g in _game_catalog():
        if g.slug == slug:
            return g
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
