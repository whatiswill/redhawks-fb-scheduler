/**
 * RedHawks F&B Scheduler
 * Paste this whole file into Extensions > Apps Script, save, then reload the sheet.
 * A "RedHawks Scheduler" menu appears next to Help.
 *
 * Tabs it expects (rows line up by position):
 *   Staff        row 2+ : Name | Group | Home spot | Locked to home spot | Can work | Won't work | Prefers | Phone | Email | Notes
 *   Spots        row 2+ : Spot | Area | Role needed | Staff needed | When (Every game / Party deck)
 *   Games        row 2+ : Date | First pitch | Staff report | Opponent / promotion
 *   Availability row 2+ : one row per Staff row, game columns start at D, Y or N
 *   Schedule     rows 6-8 party decks (type the group name when a deck sells), row 9 open spots,
 *                row 11+ one row per Staff row, game columns start at D
 */

var CFG = {
  FIRST_GAME_COL: 4,      // column D
  SCHED_FIRST_STAFF_ROW: 11,
  SCHED_DECK_ROWS: [6, 7, 8],
  SCHED_OPEN_ROW: 9,
  AVAIL_FIRST_ROW: 2,
  ASKED_PREFIX: '? ',
  OFF: 'OFF'
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('RedHawks Scheduler')
    .addItem('Auto-fill selected game(s)', 'menuAutoFillSelected')
    .addItem('Auto-fill all games', 'menuAutoFillAll')
    .addSeparator()
    .addItem('Find replacement for selected cell', 'menuFindReplacement')
    .addItem('Mark selected as confirmed', 'menuConfirmSelected')
    .addItem('Clear selected game(s)', 'menuClearSelected')
    .addSeparator()
    .addItem('Check for problems', 'menuCheckProblems')
    .addSeparator()
    .addItem('Create availability form', 'menuCreateForm')
    .addItem('Import form responses', 'menuImportResponses')
    .addSeparator()
    .addItem('Add rows for new staff', 'menuSyncRows')
    .addItem('Set admin PIN for the web app', 'menuSetPin')
    .addToUi();
}

/* ---------- pure logic (no Google calls, so it can be tested anywhere) ---------- */

function splitList_(s) {
  return String(s || '').split(/[,;\n]/).map(function (x) { return x.trim().toLowerCase(); }).filter(String);
}

function splitRaw_(s) {
  return String(s || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(String);
}

function spotOf_(cell) {
  var v = String(cell || '').trim();
  if (v.indexOf(CFG.ASKED_PREFIX.trim()) === 0) v = v.substring(1).trim();
  return v;
}

function isWorking_(cell) {
  var v = String(cell || '').trim();
  return v !== '' && v.toUpperCase() !== CFG.OFF;
}

/**
 * model = {
 *   staff: [{name, group, home, locked, roles[], wont[], prefers[]}],
 *   spots: [{name, role, need, deck}],
 *   grid:  [staffIdx][gameIdx] cell strings,
 *   avail: [staffIdx][gameIdx] 'Y' | 'N' | '',
 *   decks: {deckSpotName(lower): [gameIdx] string}   // non-empty = sold
 * }
 */
function neededSpots_(model, g) {
  return model.spots.filter(function (sp) {
    if (!sp.deck) return true;
    var row = model.decks[sp.name.toLowerCase()];
    return row && String(row[g] || '').trim() !== '';
  });
}

function seasonCounts_(model) {
  return model.grid.map(function (row) {
    return row.filter(isWorking_).length;
  });
}

function filledCount_(model, g, spotName) {
  var key = spotName.toLowerCase(), n = 0;
  for (var i = 0; i < model.staff.length; i++) {
    if (spotOf_(model.grid[i][g]).toLowerCase() === key) n++;
  }
  return n;
}

function canWork_(model, i, g, sp) {
  var p = model.staff[i];
  if (String(model.avail[i][g] || '').toUpperCase() !== 'Y') return false;
  if (String(model.grid[i][g] || '').trim() !== '') return false;
  if (p.locked && p.home.toLowerCase() !== sp.name.toLowerCase()) return false;
  if (p.wont.indexOf(sp.name.toLowerCase()) >= 0) return false;
  if (p.home.toLowerCase() === sp.name.toLowerCase()) return true;
  return p.roles.indexOf(String(sp.role).toLowerCase()) >= 0;
}

/** Ranked candidates for one spot in one game. */
function candidates_(model, g, sp, counts) {
  counts = counts || seasonCounts_(model);
  var out = [];
  for (var i = 0; i < model.staff.length; i++) {
    if (!canWork_(model, i, g, sp)) continue;
    var p = model.staff[i];
    var score = 0, why = [];
    if (p.prefers.indexOf(sp.name.toLowerCase()) >= 0) { score += 100; why.push('prefers it'); }
    if (p.home.toLowerCase() === sp.name.toLowerCase()) { score += 50; why.push('home spot'); }
    if (!p.home) { score += 10; why.push('alternate'); }
    score -= counts[i] * 2;
    why.push(counts[i] + ' games so far');
    out.push({ idx: i, name: p.name, score: score, why: why.join(', ') });
  }
  out.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name); });
  return out;
}

