const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLS = ['Status', 'Account Number', 'Member Name', 'PPPoE Name', 'Area', 'Due Date', 'Membership Level'];
const GROUPS = {
  'Contact': ['Phone Number', 'Email', 'Address', 'LatLong'],
  'Account': ['Account Number', 'Member ID', 'Status', 'Date of Install', 'Submission Date', 'Server', 'Due Date', 'Area'],
  'Service': ['PPPoE Name', 'MAC Address', 'PON', 'NAP', 'PORT', 'Modem Type'],
  'Membership and fees': ['Membership Level', 'Membership', 'Membership Fee', 'Additional Equipments', 'Additional Fee', 'Promo Duration', 'Receipt No.'],
  'Referral': ['Referral Fullname', 'Referral Status', 'Referral Fee', 'Referral Log'],
  'Logs': ['Last Update Log', 'Last User Update']
};
const FILTERS = { Area: '#fArea', 'Due Date': '#fDue', 'Membership Level': '#fLevel' };
const S = { all: [], view: [], q: '', f: {}, key: 'recent', dir: -1, page: 1, size: 25 };
function ts(s) {
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}):(\d{2}))?/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0;
}
function renderSeg() {
  const n = s => S.all.filter(o => o.Status === s).length, cur = S.f.Status || '';
  $('#fStatus').innerHTML = [['', 'All', S.all.length], ['Active', 'Active', n('Active')], ['Inactive', 'Inactive', n('Inactive')]]
    .map(([v, l, c]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l} <span>${c}</span></button>`).join('');
}
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ');

// Display-only cleanup; the sheet is never changed.
function tidy(h, v) {
  if (h === 'Membership' && v) return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  if (h === 'PON') return v.replace(/^PON\s*(\d+)/i, 'PON $1');
  return v;
}

async function loadDB() {
  $('#meta').textContent = 'Loading…';
  try {
    const r = await API.get('customers');
    S.all = r.rows.map((a, idx) => {
      const o = {};
      r.headers.forEach((h, i) => o[h] = tidy(h, a[i]));
      o['Member Name'] = [o['First Name'], o['Middle Name'], o['Last Name'], o['Suffix']].filter(Boolean).join(' ');
      o._i = idx; o._t = ts(o['Submission Date']);
      o._s = norm([o['Member Name'], o['Account Number'], o['PPPoE Name'], o['Phone Number'], o['Address']].join(' '));
      return o;
    });
    S.updated = new Date(r.updated);
    fillFilters(); render();
  } catch (e) {
    $('#meta').innerHTML = `<span class="err">Could not load data (${esc(e.message)}).</span> Check the Apps Script URL in config.js and that the web app is deployed for “Anyone”.`;
  }
}

function fillFilters() {
  for (const [k, sel] of Object.entries(FILTERS)) {
    const vals = [...new Set(S.all.map(o => o[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const cur = S.f[k] || '';
    $(sel).innerHTML = '<option value="">All</option>' + vals.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }
}

function render() {
  const q = norm(S.q.trim());
  S.view = S.all.filter(o => (!q || o._s.includes(q)) && Object.entries(S.f).every(([k, v]) => !v || o[k] === v));
  S.view.sort(S.key === 'recent' ? (a, b) => (b._t - a._t) || (b._i - a._i)
    : (a, b) => S.dir * String(a[S.key] || '').localeCompare(String(b[S.key] || ''), undefined, { numeric: true }));
  renderSeg();
  if (q) { const i = S.view.findIndex(o => o['Account Number'] === S.q.trim()); if (i > 0) S.view.unshift(...S.view.splice(i, 1)); }
  const pages = Math.max(1, Math.ceil(S.view.length / S.size));
  S.page = Math.min(S.page, pages);
  const rows = S.view.slice((S.page - 1) * S.size, S.page * S.size);
  $('#thead').innerHTML = '<tr>' + COLS.map(c => `<th data-k="${c}" class="${S.key === c ? 's' + (S.dir < 0 ? ' d' : '') : ''}">${c}</th>`).join('') + '</tr>';
  $('#tbody').innerHTML = rows.length ? rows.map(o => '<tr data-a="' + esc(o['Account Number']) + '">' + COLS.map(c =>
    c === 'Status' ? `<td><span class="b ${o[c] === 'Active' ? '' : 'i'}">${esc(o[c])}</span></td>` : `<td>${esc(o[c] || '—')}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${COLS.length}">No customers match. Clear the search or filters.</td></tr>`;
  $('#meta').textContent = `${S.view.length} of ${S.all.length} customers · ${S.key === 'recent' ? 'Newest first · ' : ''}Updated ${S.updated.toLocaleTimeString()}`;
  $('#pg').textContent = `Page ${S.page} of ${pages}`;
  $('#prev').disabled = S.page <= 1; $('#next').disabled = S.page >= pages;
}

function openDetail(acct) {
  const o = S.all.find(x => x['Account Number'] === acct); if (!o) return;
  const used = new Set(['Member Name', '_s', 'First Name', 'Middle Name', 'Last Name', 'Suffix']);
  const val = (k, v) => !v ? '—' : k === 'LatLong' && /^-?\d+(\.\d+)?\s*,\s*-?\d+/.test(v)
    ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  const sec = (t, keys) => `<h3>${t}</h3><dl>` + keys.map(k => { used.add(k); return `<dt>${k}</dt><dd>${val(k, o[k])}</dd>`; }).join('') + '</dl>';
  let html = Object.entries(GROUPS).map(([t, k]) => sec(t, k)).join('');
  const rest = Object.keys(o).filter(k => !used.has(k) && !GROUPS['Contact'].includes(k));
  if (rest.length) html += sec('Other', rest);
  $('#detail').innerHTML = `<div class="dh"><div><h2>${esc(o['Member Name'])}</h2><p>${esc(o['Account Number'])} · ${esc(o.Status)}</p></div><button class="ghost" id="close">Close</button></div><div class="dbody">${html}</div>`;
  $('#detail').showModal();
  $('#close').onclick = () => $('#detail').close();
}

$('#q').oninput = e => { S.q = e.target.value; S.page = 1; render(); };
for (const [k, sel] of Object.entries(FILTERS)) $(sel).onchange = e => { S.f[k] = e.target.value; S.page = 1; render(); };
$('#thead').onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; S.dir = S.key === k ? -S.dir : 1; S.key = k; render(); };
$('#tbody').onclick = e => { const a = e.target.closest('tr')?.dataset.a; if (a) openDetail(a); };
$('#prev').onclick = () => { S.page--; render(); };
$('#next').onclick = () => { S.page++; render(); };
$('#refresh').onclick = loadDB;
$('#fStatus').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.f.Status = b.dataset.v; S.page = 1; render(); };
$('#clear').onclick = () => { S.q = ''; S.f = {}; S.key = 'recent'; S.dir = -1; S.page = 1; $('#q').value = ''; fillFilters(); render(); };
$('#detail').onclick = e => { if (e.target === $('#detail')) $('#detail').close(); };
