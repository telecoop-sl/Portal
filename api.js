const API = {
  async get(action) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
    let r;
    try { r = await fetch(`${CONFIG.API_URL}?action=${action}`, { signal: c.signal }); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'request timed out after 20 seconds' : 'cannot reach the Apps Script URL'); }
    finally { clearTimeout(t); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('response is not JSON - set the web app access to "Anyone" and use the /exec URL'); }
    if (!j.ok) throw new Error(j.error);
    return j;
  }
};