/** Fills empty cells for one game. Never touches a cell that already has something in it. */
function autoFillGame_(model, g, counts) {
  counts = counts || seasonCounts_(model);
  var need = neededSpots_(model, g);
  var placed = [];
  function room(sp) { return sp.need - filledCount_(model, g, sp.name); }
  function put(i, sp) {
    model.grid[i][g] = sp.name; counts[i]++; placed.push({ idx: i, spot: sp.name });
  }
  var byName = {};
  need.forEach(function (sp) { byName[sp.name.toLowerCase()] = sp; });

  // 1. people locked to their stand, 2. everyone else with a home spot
  [true, false].forEach(function (lockedPass) {
    model.staff.forEach(function (p, i) {
      if (!!p.locked !== lockedPass || !p.home) return;
      var sp = byName[p.home.toLowerCase()];
      if (sp && room(sp) > 0 && canWork_(model, i, g, sp)) put(i, sp);
    });
  });
  // 3. fill what's left: always the spot with the fewest possible people first,
  //    so someone who can work a hard-to-fill spot isn't used up on an easy one
  while (true) {
    var best = null;
    for (var k = 0; k < need.length; k++) {
      if (room(need[k]) <= 0) continue;
      var c = candidates_(model, g, need[k], counts);
      if (c.length && (!best || c.length < best.c.length)) best = { sp: need[k], c: c };
    }
    if (!best) break;
    put(best.c[0].idx, best.sp);
  }
  var open = need.filter(function (sp) { return room(sp) > 0; })
    .map(function (sp) { var r = room(sp); return r > 1 ? sp.name + ' x' + r : sp.name; });
  return { placed: placed, open: open };
}

function openSpots_(model, g) {
  return neededSpots_(model, g).filter(function (sp) {
    return sp.need - filledCount_(model, g, sp.name) > 0;
  }).map(function (sp) {
    var r = sp.need - filledCount_(model, g, sp.name);
    return r > 1 ? sp.name + ' x' + r : sp.name;
  });
}

function problems_(model, gameLabels) {
  var out = [];
  var known = {};
  model.spots.forEach(function (sp) { known[sp.name.toLowerCase()] = sp; });
  for (var g = 0; g < gameLabels.length; g++) {
    var need = {};
    neededSpots_(model, g).forEach(function (sp) { need[sp.name.toLowerCase()] = sp; });
    model.staff.forEach(function (p, i) {
      var cell = model.grid[i][g];
      if (!isWorking_(cell)) return;
      var s = spotOf_(cell).toLowerCase();
      var lbl = gameLabels[g] + ': ' + p.name;
      if (String(model.avail[i][g]).toUpperCase() === 'N') out.push(lbl + ' is scheduled but said they are not available.');
      if (p.wont.indexOf(s) >= 0) out.push(lbl + ' is at ' + spotOf_(cell) + ', a spot they won\'t work.');
      if (p.locked && s !== p.home.toLowerCase()) out.push(lbl + ' only works ' + p.home + ' but is at ' + spotOf_(cell) + '.');
      if (!known[s]) out.push(lbl + ' has "' + cell + '", which is not on the Spots tab.');
      else if (known[s].deck && !need[s]) out.push(lbl + ' is at ' + spotOf_(cell) + ', but that deck is not sold for this game.');
    });
    Object.keys(need).forEach(function (k) {
      var n = filledCount_(model, g, need[k].name);
      if (n > need[k].need) out.push(gameLabels[g] + ': ' + need[k].name + ' has ' + n + ' people for ' + need[k].need + ' spot(s).');
    });
  }
  return out;
}

