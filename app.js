if (typeof CONFIG === 'undefined' || CONFIG.API_URL.startsWith('PASTE')) $('#meta').innerHTML = '<span class="err">Setup needed:</span> config.js is missing or still has the placeholder. Paste your Apps Script /exec URL into config.js.';
else loadDB();

document.querySelectorAll('nav button[data-s]').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== b.dataset.s);
  if (b.dataset.s === 'pay' && !P.started && !CONFIG.API_URL.startsWith('PASTE')) loadPay();
  if (b.dataset.s === 'od' && !O.started && !CONFIG.API_URL.startsWith('PASTE')) loadOv();
});
