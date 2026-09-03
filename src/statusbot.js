require('dotenv').config();
const db = require('./database');

let _cfgStatus = '';
try { _cfgStatus = require('./config').get().STATUS_CHANNEL_ID || ''; } catch {}

// Salon « bot-status » — priorité au .env, puis à la config dashboard, sinon valeur fixe
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID || _cfgStatus || '1538533342150918246';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function clearStatusChannel(channel, clientId) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    for (const [, m] of messages) {
      if (m.author.id === clientId) await m.delete().catch(() => {});
    }
  } catch {}
  await sleep(500);
}

async function postLine(channel, text, color = 0x2F3136) {
  return await channel.send({ embeds: [{ description: text, color }] }).catch(() => null);
}

async function updateStatusMessage(client, animated = false) {
  if (!STATUS_CHANNEL_ID) return;
  const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
  if (!channel) return;
  if (!animated) return;

  const stats = await db.getStats();
  const guild = client.guilds.cache.first();
  const now   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  await clearStatusChannel(channel, client.user.id);

  await postLine(channel, '> 🖥️ **DAMOCLES SECURITY SYSTEM v2.0**\n> Démarrage du système...', 0x2F3136);
  await sleep(600);

  await postLine(channel, '`▶` ⚙️ Connexion Discord ............. ✅ **En ligne**', 0x2ECC71);
  await sleep(400);

  const memberCount = guild ? guild.memberCount : stats.total;
  await postLine(channel, '`▶` 👥 Membres du serveur ........... ✅ **' + memberCount + '**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 📇 Fiches en base ............... ✅ **' + stats.total + '** (' + stats.present + ' présents)', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 🔨 Comptes bannis ............... ✅ **' + stats.banned + '**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` ⚠️ Comptes avertis .............. ✅ **' + stats.warned + '**', 0x2ECC71);
  await sleep(400);

  // Comptes refusés par l'administration (kick avec raison « refusé »)
  const allMembers = await db.getAllMembers();
  const refused = allMembers.filter(m =>
    Array.isArray(m.history) && m.history.some(h => h.event === 'kick' && /refus/i.test(h.detail || ''))
  ).length;
  await postLine(channel, '`▶` ❌ Comptes refusés .............. ✅ **' + refused + '**', 0x2ECC71);
  await sleep(400);

  // Exploitations EURO-AGRI
  let nbExpl = 0;
  try { nbExpl = require('./exploitation').getAll().filter(e => e.nom).length; } catch {}
  await postLine(channel, '`▶` 🌾 Exploitations EURO-AGRI ...... ✅ **' + nbExpl + '**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 🛡️ Système de vérification ...... ✅ **Actif**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 🎚️ Système de niveaux ........... ✅ **Actif**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 📋 Commandes .................... ✅ **13 slash + 2 menus**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '`▶` 🔄 Actualisation quotidienne .... ✅ **Planifiée — 04h00**', 0x2ECC71);
  await sleep(400);

  await postLine(channel, '> ✅ **Système opérationnel** — ' + now, 0x5865F2);
}

module.exports = { updateStatusMessage };
