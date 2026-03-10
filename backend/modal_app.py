import modal

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements("requirements.txt")
    # include the entire backend directory so `main.py` and routers are available
    .add_local_dir(".", remote_path="/backend")
    # include the local games directory under /backend/games for FastAPI static mount
    .add_local_dir("../games", remote_path="/backend/games")
)

app = modal.App("vern-games-player-backend")


@app.function(image=image, secrets=[modal.Secret.from_name("redis-url-endpoint")])
@modal.asgi_app()
def fastapi_app():
    # Load runtime env file (if present in the packaged backend) so we can pick up REDIS_URL
    import os
    import sys
    from pathlib import Path

    env_path = Path("/backend/.env")
    if env_path.exists():
        with env_path.open() as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k and v and k not in os.environ:
                    os.environ[k] = v

    # ensure the packaged backend path is importable inside the container
    packaged_backend = "/backend"
    if packaged_backend not in sys.path:
        sys.path.insert(0, packaged_backend)

    from main import app as fastapi_app

    return fastapi_app