/* ---------- reading and writing the sheet ---------- */

// If you copy this sheet, the copy's script finds its own sheet automatically.
var SHEET_ID = '1g__pB_WyjE1m87DZCNbBPAfpec0wlyEHbABRBUwLDFE';
function ss_() { return SpreadsheetApp.getActive() || SpreadsheetApp.openById(SHEET_ID); }

function load_() {
  var ss = ss_();
  var staffSh = ss.getSheetByName('Staff');
  var lastStaff = lastRowIn_(staffSh, 1);
  var staffVals = lastStaff >= 2 ? staffSh.getRange(2, 1, lastStaff - 1, 10).getValues() : [];
  var staff = staffVals.map(function (r) {
    return {
      name: String(r[0]).trim(), group: String(r[1]).trim(), home: String(r[2]).trim(),
      locked: /^y/i.test(String(r[3])), roles: splitList_(r[4]), wont: splitList_(r[5]),
      prefers: splitList_(r[6]), phone: r[7], email: r[8],
      rawRoles: splitRaw_(r[4]), rawWont: splitRaw_(r[5]), rawPrefers: splitRaw_(r[6])
    };
  });

  var spotSh = ss.getSheetByName('Spots');
  var lastSpot = lastRowIn_(spotSh, 1);
  var spots = (lastSpot >= 2 ? spotSh.getRange(2, 1, lastSpot - 1, 5).getValues() : [])
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) {
      return { name: String(r[0]).trim(), role: String(r[2]).trim(), need: Number(r[3]) || 1, deck: /deck/i.test(String(r[4])) };
    });

  var gamesSh = ss.getSheetByName('Games');
  var nGames = Math.max(0, lastRowIn_(gamesSh, 1) - 1);
  var gameRows = nGames ? gamesSh.getRange(2, 1, nGames, 4).getDisplayValues() : [];
  var labels = gameRows.map(function (r) { return String(r[0]).replace(/\/\d{4}$/, ''); });
  var sched = ss.getSheetByName('Schedule');
  var avail = ss.getSheetByName('Availability');
  var n = staff.length;
  var grid = n && nGames ? sched.getRange(CFG.SCHED_FIRST_STAFF_ROW, CFG.FIRST_GAME_COL, n, nGames).getDisplayValues() : [];
  var av = n && nGames ? avail.getRange(CFG.AVAIL_FIRST_ROW, CFG.FIRST_GAME_COL, n, nGames).getDisplayValues() : [];
  var deckRows = sched.getRange(CFG.SCHED_DECK_ROWS[0], 3, CFG.SCHED_DECK_ROWS.length, nGames + 1).getDisplayValues();
  var decks = {};
  deckRows.forEach(function (r) { if (String(r[0]).trim()) decks[String(r[0]).trim().toLowerCase()] = r.slice(1); });

  return { staff: staff, spots: spots, grid: grid, avail: av, decks: decks, labels: labels, nGames: nGames, gameRows: gameRows };
}

function lastRowIn_(sh, col) {
  var vals = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var r = vals.length - 1; r >= 0; r--) if (String(vals[r][0]).trim() !== '') return r + 1;
  return 0;
}

