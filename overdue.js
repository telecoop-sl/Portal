const O = { data: [], upd: null, tab: 'UNPAID', q: '', f: {}, key: 'recent', dir: -1, page: 1, size: 20, started: false, cur: [] };
const OCOLS = [['Account Number', 8], ['Member Name', 15], ['PPPoE Name', 15], ['Month', 7], ['Year', 4.5], ['Due Date', 7], ['Status', 8], ['Disconnection Stamp', 14], ['Reconnection Stamp', 14], ['Modem Status', 9.5], ['Remaining Days', 7]];
const fmtS = ms => new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const oShow = (o, l) => ({ 'Account Number': o['Account #'], 'PPPoE Name': o['Account Name'], 'Due Date': o.Due, 'Modem Status': o._modem, 'Remaining Days': o._rem,
  'Disconnection Stamp': o._tod ? fmtS(o._tod) : o['Time of Death'], 'Reconnection Stamp': o._gd ? fmtS(o._gd) : o['Gamot Done'] }[l] ?? o[l]) || '';
const oRows = () => O.data.filter(o => O.tab === 'ALL' || (O.tab === 'PAID') === (o.Gamot === 'TRUE'));

async function loadOv(quiet) {
  O.started = true; renderOTabs();
  if (!quiet) $('#od').classList.add('loading');
  $('#oMeta').textContent = '';
  try {
    const r = await API.get('overdues');
    O.data = r.rows.map((a, i) => {
      const o = {}; r.cols.forEach((c, j) => o[c] = a[j]); const c = r.comp[i];
      Object.assign(o, { _modem: c[0], _rem: c[1], _fc: c[2], _tod: c[3] ? Date.parse(c[3]) : 0, _gd: c[4] ? Date.parse(c[4]) : 0, _i: i, _t: ts(o.Timestamp) });
      o._dirty = !!c[5] && (c[0] !== o['Modem Status'] || String(c[1]) !== o['Remaining Days'] || c[2] !== o['For Claim']);
      o._s = norm([o['Member Name'], o['Account #'], o['Account Name']].join(' ')); return o;
    });
    O.upd = new Date(); fillOF(); renderOv();
    if (O.data.some(o => o._dirty)) API.post('syncModem', {}, true).catch(() => {}); // write the computed modem values back to the sheet
  } catch (e) { $('#oMeta').innerHTML = `<span class="err">Could not load overdues (${esc(e.message)}).</span>`; }
  $('#od').classList.remove('loading');
}

function renderOTabs() {
  $('#oTabs').innerHTML = [['ALL', 'All'], ['UNPAID', 'Unpaid'], ['PAID', 'Paid']].map(([t, l]) => {
    const n = O.data.length ? O.data.filter(o => t === 'ALL' || (t === 'PAID') === (o.Gamot === 'TRUE')).length.toLocaleString('en-PH') : '';
    return `<button data-t="${t}" class="${O.tab === t ? 'on' : ''}">${l} <span>${n}</span></button>`;
  }).join('');
}

function fillOF() {
  const base = oRows(), vals = k => [...new Set(base.map(o => o[k]).filter(Boolean))];
  const sel = (k, list) => `<span${k === 'Year' ? ' class="in"' : ''}>${k}</span><select data-k="${k}" aria-label="${k}"><option value="">All</option>` +
    list.map(v => `<option${(O.f[k] || '') === v ? ' selected' : ''}>${esc(v)}</option>`).join('') + '</select>';
  const grp = (k, label, list) => `<div class="frow"><span>${label}</span><div class="seg" data-k="${k}">` +
    ['', ...list].map(v => `<button data-v="${esc(v)}" class="${(O.f[k] || '') === v ? 'on' : ''}">${v === '' ? 'All' : esc(v)}</button>`).join('') + '</div></div>';
  $('#oFilters').innerHTML = `<div class="frow">${sel('Month', MONTHS.filter(m => vals('Month').includes(m)))}${sel('Year', vals('Year').sort().reverse())}</div>` +
    grp('Status', 'Status', vals('Status').sort()) + grp('_modem', 'Modem Status', ['PENDING', 'FOR CLAIM', 'CLAIMED', 'UNABLE TO CLAIM'].filter(m => base.some(o => o._modem === m))) +
    '<div class="frow acts"><button id="oClear" class="ghost">Clear filters</button><button id="oRefresh" class="ghost">Refresh</button></div>';
}

