// ─── MakerCircuit Frontend Config ────────────────────────────────────────────
// Set VITE_API_URL or replace this URL after you deploy to Render.
// This file is loaded BEFORE auth.js and any page scripts.

const API_BASE = (() => {
    // Frontend and backend are on the same Render domain, so use relative URLs.
    return '';
})();

// Helper so all scripts can do: apiFetch('/api/login', options)
async function apiFetch(path, options = {}) {
    const url = API_BASE + path;
    return fetch(url, options);
}
