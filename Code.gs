/* SETUP
 1. script.new -> paste this file as Code.gs
 2. Project Settings -> Script properties -> add ACCESS_KEY = (your secret key)
 3. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone -> copy the /exec URL into config.js
 4. After editing this file: Deploy -> Manage deployments -> Edit -> New version
 The first deploy asks you to authorize access to your Google Sheets. */
const DB_ID = '14LhxikZ5asjSgE25jCPZIP2ziwwaWRp5Y5Nb0fRDT34';
const DB_TAB = 'DATABASE_RAW';

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.key !== PropertiesService.getScriptProperties().getProperty('ACCESS_KEY')) return out({ ok: false, error: 'auth' });
    if (p.action === 'customers') return out(getCustomers());
    return out({ ok: false, error: 'unknown action' });
  } catch (err) { return out({ ok: false, error: String(err) }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Read-only. Display values keep Account Number exactly as typed in the sheet (text).
function getCustomers() {
  const v = SpreadsheetApp.openById(DB_ID).getSheetByName(DB_TAB).getDataRange().getDisplayValues();
  const headers = v.shift().map(h => String(h).trim());
  const s = headers.indexOf('Status');
  const rows = v.filter(r => ['Active', 'Inactive'].indexOf(String(r[s]).trim()) > -1)
                .map(r => r.map(c => String(c).trim()));
  return { ok: true, headers: headers, rows: rows, updated: new Date().toISOString() };
}