function renderOv() {
  const q = norm(O.q.trim());
  const rows = oRows().filter(o => (!q || o._s.includes(q)) && Object.entries(O.f).every(([k, v]) => !v || o[k] === v));
  const sv = (o, k) => ({ 'Disconnection Stamp': o._tod, 'Reconnection Stamp': o._gd, 'Remaining Days': o._rem === '' ? 9999 : +o._rem, Year: +o.Year, Month: MONTHS.indexOf(o.Month) }[k] ?? oShow(o, k));
  rows.sort(O.key === 'recent' ? (a, b) => (b._t - a._t) || (b._i - a._i)
    : (a, b) => { const x = sv(a, O.key), y = sv(b, O.key); return O.dir * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })); });
  const tw = OCOLS.reduce((s, c) => s + c[1], 0), pages = Math.max(1, Math.ceil(rows.length / O.size)); O.page = Math.min(O.page, pages);
  O.cur = rows.slice((O.page - 1) * O.size, O.page * O.size);
  $('#oCols').innerHTML = OCOLS.map(c => `<col style="width:${(c[1] / tw * 100).toFixed(2)}%">`).join('');
  $('#oHead').innerHTML = '<tr>' + OCOLS.map(c => `<th data-k="${c[0]}" class="${O.key === c[0] ? 's' + (O.dir < 0 ? ' d' : '') : ''}">${c[0]}</th>`).join('') + '</tr>';
  const cell = (o, l) => l === 'Status' ? `<span class="b ${o.Status === 'Disconnect' ? '' : 'i'}">${esc(o.Status)}</span>` : l === 'Modem Status' ? `<span class="mb ${o._modem === 'FOR CLAIM' ? 'fc' : ''}">${esc(o._modem)}</span>` : esc(oShow(o, l));
  $('#oBody').innerHTML = O.cur.length ? O.cur.map((o, i) => `<tr data-i="${i}" title="Click to view / manage">` + OCOLS.map(c => `<td class="${c[0] === 'Member Name' || c[0] === 'PPPoE Name' ? 'l' : ''}">${cell(o, c[0])}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${OCOLS.length}">No overdue records match. Clear the search or filters.</td></tr>`;
  const n = x => x.toLocaleString('en-PH'), st = (l, v) => `<div class="st"><small>${l}</small><b>${v}</b></div>`;
  $('#oStats').innerHTML = st('Records', rows.length === oRows().length ? n(rows.length) : `${n(rows.length)} of ${n(oRows().length)}`) + st('Unpaid', n(O.data.filter(o => o.Gamot !== 'TRUE').length)) +
    st('For Claim', n(O.data.filter(o => o.Gamot !== 'TRUE' && o._modem === 'FOR CLAIM').length)) + st('Last Update', O.upd ? O.upd.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '\u2014');
  renderOTabs();
  const p = O.page, s0 = Math.max(1, Math.min(p - 2, pages - 4)), e0 = Math.min(pages, s0 + 4);
  const pb = (l, k, off, on) => `<button class="ghost${on ? ' on' : ''}" data-p="${k}"${off ? ' disabled' : ''}>${l}</button>`;
  let ph = pb('First', 1, p <= 1) + pb('Previous', p - 1, p <= 1);
  for (let i = s0; i <= e0; i++) ph += pb(i, i, false, i === p);
  $('#oPager').innerHTML = ph + pb('Next', p + 1, p >= pages) + pb('Last', pages, p >= pages) + `<span class="meta">Page ${p} of ${pages}</span>`;
}

function openOv(o) {
  const dlg = $('#odetail'), paid = o.Gamot === 'TRUE', dis = o.Disabled === 'TRUE', mod = o._modem;
  const row = (l, v) => `<dt>${l}</dt><dd>${esc(v) || '\u2014'}</dd>`;
  const sum = [['Account Number', o['Account #']], ['Month', o.Month], ['Year', o.Year], ['Due Date', o.Due]];
  let btn = '';
  if (!paid && !dis) btn += '<button class="ghost" id="oDisc">Disconnect</button>';
  if (!paid && dis && ['FOR CLAIM', 'UNABLE TO CLAIM'].includes(mod)) btn += '<button class="ghost" id="oClaim">Claimed</button><button class="ghost danger" id="oUnable">Unable to Claim</button>';
  if (!paid) btn += `<button class="solid" id="oRec">${dis ? 'Reconnect' : 'Mark as Paid'}</button>`;
  dlg.innerHTML = `<div class="mh"><div class="mt"><h2>Overdue Information</h2><button class="ghost" data-x>Close</button></div>
    <div class="nm">${esc(o['Member Name'])}</div><div class="ac">${esc(o['Account Name'])} <span class="b ${o.Status === 'Disconnect' ? '' : 'i'}">${esc(o.Status)}</span></div>
    <div class="sumwrap"><table class="sum"><thead><tr>${sum.map(s => `<th>${s[0]}</th>`).join('')}</tr></thead><tbody><tr>${sum.map(s => `<td>${esc(s[1]) || '\u2014'}</td>`).join('')}</tr></tbody></table></div></div>
    <div class="dbody"><div id="oAct"></div>
    <section class="grp"><h3>Record</h3><dl>${row('Status', o.Status)}${row('Remarks', o.Remarks)}${row('Date', o.Date)}${row('Record Created', o.Timestamp)}</dl></section>
    <section class="grp"><h3>Service</h3><dl>${row('Disconnection Stamp', oShow(o, 'Disconnection Stamp'))}${row('Reconnection Stamp', oShow(o, 'Reconnection Stamp'))}${row('MOP', o.MOP)}${row('Location', o.Location)}${row('Receiver', o.Receiver)}${row('Notes', o.Notes)}</dl></section>
    <section class="grp"><h3>Modem</h3><dl>${row('Modem Status', mod)}${row('Remaining Days', o._rem)}${row('For Claim', o._fc)}${row('Claimed Date', o['Claimed Date'])}${row('Reason', o.Reason)}</dl></section></div>
    <div class="mf"><button class="ghost danger" id="oDel">Delete</button><span class="ferr" id="oMsg"></span><span class="grow"></span>${btn}</div>`;
  const g = s => dlg.querySelector(s), msg = t => { g('#oMsg').textContent = t; }, on = (s, fn) => { const e = g(s); if (e) e.onclick = fn; };
  const panel = (title, html, ok) => {
    g('#oAct').innerHTML = `<section class="grp"><h3>${title}</h3><div class="form">${html}</div><div class="pact"><button class="ghost" id="oNo">Cancel</button><button class="solid" id="oOk">Confirm</button></div></section>`;
    g('#oNo').onclick = () => { g('#oAct').innerHTML = ''; msg(''); }; g('#oOk').onclick = ok; msg('');
  };
  const run = async fn => {
    const bs = dlg.querySelectorAll('button'); bs.forEach(b => b.disabled = true); msg('Saving\u2026');
    try { await fn(); dlg.close(); loadOv(true); } catch (e) { msg(e.message === 'cancelled' ? '' : e.message); bs.forEach(b => b.disabled = false); }
  };
  on('#oDisc', () => panel('Disconnect', '<p class="hint">The Disconnection Stamp will be set to the current time.</p>', () => run(() => API.post('disconnectOverdue', { id: o.ID }))));
  on('#oRec', () => {
    const dl = (id, k) => `<datalist id="${id}">${[...new Set(O.data.map(x => x[k]).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
    panel(dis ? 'Reconnect' : 'Mark as Paid', `<label>MOP<select id="oMop"><option>CASH</option><option>GCASH</option></select></label>
      <label class="cashf">Location <b class="req">*</b><input id="oLoc" list="oLocs" autocomplete="off">${dl('oLocs', 'Location')}</label>
      <label class="cashf">Receiver <b class="req">*</b><input id="oRcv" list="oRcvs" autocomplete="off">${dl('oRcvs', 'Receiver')}</label>`, () => {
      const mop = g('#oMop').value, location = g('#oLoc').value.trim(), receiver = g('#oRcv').value.trim();
      if (mop === 'CASH' && (!location || !receiver)) return msg('Location and Receiver are required for CASH');
      run(() => API.post('reconnectOverdue', { id: o.ID, mop, location, receiver }));
    });
    const tog = () => g('#oAct').querySelectorAll('.cashf').forEach(l => l.hidden = g('#oMop').value !== 'CASH');
    g('#oMop').onchange = tog; tog();
  });
  on('#oClaim', () => panel('Modem Claimed', '<p class="hint">Mark the modem as CLAIMED. The Claimed Date will be set to the current time.</p>', () => run(() => API.post('modemOverdue', { id: o.ID, result: 'CLAIMED' }))));
  on('#oUnable', () => panel('Unable to Claim', '<label class="wide">Reason <b class="req">*</b><input id="oReason" autocomplete="off"></label>', () => {
    const reason = g('#oReason').value.trim(); if (!reason) { g('#oReason').classList.add('invalid'); return msg('Reason is required'); }
    run(() => API.post('modemOverdue', { id: o.ID, result: 'UNABLE TO CLAIM', reason }));
  }));
  on('#oDel', e => {
    const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Click again to confirm'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Delete'; }, 4000); return; }
    run(() => API.post('deleteOverdue', { id: o.ID }));
  });
  dlg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => dlg.close());
  dlg.showModal();
}

async function openOvAdd() {
  const dlg = $('#oadd'); let pick = null;
  const head = '<div class="mh"><div class="mt"><h2>Add Overdue</h2></div>';
  const wire = () => dlg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => dlg.close());
  dlg.innerHTML = head + '<div class="ac">Please wait, gathering data\u2026</div></div><div class="mf"><span class="grow"></span><button class="ghost" data-x>Close</button></div>'; wire();
  dlg.showModal();
  if (!S.all.length) { try { await loadDB(); } catch (e) { /* shown below */ } }
  const now = new Date(), pm = now.getDate() <= 10 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now; // Atrenta records are made on the 5th-7th for last month
  const rems = Object.entries(O.data.reduce((m, o) => (o.Remarks && (m[o.Remarks] = (m[o.Remarks] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
  dlg.innerHTML = head + `<div class="msearch"><input id="mq" type="search" placeholder="Search member by name or account number" autocomplete="off"><div class="ares" id="mres"></div></div></div>
    <div class="dbody"><section class="grp"><h3>Member</h3><dl id="mDl"></dl></section>
    <section class="grp"><h3>Overdue</h3><div class="form">
      <label>Month<select id="mMonth">${MONTHS.map(m => `<option${m === MONTHS[pm.getMonth()] ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      <label>Year<input id="mYear" type="number" value="${pm.getFullYear()}"></label>
      <label>Status<select id="mStatus"><option>Disconnect</option><option>Extended</option></select></label>
      <label id="mDateL" hidden>Extension Date <b class="req">*</b><input id="mDate" type="date"></label>
      <label id="mRemL" class="wide" hidden>Remarks <b class="req">*</b><input id="mRem" list="mRems" autocomplete="off"><datalist id="mRems">${rems.map(r => `<option value="${esc(r)}">`).join('')}</datalist></label></div></section></div>
    <div class="mf"><span class="ferr" id="mMsg"></span><span class="grow"></span><button class="ghost" data-x>Close</button><button class="ghost" id="mMore">Save and add another</button><button class="solid" id="mSave">Save</button></div>`;
  wire();
  const g = s => dlg.querySelector(s), msg = (t, ok) => { const m = g('#mMsg'); m.textContent = t; m.classList.toggle('ok', !!ok); };
  const dup = () => pick && O.data.find(x => x['Account #'] === pick['Account Number'] && x.Month === g('#mMonth').value && x.Year === g('#mYear').value.trim());
  const check = () => { const d = dup(); msg(d ? `Already recorded: ${d.Month} ${d.Year} (${d.Status}, ${d.Gamot === 'TRUE' ? 'paid' : 'unpaid'})` : ''); };
  const show = () => { g('#mDl').innerHTML = [['Fullname', pick && pick['Member Name']], ['Account Number', pick && pick['Account Number']], ['PPPoE Name', pick && pick['PPPoE Name']], ['Due Date', pick ? 'Auto (from latest payment)' : '']]
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '\u2014')}</dd>`).join(''); check(); };
  g('#mStatus').onchange = () => { const e = g('#mStatus').value === 'Extended'; g('#mDateL').hidden = g('#mRemL').hidden = !e; };
  ['#mMonth', '#mYear'].forEach(s => g(s).oninput = check);
  g('#mRem').oninput = () => g('#mRem').classList.remove('invalid'); g('#mDate').oninput = () => g('#mDate').classList.remove('invalid');
  g('#mq').oninput = e => {
    const q = norm(e.target.value.trim()); if (!q) { g('#mres').innerHTML = ''; return; }
    const hits = S.all.filter(o => (o._n || (o._n = norm(o['Member Name'] + ' ' + o['Account Number']))).includes(q)).slice(0, 8);
    g('#mres').innerHTML = hits.length ? hits.map(o => `<button data-a="${esc(o['Account Number'])}"><b>${esc(o['Member Name'])}</b><span>${esc(o['Account Number'])}</span><i class="b ${o.Status === 'Active' ? '' : 'i'}">${esc(o.Status)}</i></button>`).join('') : '<p>No member found</p>';
  };
  g('#mq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); g('#mres button')?.click(); } };
  g('#mres').onclick = e => { const b = e.target.closest('button'); if (b) { pick = S.all.find(o => o['Account Number'] === b.dataset.a); g('#mq').value = ''; g('#mres').innerHTML = ''; show(); } };
  const save = async again => {
    if (!pick) return msg('Select a member first');
    const v = { month: g('#mMonth').value, year: g('#mYear').value.trim(), status: g('#mStatus').value, remarks: g('#mRem').value.trim(), date: mdy(g('#mDate').value) }, ext = v.status === 'Extended';
    if (!/^\d{4}$/.test(v.year)) return msg('Enter a valid Year');
    if (ext && !v.remarks) { g('#mRem').classList.add('invalid'); g('#mRem').focus(); return msg('Remarks is required for Extended'); }
    if (ext && !v.date) { g('#mDate').classList.add('invalid'); return msg('Extension Date is required for Extended'); }
    if (dup()) return check();
    g('#mSave').disabled = g('#mMore').disabled = true; msg('Saving\u2026', true);
    try {
      await API.post('addOverdue', { account: pick['Account Number'], ...v });
      const nm = pick['Member Name']; await loadOv(true);
      if (again) { pick = null; g('#mRem').value = ''; show(); msg(`Saved: ${nm}`, true); g('#mq').focus(); } else dlg.close();
    } catch (e) { msg(e.message === 'cancelled' ? '' : e.message); }
    g('#mSave').disabled = g('#mMore').disabled = false;
  };
  g('#mSave').onclick = () => save(false); g('#mMore').onclick = () => save(true);
  show(); g('#mq').focus();
}

$('#oTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; O.tab = b.dataset.t; O.page = 1; O.f = {}; fillOF(); renderOv(); };
$('#oq').oninput = e => { O.q = e.target.value; O.page = 1; renderOv(); };
$('#oFilters').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'oClear') { O.q = ''; O.f = {}; O.key = 'recent'; O.dir = -1; O.page = 1; $('#oq').value = ''; }
  else if (b.id === 'oRefresh') { loadOv(); return; }
  else { O.f[b.parentElement.dataset.k] = b.dataset.v; O.page = 1; }
  fillOF(); renderOv();
};
$('#oFilters').onchange = e => { const s = e.target.closest('select'); if (!s) return; O.f[s.dataset.k] = s.value; O.page = 1; fillOF(); renderOv(); };
$('#oHead').onclick = e => { const k = e.target.closest('th')?.dataset.k; if (!k) return; O.dir = O.key === k ? -O.dir : 1; O.key = k; renderOv(); };
$('#oPager').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { O.page = +b.dataset.p; renderOv(); } };
$('#oSize').onchange = e => { O.size = +e.target.value; O.page = 1; renderOv(); };
$('#oBody').onclick = e => { const tr = e.target.closest('tr[data-i]'); if (tr) openOv(O.cur[+tr.dataset.i]); };
$('#oAdd').onclick = openOvAdd;
$('#odetail').onclick = e => { if (e.target === $('#odetail')) $('#odetail').close(); };
$('#oadd').onclick = e => { if (e.target === $('#oadd')) $('#oadd').close(); };
