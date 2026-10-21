const P = { tab: 'ALL', data: {}, upd: null, q: '', f: {}, key: 'recent', dir: -1, page: 1, size: 25, started: false, cur: [] };
const PCOLS = ['Receipt No.', 'Timestamp', 'Account Number', 'Fullname', 'Month', 'Year', 'Due Date', 'Mode of Payment', 'Reference Number', 'Remarks', 'Received Date', 'Amount', 'Source'];
const PW = { 'Receipt No.': 7, Timestamp: 11, 'Account Number': 7.5, Fullname: 14, Month: 6.5, Year: 4, 'Due Date': 5, 'Mode of Payment': 7, 'Reference Number': 10.5, Remarks: 6.5, 'Received Date': 7.5, Amount: 7.5, Source: 5 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const amt = v => Number(String(v).replace(/[^0-9.\-]/g, '')) || 0;
const peso = n => '\u20B1' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tabsFor = t => t === 'ALL' ? ['GCASH', 'POS1', 'POS2'] : [t];
const hid = o => o['Customer Status'] && !['Active', 'Inactive'].includes(o['Customer Status']); // Caste/Yearly: own tab later
const isoDate = s => { const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''; };
const mdy = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${+m[2]}/${+m[3]}/${m[1]}` : ''; };
const rowsNow = () => tabsFor(P.tab).flatMap(t => P.data[t] || []);

// Remarks rule: Akinse due 15th-16th; Atrenta due the 30th (last day of Feb) up to the 1st of the next month.
function autoRemark(due, month, year, rd) {
  const mi = MONTHS.indexOf(month), y = +year; if (mi < 0 || !y || !due || isNaN(rd)) return '';
  const day = rd.getDate(), diff = (rd.getFullYear() * 12 + rd.getMonth()) - (y * 12 + mi);
  if (String(due).startsWith('15')) return diff < 0 ? 'Advanced' : diff > 0 ? 'Delayed' : day <= 14 ? 'Advanced' : day <= 16 ? '' : 'Delayed';
  const dueDay = Math.min(30, new Date(y, mi + 1, 0).getDate());
  return diff < 0 ? 'Advanced' : diff === 0 ? (day < dueDay ? 'Advanced' : '') : diff === 1 ? (day <= 1 ? '' : 'Delayed') : 'Delayed';
}

async function loadPay() {
  P.started = true; renderTabs();
  const need = tabsFor(P.tab).filter(t => !P.data[t]);
  if (need.length) $('#pay').classList.add('loading');
  $('#pMeta').textContent = '';
  try {
    await Promise.all(need.map(async t => {
      const r = await API.get('payments', '&tab=' + t);
      P.data[t] = r.rows.map((a, i) => {
        const o = {}; r.cols.forEach((c, j) => o[c] = a[j]);
        o.Source = t; o._i = i; o._d = ts(o['Received Date']); o._t = ts(o.Timestamp); o._a = amt(o.Amount); o._m = MONTHS.indexOf(o.Month);
        o._s = norm([o.Fullname, o['Account Number'], o['Reference Number']].join(' ')); return o;
      });
    }));
    if (need.length) P.upd = new Date();
    fillPF(); renderPay();
  } catch (e) { $('#pMeta').innerHTML = `<span class="err">Could not load payments (${esc(e.message)}).</span>`; }
  $('#pay').classList.remove('loading');
}

function renderTabs() {
  $('#pTabs').innerHTML = [['ALL', 'All'], ['GCASH', 'GCASH'], ['POS1', 'POS1'], ['POS2', 'POS2']].map(([t, l]) => {
    const n = tabsFor(t).every(x => P.data[x]) ? tabsFor(t).reduce((s, x) => s + P.data[x].filter(o => !hid(o)).length, 0).toLocaleString('en-PH') : '';
    return `<button data-t="${t}" class="${P.tab === t ? 'on' : ''}">${l} <span>${n}</span></button>`;
  }).join('');
}

function fillPF() {
  const vis = rowsNow().filter(o => !hid(o)), vals = k => [...new Set(vis.map(o => o[k]).filter(Boolean))];
  const grp = (k, list, fmt = v => v) => `<div class="frow"><span>${k}</span><div class="seg" data-k="${k}">` +
    ['', ...list].map(v => `<button data-v="${esc(v)}" class="${(P.f[k] || '') === v ? 'on' : ''}">${v === '' ? 'All' : esc(fmt(v))}</button>`).join('') + '</div></div>';
  const rem = vals('Remarks').sort(); if (vis.some(o => !o.Remarks)) rem.push('(none)');
  $('#pFilters').innerHTML = grp('Year', vals('Year').sort().reverse()) + grp('Month', MONTHS.filter(m => vals('Month').includes(m)), m => m.slice(0, 3)) +
    grp('Mode of Payment', vals('Mode of Payment').sort()) + grp('Remarks', rem, v => v === '(none)' ? 'None' : v) +
    '<div class="frow acts"><button id="pClear" class="ghost">Clear filters</button><button id="pRefresh" class="ghost">Refresh</button></div>';
}

function renderPay() {
  const vis = rowsNow().filter(o => !hid(o)), q = norm(P.q.trim());
  const rows = vis.filter(o => (!q || o._s.includes(q)) && Object.entries(P.f).every(([k, v]) => !v || (v === '(none)' ? !o[k] : o[k] === v)));
  const sv = (o, k) => k === 'Received Date' ? o._d : k === 'Timestamp' ? o._t : k === 'Amount' ? o._a : k === 'Month' ? o._m : k === 'Year' ? +o.Year : o[k] || '';
  rows.sort(P.key === 'recent' ? (a, b) => (b._d - a._d) || (b._t - a._t) || (b._i - a._i)
    : (a, b) => { const x = sv(a, P.key), y = sv(b, P.key); return P.dir * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })); });
  const cols = PCOLS.filter(c => c !== 'Source' || P.tab === 'ALL'), tw = cols.reduce((s, c) => s + PW[c], 0);
  const pages = Math.max(1, Math.ceil(rows.length / P.size)); P.page = Math.min(P.page, pages);
  P.cur = rows.slice((P.page - 1) * P.size, P.page * P.size);
  $('#pCols').innerHTML = cols.map(c => `<col style="width:${(PW[c] / tw * 100).toFixed(2)}%">`).join('');
  $('#pHead').innerHTML = '<tr>' + cols.map(c => `<th data-k="${c}" class="${P.key === c ? 's' + (P.dir < 0 ? ' d' : '') : ''}">${c}</th>`).join('') + '</tr>';
  const cell = (o, c) => c === 'Reference Number' && o['Mode of Payment'] === 'CASH' ? '' : (o[c] || '');
  $('#pBody').innerHTML = P.cur.length ? P.cur.map((o, i) => `<tr data-i="${i}"${o.Source === 'GCASH' ? ' class="edit" title="Click to edit"' : ''}>` + cols.map(c =>
    `<td class="${c === 'Fullname' ? 'l' : c === 'Amount' ? 'amt' : ''}" title="${c === 'Fullname' ? esc(o[c]) : ''}">${esc(cell(o, c))}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${cols.length}">No payments match. Clear the search or filters.</td></tr>`;
  const n = x => x.toLocaleString('en-PH'), st = (l, v) => `<div class="st"><small>${l}</small><b>${v}</b></div>`;
  $('#pStats').innerHTML = st('Payments', rows.length === vis.length ? n(vis.length) : `${n(rows.length)} of ${n(vis.length)}`) +
    st('Total Amount', peso(rows.reduce((s, o) => s + o._a, 0))) +
    st('Last Update', P.upd ? P.upd.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '\u2014');
  renderTabs();
  const p = P.page, s0 = Math.max(1, Math.min(p - 2, pages - 4)), e0 = Math.min(pages, s0 + 4);
  const pb = (l, k, off, on) => `<button class="ghost${on ? ' on' : ''}" data-p="${k}"${off ? ' disabled' : ''}>${l}</button>`;
  let ph = pb('First', 1, p <= 1) + pb('Previous', p - 1, p <= 1);
  for (let i = s0; i <= e0; i++) ph += pb(i, i, false, i === p);
  $('#pPager').innerHTML = ph + pb('Next', p + 1, p >= pages) + pb('Last', pages, p >= pages) + `<span class="meta">Page ${p} of ${pages}</span>`;
}

