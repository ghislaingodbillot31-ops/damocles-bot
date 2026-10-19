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

const { imageSteam } = require('../src/jeux');
assert.strictEqual(imageSteam('https://store.steampowered.com/app/1245620/ELDEN_RING/').url, 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg');
assert.strictEqual(imageSteam('https://example.com/jeu'), undefined);
assert.strictEqual(imageSteam(null), undefined);
console.log('✅ image steam : ok');

const jeux = require('../src/jeux');
const st = jeux.__store();
st.jeux = { '🎮-elden-ring': 'c1' }; st.wish = { m9: { nom: 'Hollow Knight: Silksong', lien: 'https://store.steampowered.com/app/1030300/x/' } }; st.wishId = 'w1';
const guild = { id: 'g', channels: { cache: new Map([['c1', { id: 'c1', topic: 'Elden Ring · https://store.steampowered.com/app/1245620/ER/' }]]) } };
assert.match(jeux.doublon(guild, 'ELDEN  ring!', ''), /déjà dans les jeux/);                                   // même nom, casse/ponctuation ignorées
assert.match(jeux.doublon(guild, 'Autre nom', 'https://store.steampowered.com/app/1245620/z'), /déjà dans les jeux/); // même id Steam
assert.match(jeux.doublon(guild, 'hollow knight silksong', ''), /déjà dans la wishlist/);                     // wishlist par nom
assert.match(jeux.doublon(guild, 'Silk', 'https://store.steampowered.com/app/1030300'), /wishlist/);          // wishlist par id Steam
assert.strictEqual(jeux.doublon(guild, 'Stardew Valley', ''), null);                                          // nouveau jeu
console.log('✅ doublons : ok');
