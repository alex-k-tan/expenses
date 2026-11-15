/**
 * Expenses app <-> Google Sheet sync.
 * Paste this whole file into Extensions > Apps Script of your Google Sheet.
 * Change SECRET below to any password-like phrase, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Put the web app URL and the same SECRET into the app.
 */
const SECRET = 'change-me-to-something-only-you-know';

const EXP = 'Expenses', REIMB = 'Reimbursements', SET = 'Settings';
const EXP_HEAD = ['Date', 'Time', 'Amount', 'Description', 'Category', 'Reimbursable', 'Reimbursed on', 'id', 'ts', 'batch', 'updated', 'deleted'];
const REIMB_HEAD = ['Paid on', 'Expenses', 'Total', 'id', 'created', 'updated', 'deleted'];
const SET_HEAD = ['key', 'value', 'updated'];

function doGet() {
  return json({ ok: true, app: 'expenses-sync', hint: 'This link is for the Expenses app. Paste it into the app.' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad request' }); }
  if (body.secret !== SECRET) return json({ ok: false, error: 'wrong secret' });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    mergeEntries(ss.getSheetByName(EXP), body.entries || []);
    mergeBatches(ss.getSheetByName(REIMB), body.batches || []);
    if (body.settings) mergeSettings(ss.getSheetByName(SET), body.settings);
    SpreadsheetApp.flush();
    return json({ ok: true, entries: readEntries(ss), batches: readBatches(ss), settings: readSettings(ss), serverTime: Date.now() });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- sheets ---------- */
function ensureSheets(ss) {
  const make = (name, head, textCols) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      sh.setFrozenRows(1);
      textCols.forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
    }
    return sh;
  };
  const exp = make(EXP, EXP_HEAD, [1, 2, 7, 8, 10]);
  if (exp.getLastRow() <= 1 && ss.getSheets()[0].getName() !== EXP) ss.setActiveSheet(exp), ss.moveActiveSheet(1);
  make(REIMB, REIMB_HEAD, [1, 4]);
  make(SET, SET_HEAD, [1, 2]);
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(s1);
}

function rowsOf(sh, width) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
}

function indexById(rows, idCol) {
  const m = {};
  rows.forEach((r, i) => { if (r[idCol]) m[String(r[idCol])] = i; });
  return m;
}

function writeRows(sh, rows, updates, appends, width) {
  updates.forEach(([i, row]) => sh.getRange(i + 2, 1, 1, width).setValues([row]));
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, width).setValues(appends);
}

function styleDeleted(sh, rowIndex, deleted, width) {
  const r = sh.getRange(rowIndex + 2, 1, 1, width);
  r.setFontLine(deleted ? 'line-through' : 'none').setFontColor(deleted ? '#999999' : null);
}

/* ---------- expenses ---------- */
function mergeEntries(sh, incoming) {
  const W = EXP_HEAD.length, rows = rowsOf(sh, W), idx = indexById(rows, 7);
  const updates = [], appends = [], styles = [];
  incoming.forEach(x => {
    const i = idx[x.id];
    const cur = i === undefined ? 0 : Number(rows[i][10]) || 0;
    if (i !== undefined && cur >= x.updated) return;
    const row = x.deleted && i !== undefined
      ? rows[i].slice(0, 10).concat([x.updated, true])
      : [x.date || '', x.time || '', x.amount || 0, x.desc || '', x.cat || '', x.reimbursable === false ? 'No' : 'Yes',
         x.reimbursedOn || '', x.id, x.ts || '', x.batch || '', x.updated, !!x.deleted];
    if (i === undefined) appends.push(row); else { updates.push([i, row]); styles.push([i, !!x.deleted]); }
  });
  writeRows(sh, rows, updates, appends, W);
  styles.forEach(([i, d]) => styleDeleted(sh, i, d, W));
  if (appends.length) {
    appends.forEach((r, k) => { if (r[11]) styleDeleted(sh, rows.length + k, true, W); });
  }
}

