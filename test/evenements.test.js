const assert = require('assert');
const os = require('os'), path = require('path');
process.env.DATA_DIR = require('fs').mkdtempSync(path.join(os.tmpdir(), 'ev-'));
const ev = require('../src/farm/evenements');

assert.strictEqual(ev.lundi(new Date('2026-11-22T12:00:00Z')), '2026-11-16'); // dimanche -> lundi précédent
assert.strictEqual(ev.lundi(new Date('2026-11-23T12:00:00Z')), '2026-11-23');
const d = ev.tirerDefis();
assert.strictEqual(new Set(d.map((x) => x.ft)).size, 3);
assert.deepStrictEqual(d.map((x) => x.pts), [50, 150, 500]);

const sent = [];
const channel = { send: async (m) => { sent.push(m); return { id: 'm' + sent.length }; }, messages: { fetch: async () => null } };
const farms = [{ id: 1, name: 'A' }, { id: 2, name: 'Forêt' }];
(async () => {
  await ev.maj({ farms, counters: [] }, channel);              // semaine démarrée : défis tirés
  const f = ev._etat().defis[0];
  const avec = (v) => ({ farms, counters: [{ kind: 'sold', farm: 1, fillType: f.ft, value: v }] });
  await ev.maj(avec(f.qte - 1), channel);
  assert.strictEqual(ev._etat().points[1], undefined);          // pas encore
  await ev.maj(avec(f.qte), channel);
  assert.strictEqual(ev._etat().points[1].total, 50);
  await ev.maj(avec(f.qte * 2), channel);
  assert.strictEqual(ev._etat().points[1].total, 50);           // pas de double attribution
  assert.ok(sent.some((m) => m.content && m.content.includes('+50 pts')));
  console.log('evenements OK');
})();
