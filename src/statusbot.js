require('dotenv').config();
const db = require('./database');
const { SEP } = require('./embed-format');

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

async function updateStatusMessage(client, animated = false) {
  if (!STATUS_CHANNEL_ID) return;
  const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
  if (!channel) return;
  if (!animated) return;

  const stats = await db.getStats();
  const guild = client.guilds.cache.first();
  const now   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  await clearStatusChannel(channel, client.user.id);

  // Un seul embed, à largeur fixe, qu'on édite ligne par ligne (effet « console »).
  const lignes = [];
  let msg = null;
  const render = async (color = 0x5865F2) => {
    const payload = { embeds: [{
      title: '🖥️ DAMOCLES SECURITY SYSTEM v2.0',
      description: [SEP, ...lignes].join('\n'),
      color,
    }] };
    try { if (msg) await msg.edit(payload); else msg = await channel.send(payload); } catch {}
  };
  const step = async (ligne) => { lignes.push(ligne); await render(); await sleep(400); };

  await render();
  await sleep(600);

  await step('`▶` ⚙️ Connexion Discord ............. ✅ **En ligne**');

  const memberCount = guild ? guild.memberCount : stats.total;
  await step('`▶` 👥 Membres du serveur ........... ✅ **' + memberCount + '**');
  await step('`▶` 📇 Fiches en base ............... ✅ **' + stats.total + '** (' + stats.present + ' présents)');
  await step('`▶` 🔨 Comptes bannis ............... ✅ **' + stats.banned + '**');
  await step('`▶` ⚠️ Comptes avertis .............. ✅ **' + stats.warned + '**');

  // Comptes refusés par l'administration (kick avec raison « refusé »)
  const allMembers = await db.getAllMembers();
  const refused = allMembers.filter(m =>
    Array.isArray(m.history) && m.history.some(h => h.event === 'kick' && /refus/i.test(h.detail || ''))
  ).length;
  await step('`▶` ❌ Comptes refusés .............. ✅ **' + refused + '**');

  // Exploitations EUROAGRI
  let nbExpl = 0;
  try { nbExpl = require('./exploitation').getAll().filter(e => e.nom).length; } catch {}
  await step('`▶` 🌾 Exploitations EUROAGRI ...... ✅ **' + nbExpl + '**');

  await step('`▶` 🛡️ Système de vérification ...... ✅ **Actif**');
  await step('`▶` 🎚️ Système de niveaux ........... ✅ **Actif**');
  await step('`▶` 📋 Commandes .................... ✅ **13 slash + 2 menus**');
  await step('`▶` 🔄 Actualisation quotidienne .... ✅ **Planifiée — 04h00**');

  lignes.push(SEP);
  lignes.push('✅ **Système opérationnel** — ' + now);
  await render(0x2ECC71);
}

module.exports = { updateStatusMessage };
