const assert = require('assert');
const { blocs } = require('../src/farm/ressources');
const [b] = blocs([{ fillType: 'MAIZE', title: 'Corn', pricePer1000: '800' }, { fillType: 'X_MOD', title: 'Truc', pricePer1000: '5' }, { fillType: 'MAIZE', title: 'Corn', pricePer1000: '800' }]);
assert.strictEqual(b, '**Maïs** · 800 € / 1000 L\n**Truc** · 5 € / 1000 L');
console.log('ok');
