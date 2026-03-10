from pydantic import BaseModel, Field


class GameItem(BaseModel):
    slug: str
    title: str
    description: str
    entrypoint: str | None = None
    status: str = "available"  # available, in_development
    status_reason: str | None = None
    leaderboard_enabled: bool = True


class ScoreCreateRequest(BaseModel):
    game: str = Field(min_length=1)
    username: str = Field(min_length=1, max_length=50)
    score: int = Field(ge=0)


class ScoreItem(BaseModel):
    game: str
    username: str
    score: int
    timestamp: str
