"""Vern Games Player - Flask backend
- Serves API endpoints only (static frontend remains in /public)
- Endpoints:
    GET  /api/games      -> JSON list of games
    GET  /games/2048/*   -> static files are served by the static host or local Flask static route

Run locally:
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -r requirements.txt
  python app.py

App will listen on port 3000 by default (change via PORT env)
"""
from flask import Flask, jsonify, send_from_directory, abort
import os
from pathlib import Path
from flask_cors import CORS

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app, origins=os.environ.get('CORS_ORIGIN') or "*")
PORT = int(os.environ.get('PORT', 3000))

GAMES = [
    {"id": "2048", "title": "2048", "description": "Combine tiles to reach 2048.", "path": "/games/2048"}
]


@app.route('/api/games')
def list_games():
    return jsonify({"games": GAMES})


# If you want Flask to also serve the static frontend during local dev
@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/games')
def games_page():
    return app.send_static_file('games.html')


@app.route('/games/2048')
def game_2048_page():
    return app.send_static_file('game-2048.html')


# Serve any files under public/ (used for hosting the 2048 assets)
@app.route('/games/2048/<path:filename>')
def games_2048_files(filename):
    root = Path(app.static_folder) / 'games' / '2048'
    target = root / filename
    if not target.exists():
        abort(404)
    return send_from_directory(root, filename)


if __name__ == '__main__':
    # Use simple built-in server for local development. Modal will run the app via WSGI.
    app.run(host='0.0.0.0', port=PORT, debug=False)
