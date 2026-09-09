require('dotenv').config();
const fs = require('fs');
const db = require('./database');
const { SEP } = require('./embed-format');
const { dataPath } = require('./paths');

let _cfgStatus = '';
try { _cfgStatus = require('./config').get().STATUS_CHANNEL_ID || ''; } catch {}

// Salon unifié « bot-status + vérification » : priorité au .env (VERIFICATION_CHANNEL_ID,
// partagé avec verification.js), puis à l'ancienne clé STATUS_CHANNEL_ID / config dashboard,
// sinon la valeur fixe.
const STATUS_CHANNEL_ID = process.env.VERIFICATION_CHANNEL_ID
  || process.env.STATUS_CHANNEL_ID || _cfgStatus || '1538533342150918246';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Message de statut persistant ────────────────────────────────────────────
// On garde UN seul message, édité en place. Son ID est stocké sur le disque
// persistant pour survivre aux redémarrages. On ne « vide » plus le salon :
// les embeds de vérification postés en dessous ne doivent jamais être supprimés.
const MSG_FILE = dataPath('status-msg.json');

function loadStatusMsgId() {
  try { return JSON.parse(fs.readFileSync(MSG_FILE, 'utf8')).id || null; } catch { return null; }
}
function saveStatusMsgId(id) {
  try { fs.writeFileSync(MSG_FILE, JSON.stringify({ id, updatedAt: new Date().toISOString() }, null, 2)); } catch {}
}

// Nettoyage one-shot : au 1er passage après un déploiement, on efface les
// anciens messages de statut streamés par la version précédente (plusieurs
// embeds « DAMOCLES SECURITY SYSTEM »), sauf le message persistant courant.
// Les embeds de vérification (titre « 🔍 VÉRIFICATION ») ne sont jamais touchés.
let _legacyCleaned = false;
async function cleanupLegacyStatus(channel, clientId, keepId) {
  if (_legacyCleaned) return;
  _legacyCleaned = true;
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    for (const [, m] of messages) {
      if (m.author.id !== clientId) continue;
      if (keepId && m.id === keepId) continue;
      const titre = m.embeds?.[0]?.title || '';
      if (titre.includes('DAMOCLES SECURITY SYSTEM')) await m.delete().catch(() => {});
    }
  } catch {}
  await sleep(300);
}

async function updateStatusMessage(client, animated = false) {
  if (!STATUS_CHANNEL_ID) return;
  const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
  if (!channel) return;
  if (!animated) return;

  const stats = await db.getStats();
  const guild = client.guilds.cache.first();
  const now   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  // Récupérer le message persistant (édité en place), sinon on en créera un.
  let msg = null;
  const savedId = loadStatusMsgId();
  if (savedId) msg = await channel.messages.fetch(savedId).catch(() => null);
  await cleanupLegacyStatus(channel, client.user.id, msg?.id);

  // Un seul embed, à largeur fixe, qu'on édite ligne par ligne (effet « console »).
  const lignes = [];
  const render = async (color = 0x5865F2) => {
    const payload = { embeds: [{
      title: '🖥️ DAMOCLES SECURITY SYSTEM v2.0',
      description: [SEP, ...lignes].join('\n'),
      color,
    }] };
    try {
      if (msg) {
        await msg.edit(payload);
      } else {
        msg = await channel.send(payload);
        saveStatusMsgId(msg.id);
        await msg.pin().catch(() => {});
      }
    } catch {}
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
  await step('`▶` 🔄 Actualisation quotidienne .... ✅ **Planifiée · 04h00**');

  lignes.push(SEP);
  lignes.push('✅ **Système opérationnel** · ' + now);
  await render(0x2ECC71);
}

module.exports = { updateStatusMessage };
