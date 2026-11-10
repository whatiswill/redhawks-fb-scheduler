// Run: node tests/cells.test.js  (also run by scripts/check.sh)
// Cell texts below are real patterns from Will's 2026 schedules.
var fs = require('fs'), path = require('path'), vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8');
var sandbox = { module: { exports: {} } };
vm.runInNewContext(src, sandbox);
var C = sandbox.module.exports;

var spotNames = ['Beer Garden', 'Leines', 'CAPS', 'Coors', 'Captains Corner', 'Kona', 'Drekker', 'Satellite',
  'Conc. Beer 3', 'Conc. Beer 4', 'Conc. Beer 5', 'Conc. Beer 6', 'Conc. Till 1', 'Conc. Till 2', 'Conc. Till 7',
  'Conc. Till 8', 'Food Runner', 'Ice Cream', '1st Base DD', '3rd Base DD', 'Pizza', 'Suite Bar', 'Suite Server',
  'Kitchen', 'UND Deck', 'Surfside Patio', 'Picnic'];
var roles = { 'Food Runner': 'Runner', 'Kitchen': 'Cook', 'Suite Server': 'Suite Server', 'Suite Bar': 'Bar' };
var spots = spotNames.map(function (n) { return { name: n, role: roles[n] || (/Till|Pizza/.test(n) ? 'Till' : 'Beer'), aka: [] }; });
var idx = C.spotIndex_(spots);

var fails = 0;
function expect(text, home, want) {
  var got = C.parseCell_(text, home, idx);
  var bad = Object.keys(want).filter(function (k) { return got[k] !== want[k]; });
  if (bad.length) { fails++; console.error('FAIL "' + text + '" (home ' + (home || '-') + '): got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}

expect('', '', { w: false, off: false });
expect('OFF', 'Kona', { w: false, off: true });
expect('Sick', 'Kona', { w: false, off: true, n: 'Sick' });
expect('X(n/a)', 'Kona', { w: false, off: true });
expect('X', 'Kona', { w: true, s: 'Kona' });
expect('x', 'Drekker', { w: true, s: 'Drekker' });
expect('Drekker', '', { w: true, s: 'Drekker', a: false });
expect('Satellite?', '', { w: true, s: 'Satellite', a: true });
expect('? Kona', '', { w: true, s: 'Kona', a: true });
expect('?', '', { w: false, a: true });
expect('Conc. Beer 6', '', { w: true, s: 'Conc. Beer 6' });
expect('ConcBeer6', '', { w: true, s: 'Conc. Beer 6' });
expect('Conc.6', '', { w: true, s: 'Conc. Beer 6' });
expect('Conc. 2', '', { w: true, s: 'Conc. Till 2' });
expect('Concessions 4', '', { w: true, s: 'Conc. Beer 4' });
expect('Till 7', '', { w: true, s: 'Conc. Till 7' });
expect('Leine Lodge', '', { w: true, s: 'Leines' });
expect('Captain', '', { w: true, s: 'Captains Corner' });
expect('Caps Stand', '', { w: true, s: 'CAPS' });
expect('DD 3rdB', '', { w: true, s: '3rd Base DD' });
expect('DD 1st', '', { w: true, s: '1st Base DD' });
expect('UND', '', { w: true, s: 'UND Deck' });
expect('Surfside', '', { w: true, s: 'Surfside Patio' });
expect('Suites Bar', '', { w: true, s: 'Suite Bar' });
expect('kona', '', { w: true, s: 'Kona' });
expect('IceCream(to7:30)', '', { w: true, s: 'Ice Cream', n: 'IceCream(to7:30)' });
expect('Start 7:30', 'Kona', { w: true, s: 'Kona', n: 'Start 7:30' });
expect('w/ Bud', 'Coors', { w: true, s: 'Coors', n: 'w/ Bud' });
expect('at 1pm', 'Kitchen', { w: true, s: 'Kitchen' });
expect('12 arrival', 'Kitchen', { w: true, s: 'Kitchen' });
expect('Beer', '', { w: true, s: '', u: false });
expect('Alternate/ Mixer', '', { w: true, s: '' });
expect('Kitchen', '', { w: true, s: 'Kitchen' });
expect('Fargo Jet Center', '', { w: true, u: true });

// A person marked Sick is not counted as filling a spot or as a game worked.
var model = { spots: spots, staff: [{ name: 'A', home: 'Kona', locked: true, wont: [], roles: [], prefers: [] }],
  grid: [['Sick', 'Start 7:30', 'Beer']], avail: [['Y', 'Y', 'Y']], decks: {} };
var counts = C.seasonCounts_(model);
if (counts[0] !== 2) { fails++; console.error('FAIL seasonCounts: got ' + counts[0] + ', want 2'); }
var probs = C.problems_(model, ['g1', 'g2', 'g3']);
if (probs.length) { fails++; console.error('FAIL problems should be empty: ' + JSON.stringify(probs)); }

if (fails) { console.error(fails + ' cell check(s) failed'); process.exit(1); }
console.log('Cell parsing: all checks pass');