function saveGames_(model, gs) {
  var sched = ss_().getSheetByName('Schedule');
  if (!model.grid.length || !gs.length) return;
  if (gs.length > 3) {
    // many games: one write for the whole grid and one for the open-spots row
    sched.getRange(CFG.SCHED_FIRST_STAFF_ROW, CFG.FIRST_GAME_COL, model.grid.length, model.nGames).setValues(model.grid);
    var row = [];
    for (var g = 0; g < model.nGames; g++) {
      var o = openSpots_(model, g);
      row.push(o.length ? o.length + ' open: ' + o.join(', ') : 'All filled');
    }
    sched.getRange(CFG.SCHED_OPEN_ROW, CFG.FIRST_GAME_COL, 1, model.nGames).setValues([row]);
    return;
  }
  gs.forEach(function (g) {
    var col = model.grid.map(function (r) { return [r[g]]; });
    sched.getRange(CFG.SCHED_FIRST_STAFF_ROW, CFG.FIRST_GAME_COL + g, col.length, 1).setValues(col);
    var open = openSpots_(model, g);
    sched.getRange(CFG.SCHED_OPEN_ROW, CFG.FIRST_GAME_COL + g)
      .setValue(open.length ? open.length + ' open: ' + open.join(', ') : 'All filled');
  });
}

function selectedGames_(model) {
  var sh = ss_().getActiveSheet();
  if (sh.getName() !== 'Schedule') throw new Error('Go to the Schedule tab and select a cell in the game column(s) first.');
  var r = sh.getActiveRange();
  var gs = [];
  for (var c = r.getColumn(); c < r.getColumn() + r.getNumColumns(); c++) {
    var g = c - CFG.FIRST_GAME_COL;
    if (g >= 0 && g < model.nGames) gs.push(g);
  }
  if (!gs.length) throw new Error('Select a cell in a game column (column D or to the right).');
  return gs;
}

/* ---------- menu actions ---------- */

function menuAutoFillSelected() { runSafely_(function () {
  var m = load_(); var gs = selectedGames_(m); autoFill_(m, gs);
}); }

function menuAutoFillAll() { runSafely_(function () {
  var m = load_(); var gs = []; for (var g = 0; g < m.nGames; g++) gs.push(g); autoFill_(m, gs);
}); }

function autoFill_(m, gs) {
  var counts = seasonCounts_(m), placed = 0, openGames = 0;
  gs.forEach(function (g) {
    var res = autoFillGame_(m, g, counts);
    placed += res.placed.length;
    if (res.open.length) openGames++;
  });
  saveGames_(m, gs);
  ss_().toast(placed + ' shifts placed across ' + gs.length + ' game(s). ' +
    (openGames ? openGames + ' game(s) still have open spots (see row 9).' : 'Every spot is filled.'), 'Auto-fill', 8);
}

function menuClearSelected() { runSafely_(function () {
  var m = load_(); var gs = selectedGames_(m);
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear ' + gs.length + ' game(s)?', 'This empties every staff cell in the selected game column(s). Party deck rows stay.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  gs.forEach(function (g) { m.grid.forEach(function (row) { row[g] = ''; }); });
  saveGames_(m, gs);
}); }

