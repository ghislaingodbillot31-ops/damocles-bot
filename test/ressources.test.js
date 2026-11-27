const assert = require('assert');
const { blocs, classement, estMeilleur } = require('../src/farm/ressources');
const st = { farms: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], counters: [
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 10 }, { kind: 'sold', farm: 2, fillType: 'WHEAT', value: 30 },
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 5 }, { kind: 'produced', farm: 1, fillType: 'WHEAT', value: 999 }, { kind: 'sold', farm: 1, fillType: 'MAIZE', value: 1 }] };
assert.deepStrictEqual(classement(st, 'WHEAT'), [{ nom: 'B', litres: 30 }, { nom: 'A', litres: 15 }]);

assert.ok(estMeilleur('WHEAT', 11));   // blé : pic en janvier (période 11)
assert.ok(!estMeilleur('WHEAT', 6));   // août : creux
assert.ok(estMeilleur('PEA', 9) && !estMeilleur('WHEAT', 9)); // novembre : pois à 98 % du pic (vert), blé à 89 % (non)
assert.ok(!estMeilleur('DIESEL', 11)); // pas de facteurs : jamais vert

const [b] = blocs([{ fillType: 'WHEAT' }, { fillType: 'X_MOD' }, { fillType: 'DIESEL' }], st, 11);
assert.strictEqual(b.texte, '```ansi\n\u001b[1;32mBlé de printemps\u001b[0m\n🥇 \u001b[1;34mB\u001b[0m 30 L · 🥈 \u001b[1;34mA\u001b[0m 15 L\n\u001b[1;37mDiesel\u001b[0m\n```'); // vert si meilleur mois, sans interligne ni prix
assert.ok(b.vert);
const tous = Object.keys(require('../src/farm/ressources-fr')).map((fillType) => ({ fillType }));
const parts = blocs(tous, null, 1);
assert.ok(parts.length > 1 && parts.every((p) => p.texte.length < 3900)); // découpé sous la limite d'un embed
console.log('ok');
