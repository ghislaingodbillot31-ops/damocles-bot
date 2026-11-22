const assert = require('assert');
const { parseStatus } = require('../src/farm/fs25-bridge');
const { computeUnlocks, _reset } = require('../src/farm/fs25-succes');
const xml = '<s><farm id="1" name="A" money="1" loan="0"/><stat farm="1" name="plowedHectares" value="%v"/><c kind="sold" farm="1" fillType="MILK" value="10"/></s>';
const st = (v) => parseStatus(xml.replace('%v', v));
_reset();
assert.strictEqual(computeUnlocks(st(0)).length, 0);      // 1er relevé : silencieux
assert.strictEqual(computeUnlocks(st(0)).length, 0);
const u = computeUnlocks(st(10000));                       // labour au max -> niveau 50
assert.strictEqual(u.length, 1); assert.strictEqual(u[0].tierIndex, 49);
console.log('succes OK');

// point zéro : les compteurs sont soustraits, jamais négatifs
const base = require('../src/farm/succes-base');
const sv = [{ farm: 1, name: 'x', value: 50 }], cv = [{ kind: 'sold', farm: 1, fillType: 'MILK', value: 10 }];
base.figer(JSON.parse(JSON.stringify(sv)), JSON.parse(JSON.stringify(cv)));
sv[0].value = 70; cv[0].value = 5; base.appliquer(sv, cv);
assert.strictEqual(sv[0].value, 20); assert.strictEqual(cv[0].value, 0);
require('fs').unlinkSync(require('../src/core/paths').dataPath('succes-base.json')); console.log('base OK');

// travail chez un autre joueur : les hectares passent du propriétaire du champ à la ferme du véhicule
{
  const { deplacerTravail } = require('../src/farm/fs25-bridge');
  const st = deplacerTravail({ stats: [{ farm: 1, name: 'plowedHectares', value: 10 }], counters: [
    { kind: 'work_credit', farm: 2, fillType: 'plowedHectares', value: 3 }, { kind: 'work_debit', farm: 1, fillType: 'plowedHectares', value: 3 }] });
  assert.strictEqual(st.stats.find((x) => x.farm === 1).value, 7);
  assert.strictEqual(st.stats.find((x) => x.farm === 2).value, 3);
  console.log('travail OK');
}
