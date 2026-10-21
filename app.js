const root = document.documentElement;
root.dataset.theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); };

function askKey() { $('#keyIn').value = ''; $('#keyDlg').showModal(); }
$('#keyForm').onsubmit = () => { localStorage.setItem('akey', $('#keyIn').value.trim()); setTimeout(loadDB, 0); };

if (CONFIG.API_URL.startsWith('PASTE')) $('#meta').innerHTML = '<span class="err">Setup needed:</span> paste your Apps Script URL into config.js.';
else if (!localStorage.getItem('akey')) askKey();
else loadDB();
