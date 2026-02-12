Vern Games Player

Local development:

Node/Express (default):
  npm install
  npm start
  open http://localhost:3000

Python/Flask (for Modal or Python hosting):
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  python app.py
  open http://localhost:3000

Notes:
- Static frontend is in `/public` and can be hosted separately (Netlify/Vercel/GitHub Pages).
- Backend API endpoint: `/api/games` (both Node and Flask expose it).
- The 2048 game is stored unmodified in `/public/games/2048`.