function readEntries(ss) {
  const sh = ss.getSheetByName(EXP), W = EXP_HEAD.length, rows = rowsOf(sh, W), tz = ss.getSpreadsheetTimeZone();
  const out = [];
  rows.forEach((r, i) => {
    if (!r[7]) {
      // A row typed in by hand: give it an id so the app picks it up.
      if (r[2] === '' || r[2] === null) return;
      r[7] = Utilities.getUuid().slice(0, 12);
      r[8] = tsFrom(r[0], r[1], tz) || Date.now();
      r[10] = Date.now(); r[11] = false;
      if (!r[5]) r[5] = 'Yes';
      sh.getRange(i + 2, 1, 1, W).setValues([r]);
    }
    out.push({
      id: String(r[7]), ts: Number(r[8]) || tsFrom(r[0], r[1], tz) || 0, amount: Number(r[2]) || 0,
      desc: String(r[3]), cat: String(r[4] || 'Other'),
      reimbursable: String(r[5]).toLowerCase() !== 'no', reimbursedOn: dateStr(r[6], tz) || null,
      batch: r[9] ? String(r[9]) : null, updated: Number(r[10]) || 0, deleted: r[11] === true || String(r[11]).toUpperCase() === 'TRUE'
    });
  });
  return out;
}

/* ---------- reimbursements ---------- */
function mergeBatches(sh, incoming) {
  const W = REIMB_HEAD.length, rows = rowsOf(sh, W), idx = indexById(rows, 3);
  const updates = [], appends = [], styles = [];
  incoming.forEach(b => {
    const i = idx[b.id];
    const cur = i === undefined ? 0 : Number(rows[i][5]) || 0;
    if (i !== undefined && cur >= b.updated) return;
    const row = b.deleted && i !== undefined
      ? rows[i].slice(0, 5).concat([b.updated, true])
      : [b.date || '', b.count || 0, b.total || 0, b.id, b.created || '', b.updated, !!b.deleted];
    if (i === undefined) appends.push(row); else { updates.push([i, row]); styles.push([i, !!b.deleted]); }
  });
  writeRows(sh, rows, updates, appends, W);
  styles.forEach(([i, d]) => styleDeleted(sh, i, d, W));
}

function readBatches(ss) {
  const sh = ss.getSheetByName(REIMB), tz = ss.getSpreadsheetTimeZone();
  return rowsOf(sh, REIMB_HEAD.length).filter(r => r[3]).map(r => ({
    id: String(r[3]), date: dateStr(r[0], tz), count: Number(r[1]) || 0, total: Number(r[2]) || 0,
    created: Number(r[4]) || 0, updated: Number(r[5]) || 0, deleted: r[6] === true || String(r[6]).toUpperCase() === 'TRUE'
  }));
}

/* ---------- settings (currency, categories, learned words) ---------- */
function mergeSettings(sh, s) {
  const rows = rowsOf(sh, 3), i = rows.findIndex(r => r[0] === 'settings');
  if (i >= 0 && Number(rows[i][2]) >= s.updated) return;
  const row = ['settings', JSON.stringify(s.value), s.updated];
  if (i >= 0) sh.getRange(i + 2, 1, 1, 3).setValues([row]); else sh.appendRow(row);
}

function readSettings(ss) {
  const r = rowsOf(ss.getSheetByName(SET), 3).find(r => r[0] === 'settings');
  if (!r) return null;
  try { return { value: JSON.parse(r[1]), updated: Number(r[2]) || 0 }; } catch (e) { return null; }
}

/* ---------- edits made directly in the sheet ---------- */
// Runs automatically when you edit a cell, so the app sees your change on its next sync.
function onEdit(e) {
  const sh = e.range.getSheet(), name = sh.getName();
  if (e.range.getRow() < 2) return;
  const tz = e.source.getSpreadsheetTimeZone(), now = Date.now();
  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (name === EXP) {
      const v = sh.getRange(r, 1, 1, EXP_HEAD.length).getValues()[0];
      if (!v[7]) continue; // new hand-typed rows get an id on the next sync
      sh.getRange(r, 11).setValue(now);
      const c1 = e.range.getColumn(), c2 = e.range.getLastColumn();
      if (c1 <= 2 && c2 >= 1) { const ts = tsFrom(v[0], v[1], tz); if (ts) sh.getRange(r, 9).setValue(ts); }
    } else if (name === REIMB) {
      if (sh.getRange(r, 4).getValue()) sh.getRange(r, 6).setValue(now);
    }
  }
}

/* ---------- helpers ---------- */
function dateStr(v, tz) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v).trim();
}
function tsFrom(d, t, tz) {
  const ds = dateStr(d, tz);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return 0;
  let ts = t instanceof Date ? Utilities.formatDate(t, tz, 'HH:mm') : String(t || '12:00').trim();
  if (!/^\d{1,2}:\d{2}$/.test(ts)) ts = '12:00';
  return Utilities.parseDate(ds + ' ' + ts, tz, 'yyyy-MM-dd HH:mm').getTime();
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
