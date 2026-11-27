const assert = require('assert');
const { blocs } = require('../src/farm/ressources');
const [b] = blocs([{ fillType: 'MAIZE', pricePer1000: '800' }, { fillType: 'X_MOD', pricePer1000: '5' }, { fillType: 'WHEAT', pricePer1000: '700' }]);
assert.strictEqual(b, '**Blé de printemps** · 700 € / 1000 L\n**Maïs** · 800 € / 1000 L'); // hors liste officielle : masqué
console.log('ok');
const { classement } = require('../src/farm/ressources');
const st = { farms: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], counters: [
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 10 }, { kind: 'sold', farm: 2, fillType: 'WHEAT', value: 30 },
  { kind: 'sold', farm: 1, fillType: 'WHEAT', value: 5 }, { kind: 'produced', farm: 1, fillType: 'WHEAT', value: 999 }, { kind: 'sold', farm: 1, fillType: 'MAIZE', value: 1 }] };
assert.deepStrictEqual(classement(st, 'WHEAT'), [{ nom: 'B', litres: 30 }, { nom: 'A', litres: 15 }]);
console.log('ok classement');
