const assert = require('assert');
const { blocs, classement, estMeilleur } = require('../src/farm/ressources');
const st = { farms: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], counters: [
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 10 }, { kind: 'sold', farm: 2, fillType: 'WHEAT', value: 30 },
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 5 }, { kind: 'produced', farm: 1, fillType: 'WHEAT', value: 999 }, { kind: 'sold', farm: 1, fillType: 'MAIZE', value: 1 }] };
assert.deepStrictEqual(classement(st, 'WHEAT'), [{ nom: 'B', litres: 30 }, { nom: 'A', litres: 15 }]);

assert.ok(estMeilleur('WHEAT', 11));   // blé : pic en janvier (période 11)
assert.ok(!estMeilleur('WHEAT', 6));   // août : creux
assert.ok(!estMeilleur('CHEESE', 11)); // pas de facteurs : jamais vert

const [b] = blocs([{ fillType: 'WHEAT' }, { fillType: 'X_MOD' }, { fillType: 'CHEESE' }], st, 11);
assert.strictEqual(b.texte, '🟢 **Blé de printemps**\n🥇 B 30 L · 🥈 A 15 L\n\n⚪ **Fromage**'); // hors liste officielle : masqué, pas de prix
assert.ok(b.vert);
const rows25 = Object.keys(require('../src/farm/ressources-fr')).slice(0, 25).map((fillType) => ({ fillType }));
assert.deepStrictEqual(blocs(rows25, null, 1).map((x) => x.texte.split('\n\n').length), [10, 10, 5]); // blocs de 10
console.log('ok');
