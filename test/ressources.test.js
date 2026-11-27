const assert = require('assert');
const { blocs, classement, estMeilleur } = require('../src/farm/ressources');
const FR = require('../src/farm/ressources-fr');
const st = { farms: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], counters: [
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 10 }, { kind: 'sold', farm: 2, fillType: 'WHEAT', value: 30 },
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 5 }, { kind: 'produced', farm: 1, fillType: 'WHEAT', value: 999 }, { kind: 'sold', farm: 1, fillType: 'MAIZE', value: 1 }] };
assert.deepStrictEqual(classement(st, 'WHEAT'), [{ nom: 'B', litres: 30 }, { nom: 'A', litres: 15 }]);

assert.ok(estMeilleur('WHEAT', 11));   // blé : pic en janvier (période 11)
assert.ok(!estMeilleur('WHEAT', 6));   // août : creux
assert.ok(estMeilleur('PEA', 9) && !estMeilleur('WHEAT', 9)); // novembre : pois à 98 % du pic (vert), blé à 89 % (non)
assert.ok(!estMeilleur('DIESEL', 11)); // pas de facteurs : jamais vert

// produit hors liste masqué ; couleurs ansi : vert = meilleur mois, pseudos en bleu
const parts = blocs([{ fillType: 'WHEAT' }, { fillType: 'X_MOD' }, { fillType: 'DIESEL' }], st, 11);
assert.deepStrictEqual(parts.map((p) => p.lettre), ['B → B', 'D → D']);
assert.ok(parts[0].vert && !parts[1].vert);
assert.ok(parts[0].texte.startsWith('```ansi\n\u001b[1;32mBlé de printemps\u001b[0m '));
assert.ok(parts[0].texte.includes('\n🥇 \u001b[1;34mB\u001b[0m 30 L · 🥈 \u001b[1;34mA\u001b[0m 15 L\n```'));

// 3 grands blocs consécutifs de taille voisine
const tous = blocs(Object.keys(FR).map((fillType) => ({ fillType })), null, 1);
assert.strictEqual(tous.length, 3);
const tailles = tous.map((p) => p.texte.length);
assert.ok(tailles.every((n) => n < 3900) && Math.max(...tailles) < 1.4 * Math.min(...tailles), String(tailles));
console.log('ok', tailles.join('/'));
