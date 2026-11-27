const assert = require('assert');
const { blocs } = require('../src/farm/ressources');
const [b] = blocs([{ fillType: 'MAIZE', pricePer1000: '800' }, { fillType: 'X_MOD', pricePer1000: '5' }, { fillType: 'WHEAT', pricePer1000: '700' }]);
assert.strictEqual(b, '**Blé de printemps** · 700 € / 1000 L\n**Maïs** · 800 € / 1000 L'); // hors liste officielle : masqué
console.log('ok');
