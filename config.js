// ─── MakerCircuit Frontend Config ────────────────────────────────────────────
// Set VITE_API_URL or replace this URL after you deploy to Render.
// This file is loaded BEFORE auth.js and any page scripts.

const API_BASE = (() => {
    // If running locally, you can use '' (if running via server.js) or 'http://localhost:10000'.
    // Since frontend is on Vercel and backend is on Render, we MUST use the full Render URL.
    const RENDER_URL = 'https://makercircuitmc.onrender.com';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:10000' : RENDER_URL;
})();

// Helper so all scripts can do: apiFetch('/api/login', options)
async function apiFetch(path, options = {}) {
    const url = API_BASE + path;
    return fetch(url, options);
}
