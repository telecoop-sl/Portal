const P = { tab: 'ALL', data: {}, upd: null, q: '', f: {}, key: 'recent', dir: -1, page: 1, size: 25, started: false };
const PCOLS = ['Received Date', 'Account Number', 'Fullname', 'Month', 'Year', 'Due Date', 'Amount', 'Mode of Payment', 'Reference Number', 'Remarks'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PF = { Year: '#pYear', Month: '#pMonth', 'Mode of Payment': '#pMode', Remarks: '#pRem' };
const amt = v => Number(String(v).replace(/[^0-9.\-]/g, '')) || 0;
const peso = n => '\u20B1' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tabsFor = t => t === 'ALL' ? ['GCASH', 'POS1', 'POS2'] : [t];
const hid = o => o['Customer Status'] && !['Active', 'Inactive'].includes(o['Customer Status']); // Caste/Yearly: own tab later

async function loadPay() {
  P.started = true; $('#pMeta').textContent = 'Loading…';
  try {
    await Promise.all(tabsFor(P.tab).filter(t => !P.data[t]).map(async t => {
      const r = await API.get('payments', '&tab=' + t);
      P.data[t] = r.rows.map((a, i) => {
        const o = {}; r.cols.forEach((c, j) => o[c] = a[j]);
        o.Source = t; o._i = i; o._d = ts(o['Received Date']); o._t = ts(o.Timestamp); o._a = amt(o.Amount); o._m = MONTHS.indexOf(o.Month);
        o._s = norm([o.Fullname, o['Account Number'], o['Reference Number']].join(' ')); return o;
      });
    }));
    P.upd = new Date(); fillPF(); renderPay();
  } catch (e) { $('#pMeta').innerHTML = `<span class="err">Could not load payments (${esc(e.message)}).</span>`; }
}
const rowsNow = () => tabsFor(P.tab).flatMap(t => P.data[t] || []);

function fillPF() {
  const vis = rowsNow().filter(o => !hid(o));
  for (const [k, sel] of Object.entries(PF)) {
    let vals = [...new Set(vis.map(o => o[k]).filter(Boolean))];
    vals = k === 'Month' ? MONTHS.filter(m => vals.includes(m)) : k === 'Year' ? vals.sort().reverse() : vals.sort();
    if (k === 'Remarks' && vis.some(o => !o.Remarks)) vals.push('(none)');
    $(sel).innerHTML = '<option value="">All</option>' + vals.map(v => `<option${v === P.f[k] ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }
}

function renderPay() {
  const all = rowsNow(), vis = all.filter(o => !hid(o)), q = norm(P.q.trim());
  const rows = vis.filter(o => (!q || o._s.includes(q)) && Object.entries(P.f).every(([k, v]) => !v || (v === '(none)' ? !o[k] : o[k] === v)));
  const sv = (o, k) => k === 'Received Date' ? o._d : k === 'Amount' ? o._a : k === 'Month' ? o._m : k === 'Year' ? +o.Year : o[k] || '';
  rows.sort(P.key === 'recent' ? (a, b) => (b._d - a._d) || (b._t - a._t) || (b._i - a._i)
    : (a, b) => { const x = sv(a, P.key), y = sv(b, P.key); return P.dir * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })); });
  const cols = PCOLS.concat(P.tab === 'GCASH' ? ['Facebook Name'] : [], P.tab === 'ALL' ? ['Source'] : []);
  const pages = Math.max(1, Math.ceil(rows.length / P.size)); P.page = Math.min(P.page, pages);
  const cur = rows.slice((P.page - 1) * P.size, P.page * P.size);
  $('#pHead').innerHTML = '<tr>' + cols.map(c => `<th data-k="${c}" class="${P.key === c ? 's' + (P.dir < 0 ? ' d' : '') : ''}">${c}</th>`).join('') + '</tr>';
  $('#pBody').innerHTML = cur.length ? cur.map(o => '<tr>' + cols.map(c =>
    `<td class="${c === 'Fullname' ? 'l' : c === 'Amount' ? 'amt' : ''}">${esc(o[c] || '\u2014')}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${cols.length}">No payments match. Clear the search or filters.</td></tr>`;
  const hidden = all.length - vis.length;
  $('#pMeta').textContent = `${rows.length} of ${vis.length} payments \u00B7 Total ${peso(rows.reduce((s, o) => s + o._a, 0))}` +
    (hidden ? ` \u00B7 ${hidden} hidden (Caste/Yearly accounts)` : '') + (P.key === 'recent' ? ' \u00B7 Newest first' : '') + ` \u00B7 Updated ${P.upd.toLocaleTimeString()}`;
  $('#pTabs').innerHTML = [['ALL', 'All'], ['GCASH', 'GCASH'], ['POS1', 'POS1'], ['POS2', 'POS2']].map(([t, l]) => {
    const n = tabsFor(t).every(x => P.data[x]) ? tabsFor(t).reduce((s, x) => s + P.data[x].filter(o => !hid(o)).length, 0) : '';
    return `<button data-t="${t}" class="${P.tab === t ? 'on' : ''}">${l} <span>${n}</span></button>`; }).join('');
  const p = P.page, s0 = Math.max(1, Math.min(p - 2, pages - 4)), e0 = Math.min(pages, s0 + 4);
  const pb = (l, n, off, on) => `<button class="ghost${on ? ' on' : ''}" data-p="${n}"${off ? ' disabled' : ''}>${l}</button>`;
  let ph = pb('First', 1, p <= 1) + pb('Previous', p - 1, p <= 1);
  for (let i = s0; i <= e0; i++) ph += pb(i, i, false, i === p);
  $('#pPager').innerHTML = ph + pb('Next', p + 1, p >= pages) + pb('Last', pages, p >= pages) + `<span class="meta">Page ${p} of ${pages}</span>`;
}

$('#pTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; P.tab = b.dataset.t; P.page = 1; P.f = {}; P.key = 'recent'; P.dir = -1; loadPay(); };
$('#pq').oninput = e => { P.q = e.target.value; P.page = 1; renderPay(); };
for (const [k, sel] of Object.entries(PF)) $(sel).onchange = e => { P.f[k] = e.target.value; P.page = 1; renderPay(); };
$('#pHead').onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; P.dir = P.key === k ? -P.dir : 1; P.key = k; renderPay(); };
$('#pPager').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { P.page = +b.dataset.p; renderPay(); } };
$('#pClear').onclick = () => { P.q = ''; P.f = {}; P.key = 'recent'; P.dir = -1; P.page = 1; $('#pq').value = ''; fillPF(); renderPay(); };
$('#pRefresh').onclick = () => { P.data = {}; loadPay(); };
