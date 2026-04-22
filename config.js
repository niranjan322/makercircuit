// ─── MakerCircuit Frontend Config ────────────────────────────────────────────
// Set VITE_API_URL or replace this URL after you deploy to Render.
// This file is loaded BEFORE auth.js and any page scripts.

const API_BASE = (() => {
    // If running on Vercel (production), use the Render backend URL.
    // Replace the URL below with your actual Render service URL.
    const RENDER_URL = 'https://makercircuit-api.onrender.com';

    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

    return isLocal ? '' : RENDER_URL;
})();

// Helper so all scripts can do: apiFetch('/api/login', options)
async function apiFetch(path, options = {}) {
    const url = API_BASE + path;
    return fetch(url, options);
}
