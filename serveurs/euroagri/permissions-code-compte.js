// Prépare les permissions de VANGUARD pour VERIF_MODE=code-compte (voir src/codeverif.js).
// Un nouvel arrivant n'a aucun rôle : il ne doit voir que le salon de vérification (+ le salon-piège anti-spam).
//   node serveurs/euroagri/permissions-code-compte.js          → aperçu, ne modifie rien
//   node serveurs/euroagri/permissions-code-compte.js --go     → applique (sauvegarde avant dans permissions-avant.json)
//   node serveurs/euroagri/permissions-code-compte.js --verifier → liste les salons visibles à chaque étape du parcours
// Annulation : node serveurs/euroagri/permissions-code-compte.js --restore
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType: T } = require('discord.js');

const GO = process.argv.includes('--go'), RESTORE = process.argv.includes('--restore'), VERIFIER = process.argv.includes('--verifier');
const SAUVEGARDE = path.join(__dirname, 'permissions-avant.json');
const E = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  const D = client.guilds.cache.get(E.GUILD_ID);
  await D.channels.fetch();
  const ch = id => D.channels.cache.get(id);
  const parNom = (type, mot) => D.channels.cache.find(c => c.type === type && c.name.includes(mot));
  const ow = c => c.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }));

  if (VERIFIER) {
    await D.roles.fetch();
    const etapes = [['Nouvel arrivant (aucun rôle)', D.roles.everyone], ['Code validé (⏳ En attente)', D.roles.cache.get(E.ATTENTE_ROLE_ID)],
      ['Règlement accepté seul (📜)', D.roles.cache.get(E.REGLEMENT_ROLE_ID)], ['Membre validé (✅)', D.roles.cache.get(E.ACTIVE_ROLE_ID)]];
    for (const [nom, role] of etapes) {
      const vus = D.channels.cache.filter(c => c.type !== T.GuildCategory && c.permissionsFor(role)?.has('ViewChannel'));
      console.log('\n' + nom + ' → ' + vus.size + ' salon(s)');
      if (vus.size <= 12) vus.forEach(c => console.log('   • ' + c.name + (c.permissionsFor(role).has('SendMessages') ? ' (écriture)' : ' (lecture)')));
    }
    return process.exit(0);
  }

  if (RESTORE) {
    const avant = JSON.parse(fs.readFileSync(SAUVEGARDE, 'utf-8'));
    for (const [id, list] of Object.entries(avant)) {
      await ch(id)?.permissionOverwrites.set(list.map(o => ({ id: o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) })));
      console.log('↩️  restauré :', ch(id)?.name);
    }
    return process.exit(0);
  }

  const ACTIVE = E.ACTIVE_ROLE_ID, ATTENTE = E.ATTENTE_ROLE_ID, REGLEMENT = E.REGLEMENT_ROLE_ID;
  const verif = ch(E.VERIFICATION_CHANNEL_ID);
  const support = parNom(T.GuildCategory, 'SUPPORT');
  const textuel = parNom(T.GuildCategory, 'TEXTUEL');
  const lobby = D.channels.cache.find(c => c.type === T.GuildVoice && c.name.includes('LE G'));

  // Le salon de vérification (bot-status) reste lisible par tous, sans écriture : le code se tape dans un salon privé.
  // Tout le reste de ce qui était visible par @everyone passe en « membres activés uniquement ».
  const plan = [
    [verif, { [D.id]: { ViewChannel: true, SendMessages: false } }],
    [support, { [D.id]: { ViewChannel: false }, [ACTIVE]: { ViewChannel: true } }],
    ...D.channels.cache.filter(c => support && c.parentId === support.id).map(c => [c, c.permissionsLocked
      ? 'sync' : { [D.id]: { ViewChannel: false }, [ACTIVE]: { ViewChannel: true } }]),
    [lobby, { [D.id]: { ViewChannel: false }, [ACTIVE]: { ViewChannel: true } }],
    [textuel, { [D.id]: { ViewChannel: false }, [ACTIVE]: { ViewChannel: true } }],
    ...D.channels.cache.filter(c => textuel && c.parentId === textuel.id && c.name.includes('créer')).map(c => [c, { [D.id]: { ViewChannel: false }, [ACTIVE]: { ViewChannel: true, SendMessages: false } }]),
  ].filter(([c]) => c);

  for (const [c, ops] of plan) {
    console.log((GO ? '✏️ ' : '👁️ ') + c.name + ' → ' + (ops === 'sync' ? 'resynchronisé avec sa catégorie'
      : Object.entries(ops).map(([id, p]) => (D.roles.cache.get(id)?.name || '@everyone') + ' ' + JSON.stringify(p)).join(' · ')));
  }
  if (!GO) { console.log('\nAperçu seulement. Relance avec --go pour appliquer.'); return process.exit(0); }

  fs.writeFileSync(SAUVEGARDE, JSON.stringify(Object.fromEntries(plan.map(([c]) => [c.id, ow(c)])), null, 2));
  for (const [c, ops] of plan.filter(([, o]) => o !== 'sync')) {
    for (const [id, p] of Object.entries(ops)) await c.permissionOverwrites.edit(id, p);
  }
  for (const [c] of plan.filter(([, o]) => o === 'sync')) await c.lockPermissions();
  console.log('\n✅ Terminé (sauvegarde : ' + SAUVEGARDE + ')');
  process.exit(0);
});
client.login(E.DISCORD_TOKEN);
