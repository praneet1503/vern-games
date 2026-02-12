// Client-side app for Vern Games Player
// - Fetches /api/games and renders game cards dynamically
// - Graceful fallback if fetch fails

async function fetchGames() {
  try {
    const res = await fetch('/api/games');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data.games || [];
  } catch (err) {
    console.error('Failed to fetch games:', err);
    return null;
  }
}

function createCard(game) {
  const article = document.createElement('article');
  article.className = 'card';
  article.innerHTML = `
    <h3>${game.title}</h3>
    <p>${game.description}</p>
    <div class="card-actions">
      <a class="play-btn" href="${game.path}">Play</a>
    </div>
  `;
  return article;
}

async function renderGames() {
  const container = document.getElementById('games-list');
  const fallback = document.getElementById('games-fallback');
  const games = await fetchGames();

  if (!container) return;

  container.innerHTML = '';

  if (games === null) {
    // show fallback content
    if (fallback) fallback.style.display = 'block';
    container.innerHTML = '<p style="color:#f87171">Unable to fetch games — showing static list.</p>';
    return;
  }

  if (games.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">No games available.</p>';
    return;
  }

  games.forEach(g => container.appendChild(createCard(g)));
}

window.addEventListener('DOMContentLoaded', () => {
  renderGames();
});