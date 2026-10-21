const root = document.documentElement;
root.dataset.theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); };

if (typeof CONFIG === 'undefined' || CONFIG.API_URL.startsWith('PASTE')) $('#meta').innerHTML = '<span class="err">Setup needed:</span> config.js is missing or still has the placeholder. Paste your Apps Script /exec URL into config.js.';
else loadDB();