function openPay(o) {
  const dlg = $('#pdetail'), d0 = isoDate(o['Received Date']);
  const opts = (list, cur) => (!cur || list.includes(cur) ? list : [cur, ...list]).map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const lock = ['Timestamp', 'Account Number', 'Due Date', 'Membership Level', 'Server'];
  dlg.innerHTML = `<div class="mh"><div class="mt"><h2>Payment Information</h2><button class="ghost" data-x>Close</button></div>
    <div class="nm">${esc(o.Fullname)}</div><div class="ac">${esc(o['Account Number'])} <span class="b">${esc(o.Source)}</span></div></div>
    <div class="dbody"><section class="grp"><h3>Payment details</h3><dl>${lock.map(k => `<dt>${k}</dt><dd>${esc(o[k] || '\u2014')}</dd>`).join('')}</dl></section>
    <section class="grp"><h3>Edit payment</h3><div class="form">
      <label>Month<select id="eMonth">${opts(MONTHS, o.Month)}</select></label>
      <label>Year<input id="eYear" type="number" value="${esc(o.Year)}"></label>
      <label>Received Date<input id="eDate" type="date" value="${d0}"></label>
      <label>Amount<input id="eAmt" type="number" step="0.01" min="0" value="${amt(o.Amount)}"></label>
      <label>Mode of Payment<select id="eMode">${opts(['GCASH', 'Bank Transfer'], o['Mode of Payment'])}</select></label>
      <label>Reference Number<input id="eRef" value="${esc(o['Reference Number'])}"></label>
      <label>Remarks (auto)<input id="eRem" readonly value="${esc(o.Remarks)}"></label>
      <label>Facebook Name<input id="eFb" value="${esc(o['Facebook Name'])}"></label></div></section></div>
    <div class="mf"><button class="ghost danger" id="eDel">Delete</button><span class="ferr" id="eMsg"></span><span class="grow"></span><button class="solid" id="eSave">Save changes</button></div>`;
  const g = s => dlg.querySelector(s), msg = t => { g('#eMsg').textContent = t; };
  const val = () => ({ Month: g('#eMonth').value, Year: g('#eYear').value.trim(), 'Received Date': mdy(g('#eDate').value), Amount: g('#eAmt').value,
    'Mode of Payment': g('#eMode').value, 'Reference Number': g('#eRef').value.replace(/\s/g, ''), 'Facebook Name': g('#eFb').value.trim() });
  const orig = { Month: o.Month, Year: o.Year, 'Received Date': o['Received Date'], Amount: o.Amount, 'Mode of Payment': o['Mode of Payment'],
    'Reference Number': o['Reference Number'], Remarks: o.Remarks, 'Facebook Name': o['Facebook Name'] };
  const recompute = () => {
    const v = val(), moved = v.Month !== o.Month || v.Year !== o.Year || g('#eDate').value !== d0;
    g('#eRem').value = moved ? autoRemark(o['Due Date'], v.Month, v.Year, new Date(g('#eDate').value + 'T00:00:00')) : (o.Remarks || '');
  };
  ['#eMonth', '#eYear', '#eDate'].forEach(s => g(s).oninput = recompute);
  const run = async fn => {
    g('#eSave').disabled = g('#eDel').disabled = true; msg('Saving…');
    try { await fn(); dlg.close(); delete P.data.GCASH; loadPay(); }
    catch (e) { msg(e.message === 'cancelled' ? '' : e.message); g('#eSave').disabled = g('#eDel').disabled = false; }
  };
  g('#eSave').onclick = () => {
    const v = val(), ch = {};
    if (!v['Reference Number']) return msg('Reference Number is required');
    if (!(+v.Amount > 0)) return msg('Enter a valid Amount');
    if (!v.Month || !v.Year || !v['Received Date']) return msg('Month, Year and Received Date are required');
    if (Object.values(P.data).flat().some(x => x !== o && String(x['Reference Number']).replace(/\s/g, '') === v['Reference Number'])) return msg('Reference Number already exists');
    for (const k in v) { const same = k === 'Amount' ? +v[k] === amt(o[k]) : k === 'Received Date' ? g('#eDate').value === d0 : String(v[k]) === String(o[k] || ''); if (!same) ch[k] = v[k]; }
    if (g('#eRem').value !== (o.Remarks || '')) ch.Remarks = g('#eRem').value;
    if (!Object.keys(ch).length) return msg('No changes to save');
    run(() => API.post('updatePayment', { account: o['Account Number'], stamp: o.Timestamp, orig, changes: ch }));
  };
  g('#eDel').onclick = e => {
    const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Click again to confirm'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Delete'; }, 4000); return; }
    run(() => API.post('deletePayment', { account: o['Account Number'], stamp: o.Timestamp, orig }));
  };
  dlg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => dlg.close());
  dlg.showModal();
}

$('#pTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; P.tab = b.dataset.t; P.page = 1; P.f = {}; P.key = 'recent'; P.dir = -1; loadPay(); };
$('#pq').oninput = e => { P.q = e.target.value; P.page = 1; renderPay(); };
$('#pFilters').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'pClear') { P.q = ''; P.f = {}; P.key = 'recent'; P.dir = -1; P.page = 1; $('#pq').value = ''; }
  else if (b.id === 'pRefresh') { P.data = {}; loadPay(); return; }
  else { P.f[b.parentElement.dataset.k] = b.dataset.v; P.page = 1; }
  fillPF(); renderPay();
};
$('#pHead').onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; P.dir = P.key === k ? -P.dir : 1; P.key = k; renderPay(); };
$('#pPager').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { P.page = +b.dataset.p; renderPay(); } };
$('#pBody').onclick = e => { const tr = e.target.closest('tr.edit'); if (tr) openPay(P.cur[+tr.dataset.i]); };
$('#pdetail').onclick = e => { if (e.target === $('#pdetail')) $('#pdetail').close(); };
