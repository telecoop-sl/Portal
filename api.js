const API = {
  async get(action, extra = '') {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
    let r;
    try { r = await fetch(`${CONFIG.API_URL}?action=${action}${extra}`, { signal: c.signal }); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'request timed out after 20 seconds' : 'cannot reach the Apps Script URL'); }
    finally { clearTimeout(t); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('response is not JSON - set the web app access to "Anyone" and use the /exec URL'); }
    if (!j.ok) throw new Error(j.error);
    return j;
  },
  // Writes use POST with a plain-text body (no CORS preflight). If EDIT_PIN is set in Script properties, the PIN is asked once per session.
  async post(action, data, quiet) {
    const send = async () => {
      const r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ ...data, action, pin: sessionStorage.getItem('pin') || '' }) });
      return r.json();
    };
    let j = await send();
    if (!j.ok && j.error === 'pin') {
      if (quiet) throw new Error('pin');
      const p = prompt('Enter the edit PIN'); if (p === null) throw new Error('cancelled');
      sessionStorage.setItem('pin', p); j = await send();
    }
    if (!j.ok) throw new Error(j.error);
    return j;
  }
};
