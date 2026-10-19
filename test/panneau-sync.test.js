const assert = require('assert');
const { publier } = require('../src/panneau-sync');

const salon = (existe, editOk = true) => {
  const log = [];
  const msg = { id: 'old', edit: async p => { if (!editOk) throw new Error('x'); log.push(['edit', p]); } };
  return { log, messages: { fetch: async id => { if (!existe || id !== 'old') throw new Error('404'); return msg; } },
    send: async p => { log.push(['send', p]); return { id: 'new' }; } };
};

(async () => {
  let s = salon(true);
  assert.strictEqual((await publier(s, 'old', { a: 1 })).id, 'old');
  assert.deepStrictEqual(s.log.map(l => l[0]), ['edit']);                 // édition, aucun envoi

  s = salon(false); let nettoye = 0;
  assert.strictEqual((await publier(s, 'old', { a: 1 }, async () => nettoye++)).id, 'new');
  assert.deepStrictEqual(s.log.map(l => l[0]), ['send']); assert.strictEqual(nettoye, 1);   // introuvable → envoi

  s = salon(true, false);
  assert.strictEqual((await publier(s, 'old', {})).id, 'new');            // édition refusée → envoi
  s = salon(true);
  assert.strictEqual((await publier(s, null, {})).id, 'new');             // pas d'id connu → envoi
  console.log('✅ panneau-sync : ok');
})();

const { formater } = require('../src/panneau-sync');
assert.strictEqual(formater([{ nom: 'Rôles', action: 'modifié', salon: '1' }, { nom: 'Hub', action: 'republié', salon: '2' }]),
  '✏️ **Rôles** · <#1> · modifié\n📤 **Hub** · <#2> · republié');
console.log('✅ rapport : ok');

const { sansNotif } = require('../src/silencieux');
assert.strictEqual(sansNotif('salut').flags, 4096);
assert.strictEqual(sansNotif({ content: 'x', flags: 64 }).flags, 64 | 4096);
console.log('✅ silencieux : ok');
