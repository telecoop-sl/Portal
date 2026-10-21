if (typeof CONFIG === 'undefined' || CONFIG.API_URL.startsWith('PASTE')) $('#meta').innerHTML = '<span class="err">Setup needed:</span> config.js is missing or still has the placeholder. Paste your Apps Script /exec URL into config.js.';
else loadDB();