function menuFindReplacement() { runSafely_(function () {
  var m = load_();
  var ui = SpreadsheetApp.getUi();
  var sh = ss_().getActiveSheet();
  var cell = sh.getActiveCell();
  var g = cell.getColumn() - CFG.FIRST_GAME_COL;
  var i = cell.getRow() - CFG.SCHED_FIRST_STAFF_ROW;
  if (sh.getName() !== 'Schedule' || g < 0 || g >= m.nGames || i < 0 || i >= m.staff.length) {
    throw new Error('Select the cell of the person who dropped (on the Schedule tab).');
  }
  var spotName = spotOf_(m.grid[i][g]);
  if (!spotName || spotName.toUpperCase() === CFG.OFF) {
    var resp = ui.prompt('Which spot needs filling?', 'Type the spot name exactly as it appears on the Spots tab.', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    spotName = resp.getResponseText().trim();
  }
  var sp = m.spots.filter(function (s) { return s.name.toLowerCase() === spotName.toLowerCase(); })[0];
  if (!sp) throw new Error('"' + spotName + '" is not on the Spots tab.');

  var dropped = m.staff[i];
  var hadIt = spotOf_(m.grid[i][g]).toLowerCase() === sp.name.toLowerCase();
  if (hadIt) { m.grid[i][g] = ''; m.avail[i][g] = 'N'; }
  var c = candidates_(m, g, sp).slice(0, 9);
  if (!c.length) { ui.alert('Nobody is free for ' + sp.name + ' on ' + m.labels[g] + '.', 'Everyone who can work it is either unavailable, already placed, or has it as a no-go spot.', ui.ButtonSet.OK); return; }
  var list = c.map(function (x, k) {
    var p = m.staff[x.idx];
    return (k + 1) + '. ' + x.name + '  (' + x.why + ')' + (p.phone ? '  ' + p.phone : '');
  }).join('\n');
  var r = ui.prompt('Who should cover ' + sp.name + ' on ' + m.labels[g] + '?',
    (hadIt ? dropped.name + ' will be marked not available.\n\n' : '') + list + '\n\nType a number. They will show as Asked (blue) until you confirm.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pick = c[parseInt(r.getResponseText(), 10) - 1];
  if (!pick) throw new Error('That number is not on the list.');
  m.grid[pick.idx][g] = CFG.ASKED_PREFIX + sp.name;
  if (hadIt) {
    ss_().getSheetByName('Availability').getRange(CFG.AVAIL_FIRST_ROW + i, CFG.FIRST_GAME_COL + g).setValue('N');
  }
  saveGames_(m, [g]);
  ss_().toast(pick.name + ' asked to cover ' + sp.name + '. Use "Mark selected as confirmed" once they say yes.', 'Replacement', 8);
}); }

function menuConfirmSelected() { runSafely_(function () {
  var sh = ss_().getActiveSheet();
  if (sh.getName() !== 'Schedule') throw new Error('Select the blue cell(s) on the Schedule tab.');
  var r = sh.getActiveRange();
  var v = r.getValues(), n = 0;
  v = v.map(function (row) { return row.map(function (x) {
    var s = String(x);
    if (s.indexOf(CFG.ASKED_PREFIX.trim()) === 0) { n++; return spotOf_(s); }
    return x;
  }); });
  r.setValues(v);
  ss_().toast(n + ' shift(s) confirmed.', 'Confirmed', 5);
}); }

function menuCheckProblems() { runSafely_(function () {
  var m = load_();
  var p = problems_(m, m.labels);
  var ui = SpreadsheetApp.getUi();
  if (!p.length) { ui.alert('No problems found', 'Nobody is double-booked, scheduled while unavailable, or placed in a no-go spot.', ui.ButtonSet.OK); return; }
  var shown = p.slice(0, 25).join('\n');
  ui.alert(p.length + ' problem(s) found', shown + (p.length > 25 ? '\n\n...and ' + (p.length - 25) + ' more.' : ''), ui.ButtonSet.OK);
}); }

function menuSyncRows() { runSafely_(function () {
  var ss = ss_();
  var n = lastRowIn_(ss.getSheetByName('Staff'), 1) - 1;
  var sched = ss.getSheetByName('Schedule'), avail = ss.getSheetByName('Availability');
  for (var k = 0; k < n; k++) {
    var sr = k + 2;
    sched.getRange(CFG.SCHED_FIRST_STAFF_ROW + k, 1, 1, 3).setFormulas([['=Staff!B' + sr, '=Staff!A' + sr, '=Staff!C' + sr]]);
    avail.getRange(CFG.AVAIL_FIRST_ROW + k, 1, 1, 3).setFormulas([['=Staff!A' + sr, '=Staff!B' + sr, '=Staff!C' + sr]]);
  }
  ss.toast('Schedule and Availability now have a row for each of the ' + n + ' staff. Add new people at the bottom of Staff so existing rows stay lined up.', 'Rows', 8);
}); }

/* ---------- availability form ---------- */

function menuCreateForm() { runSafely_(function () {
  var m = load_();
  var ss = ss_();
  var form = FormApp.create('RedHawks Food & Beverage: Season Availability');
  form.setDescription('Pick every home game you can work. You can submit again later, and your newest answers replace the old ones.');
  form.addListItem().setTitle('Your name').setChoiceValues(m.staff.map(function (p) { return p.name; })).setRequired(true);
  form.addCheckboxItem().setTitle('Which home games can you work?').setChoiceValues(gameChoices_(m)).setRequired(true);
  var spotNames = uniq_(m.spots.map(function (s) { return s.name; }));
  form.addCheckboxItem().setTitle('Spots you would like to work').setChoiceValues(spotNames);
  form.addCheckboxItem().setTitle('Spots you will not work').setChoiceValues(spotNames);
  form.addParagraphTextItem().setTitle('Anything else we should know?');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  PropertiesService.getDocumentProperties().setProperty('FORM_ID', form.getId());
  SpreadsheetApp.getUi().alert('Form created',
    'Send this link to staff:\n' + form.getPublishedUrl() + '\n\nEdit the form here:\n' + form.getEditUrl() +
    '\n\nAnswers arrive in a new "Form Responses" tab. Run "Import form responses" to copy them into Availability and Staff.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}); }

function gameChoices_(m) {
  var gamesSh = ss_().getSheetByName('Games');
  var rows = gamesSh.getRange(2, 1, m.nGames, 4).getDisplayValues();
  return rows.map(function (r, g) { return m.labels[g] + ' ' + r[1] + ' ' + r[3] + ' #' + (g + 1); });
}

function uniq_(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }

function menuImportResponses() { runSafely_(function () {
  var ss = ss_();
  var resp = ss.getSheets().filter(function (s) { return /^Form Responses/.test(s.getName()); })[0];
  if (!resp) throw new Error('No "Form Responses" tab yet. Create the form first, and wait for at least one answer.');
  var data = resp.getDataRange().getValues();
  var head = data[0].map(String);
  function col(t) { for (var k = 0; k < head.length; k++) if (head[k].indexOf(t) === 0) return k; return -1; }
  var cName = col('Your name'), cGames = col('Which home games'), cPref = col('Spots you would like'), cWont = col('Spots you will not');
  var latest = {};
  for (var r = 1; r < data.length; r++) latest[String(data[r][cName]).trim()] = data[r];

  var m = load_();
  var staffSh = ss.getSheetByName('Staff'), avail = ss.getSheetByName('Availability');
  var updated = [];
  m.staff.forEach(function (p, i) {
    var row = latest[p.name];
    if (!row) return;
    var picked = {};
    String(row[cGames]).split(',').forEach(function (s) { var mm = s.match(/#(\d+)\s*$/); if (mm) picked[parseInt(mm[1], 10) - 1] = true; });
    var line = []; for (var g = 0; g < m.nGames; g++) line.push(picked[g] ? 'Y' : 'N');
    avail.getRange(CFG.AVAIL_FIRST_ROW + i, CFG.FIRST_GAME_COL, 1, m.nGames).setValues([line]);
    if (cWont >= 0 && String(row[cWont]).trim()) staffSh.getRange(i + 2, 6).setValue(row[cWont]);
    if (cPref >= 0 && String(row[cPref]).trim()) staffSh.getRange(i + 2, 7).setValue(row[cPref]);
    updated.push(p.name);
  });
  SpreadsheetApp.getUi().alert('Imported ' + updated.length + ' response(s)',
    updated.length ? updated.join(', ') : 'No names matched the Staff tab.', SpreadsheetApp.getUi().ButtonSet.OK);
}); }

function runSafely_(fn) {
  try { fn(); } catch (e) { SpreadsheetApp.getUi().alert('RedHawks Scheduler', e.message, SpreadsheetApp.getUi().ButtonSet.OK); }
}


/* =====================================================================
 * WEB APP
 * Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   Manager screens:  <web app link>
 *   Staff phone page: <web app link>?page=staff
 * ===================================================================== */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('App');
  t.mode = (e && e.parameter && e.parameter.page === 'staff') ? 'staff' : 'admin';
  t.appUrl = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(t.mode === 'staff' ? 'RedHawks Staff' : 'RedHawks Scheduler')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function menuSetPin() { runSafely_(function () {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Admin PIN', 'Pick a PIN for the manager screens of the web app (staff never need it).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pin = r.getResponseText().trim();
  if (pin.length < 4) throw new Error('Use at least 4 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', pin);
  ui.alert('PIN saved.');
}); }

function checkPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || 'redhawks';
  if (String(pin) !== real) throw new Error('Wrong PIN.');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function writeCell_(i, g, value) {
  ss_().getSheetByName('Schedule').getRange(CFG.SCHED_FIRST_STAFF_ROW + i, CFG.FIRST_GAME_COL + g).setValue(value);
}

function writeOpen_(m, g) {
  var open = openSpots_(m, g);
  ss_().getSheetByName('Schedule').getRange(CFG.SCHED_OPEN_ROW, CFG.FIRST_GAME_COL + g)
    .setValue(open.length ? open.length + ' open: ' + open.join(', ') : 'All filled');
}

function snapshot_(m) {
  var areas = {};
  var spotRows = ss_().getSheetByName('Spots').getRange(2, 1, m.spots.length, 2).getDisplayValues();
  spotRows.forEach(function (r) { areas[String(r[0]).trim().toLowerCase()] = r[1]; });
  return {
    games: m.gameRows.map(function (r, g) {
      return { label: m.labels[g], date: r[0], pitch: r[1], report: r[2], promo: r[3] };
    }),
    spots: m.spots.map(function (s) { return { name: s.name, role: s.role, need: s.need, deck: s.deck, area: areas[s.name.toLowerCase()] || '' }; }),
    staff: m.staff.map(function (p) {
      return { name: p.name, group: p.group, home: p.home, locked: p.locked, phone: String(p.phone || ''),
        roles: p.rawRoles, wont: p.rawWont, prefers: p.rawPrefers };
    }),
    grid: m.grid, avail: m.avail, decks: m.decks,
    counts: seasonCounts_(m)
  };
}

function apiLoad(pin) { checkPin_(pin); return snapshot_(load_()); }

function apiAutoFill(pin, g) { checkPin_(pin); return withLock_(function () {
  var m = load_(), gs = [];
  if (g === 'all') { for (var k = 0; k < m.nGames; k++) gs.push(k); } else gs = [Number(g)];
  var counts = seasonCounts_(m), placed = 0;
  gs.forEach(function (x) { placed += autoFillGame_(m, x, counts).placed.length; });
  saveGames_(m, gs);
  var snap = snapshot_(m); snap.message = placed + ' shift(s) placed.'; return snap;
}); }

function apiClearGame(pin, g) { checkPin_(pin); return withLock_(function () {
  var m = load_(); g = Number(g);
  m.grid.forEach(function (row) { row[g] = ''; });
  saveGames_(m, [g]);
  return snapshot_(m);
}); }

/** value: a spot name, '? spot' (asked), 'OFF', or '' to clear. */
function apiSetCell(pin, i, g, value) { checkPin_(pin); return withLock_(function () {
  var m = load_(); i = Number(i); g = Number(g);
  m.grid[i][g] = value; writeCell_(i, g, value); writeOpen_(m, g);
  return snapshot_(m);
}); }

/** Someone dropped: clear their cell, mark them unavailable, return who could cover. */
function apiDrop(pin, i, g) { checkPin_(pin); return withLock_(function () {
  var m = load_(); i = Number(i); g = Number(g);
  var spot = spotOf_(m.grid[i][g]);
  m.grid[i][g] = ''; m.avail[i][g] = 'N';
  writeCell_(i, g, '');
  ss_().getSheetByName('Availability').getRange(CFG.AVAIL_FIRST_ROW + i, CFG.FIRST_GAME_COL + g).setValue('N');
  writeOpen_(m, g);
  var snap = snapshot_(m); snap.droppedSpot = spot; return snap;
}); }

function apiCandidates(pin, g, spotName) {
  checkPin_(pin);
  var m = load_(); g = Number(g);
  var sp = m.spots.filter(function (s) { return s.name.toLowerCase() === String(spotName).toLowerCase(); })[0];
  if (!sp) throw new Error('Unknown spot: ' + spotName);
  return candidates_(m, g, sp).map(function (c) {
    var p = m.staff[c.idx];
    return { idx: c.idx, name: c.name, why: c.why, phone: String(p.phone || '') };
  });
}

function apiSetDeck(pin, deckName, g, text) { checkPin_(pin); return withLock_(function () {
  var sched = ss_().getSheetByName('Schedule');
  var rows = sched.getRange(CFG.SCHED_DECK_ROWS[0], 3, CFG.SCHED_DECK_ROWS.length, 1).getDisplayValues();
  for (var k = 0; k < rows.length; k++) {
    if (String(rows[k][0]).trim().toLowerCase() === String(deckName).toLowerCase()) {
      sched.getRange(CFG.SCHED_DECK_ROWS[0] + k, CFG.FIRST_GAME_COL + Number(g)).setValue(text || '');
    }
  }
  var m = load_(); writeOpen_(m, Number(g));
  return snapshot_(m);
}); }

function apiProblems(pin) { checkPin_(pin); var m = load_(); return problems_(m, m.labels); }

function apiSaveStaff(pin, i, f) { checkPin_(pin); return withLock_(function () {
  i = Number(i);
  ss_().getSheetByName('Staff').getRange(i + 2, 3, 1, 6).setValues([[
    f.home || '', f.locked ? 'Yes' : 'No', f.roles || '', f.wont || '', f.prefers || '', f.phone || '']]);
  return snapshot_(load_());
}); }

/* ---------- staff phone page ---------- */

function last4_(phone) { return String(phone || '').replace(/\D/g, '').slice(-4); }

function findStaff_(m, name, code) {
  for (var i = 0; i < m.staff.length; i++) {
    if (m.staff[i].name.toLowerCase() === String(name).trim().toLowerCase()) {
      var want = last4_(m.staff[i].phone);
      if (want && want !== String(code).trim()) throw new Error('That does not match the phone number we have for you. Ask Will to check it.');
      return i;
    }
  }
  throw new Error('Name not found. Ask Will to add you.');
}

function apiStaffNames() { return load_().staff.map(function (p) { return p.name; }).sort(); }

function apiStaffMe(name, code) {
  var m = load_(); var i = findStaff_(m, name, code); var p = m.staff[i];
  return {
    name: p.name, home: p.home, locked: p.locked,
    spots: uniq_(m.spots.map(function (s) { return s.name; })),
    wont: p.wont, prefers: p.prefers,
    games: m.gameRows.map(function (r, g) {
      return { label: m.labels[g], pitch: r[1], report: r[2], promo: r[3], avail: m.avail[i][g], shift: m.grid[i][g] };
    })
  };
}

function apiStaffSave(name, code, avail, wont, prefers) { return withLock_(function () {
  var m = load_(); var i = findStaff_(m, name, code);
  var line = []; for (var g = 0; g < m.nGames; g++) line.push(avail[g] === 'Y' ? 'Y' : (avail[g] === 'N' ? 'N' : ''));
  ss_().getSheetByName('Availability').getRange(CFG.AVAIL_FIRST_ROW + i, CFG.FIRST_GAME_COL, 1, m.nGames).setValues([line]);
  ss_().getSheetByName('Staff').getRange(i + 2, 6, 1, 2).setValues([[ (wont || []).join(', '), (prefers || []).join(', ') ]]);
  return apiStaffMe(name, code);
}); }

/*NODE*/if (typeof module !== 'undefined') module.exports = { autoFillGame_: autoFillGame_, candidates_: candidates_, problems_: problems_, seasonCounts_: seasonCounts_, openSpots_: openSpots_, splitList_: splitList_ };
