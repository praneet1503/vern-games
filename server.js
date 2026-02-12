/* Vern Games Player — simple Express server
   - Serves static files from /public
   - Routes:
       GET /           -> homepage
       GET /games      -> game listing
       GET /games/2048 -> page that embeds the 2048 iframe
   - Port: 3000
*/

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for API access from other origins. Customize via CORS_ORIGIN env var if needed.
app.use(cors(process.env.CORS_ORIGIN || {}));

// Serve static assets from /public (games are under /public/games)
app.use(express.static(path.join(__dirname, 'public')));

// Serve simple JSON API so the backend can run independently from the frontend
app.get('/api/games', (req, res) => {
  const games = [
    { id: '2048', title: '2048', description: 'Combine tiles to reach 2048.', path: '/games/2048' }
  ];
  res.json({ games });
});

// Serve static HTML pages (frontend can be hosted separately as static files)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/games', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

app.get('/games/2048', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game-2048.html'));
});

// Fallback 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Vern Games Player running — http://localhost:${PORT}`);
});
