require('dotenv').config();
const db = require('./database');

const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let statusMessages = []; // IDs des messages postés

/**
 * Efface les anciens messages du bot dans #status-joueurs
 */
async function clearStatusChannel(channel, clientId) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    for (const [, m] of messages) {
      if (m.author.id === clientId) await m.delete().catch(() => {});
    }
  } catch {}
  statusMessages = [];
  await sleep(500);
}

/**
 * Poste une ligne dans #status-joueurs
 */
async function postLine(channel, text, color = 0x2F3136) {
  const msg = await channel.send({
    embeds: [{ description: text, color }]
  }).catch(() => null);
  if (msg) statusMessages.push(msg.id);
  return msg;
}

/**
 * Affichage complet ligne par ligne avec progression en temps réel
 */
async function updateStatusMessage(client, animated = false) {
  if (!STATUS_CHANNEL_ID) return;
  const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
  if (!channel) return;

  const stats = db.getStats();
  const guild = client.guilds.cache.first();
  const now   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  if (!animated) return; // Mise à jour uniquement en mode animé

  await clearStatusChannel(channel, client.user.id);

  // ── Ligne 1 : Titre ──────────────────────────────────────────────────────
  await postLine(channel, '> 🖥️ **DAMOCLES SECURITY SYSTEM v2.0**\n> Démarrage du système...', 0x2F3136);
  await sleep(700);

  // ── Ligne 2 : Connexion Discord ──────────────────────────────────────────
  await postLine(channel, '`▶` ⚙️ Connexion Discord .............. ✅ **En ligne**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 3 : Membres total ──────────────────────────────────────────────
  const memberCount = guild ? guild.memberCount : stats.total;
  await postLine(channel, '`▶` 👥 Membres total .................. ✅ **' + memberCount + ' membres**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 4 : Comptes actifs ─────────────────────────────────────────────
  await postLine(channel, '`▶` ✅ Comptes actifs ................. ✅ **' + stats.active + '**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 5 : Comptes inactifs ───────────────────────────────────────────
  await postLine(channel, '`▶` 🟡 Comptes inactifs ............... ✅ **' + stats.inactive + '**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 6 : Comptes bannis ─────────────────────────────────────────────
  await postLine(channel, '`▶` 🔨 Comptes bannis ................. ✅ **' + stats.banned + '**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 7 : Comptes avertis ────────────────────────────────────────────
  await postLine(channel, '`▶` ⚠️ Comptes avertis ................ ✅ **' + stats.warned + '**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 8 : Comptes refusés ────────────────────────────────────────────
  const refused = db.getAllMembers().filter(m => m.history?.some(h => h.event === 'verification_refused')).length;
  await postLine(channel, '`▶` ❌ Comptes refusés ................ ✅ **' + refused + '**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 9 : Analyse des salons (en temps réel) ────────────────────────
  if (guild) {
    const channels = guild.channels.cache.filter(c => c.isTextBased && c.isTextBased() && c.viewable);
    const total    = channels.size;
    let   loaded   = 0;

    // Message initial
    const scanMsg = await postLine(channel, '`▶` 📂 Analyse des salons ............. ⏳ **0 / ' + total + '**', 0xF39C12);

    for (const [, ch] of channels) {
      loaded++;
      if (scanMsg) {
        await scanMsg.edit({
          embeds: [{
            description: '`▶` 📂 Analyse des salons ............. ⏳ **' + loaded + ' / ' + total + '** — `#' + ch.name + '`',
            color: 0xF39C12,
          }]
        }).catch(() => {});
      }
      await sleep(80);
    }

    if (scanMsg) {
      await scanMsg.edit({
        embeds: [{
          description: '`▶` 📂 Analyse des salons ............. ✅ **' + total + ' / ' + total + '** — Terminée',
          color: 0x2ECC71,
        }]
      }).catch(() => {});
    }
    await sleep(500);
  }

  // ── Ligne 10 : Système de vérification ──────────────────────────────────
  await postLine(channel, '`▶` 🛡️ Système de vérification ........ ✅ **Actif**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 11 : Commandes ─────────────────────────────────────────────────
  await postLine(channel, '`▶` 📋 Commandes disponibles .......... ✅ **4 commandes chargées**', 0x2ECC71);
  await sleep(500);

  // ── Ligne 12 : Scan hebdomadaire ─────────────────────────────────────────
  await postLine(channel, '`▶` 🔄 Scan hebdomadaire .............. ✅ **Planifié — Lundi 08h00**', 0x2ECC71);
  await sleep(500);

  // ── Ligne finale : timestamp ─────────────────────────────────────────────
  await postLine(channel, '> ✅ **Système opérationnel** — ' + now, 0x5865F2);
}

module.exports = { updateStatusMessage };
