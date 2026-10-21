const API = {
  async get(action) {
    const key = localStorage.getItem('akey') || '';
    const r = await fetch(`${CONFIG.API_URL}?action=${action}&key=${encodeURIComponent(key)}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j;
  }
};
