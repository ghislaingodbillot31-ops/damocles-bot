const { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { log } = require('../logger');

// Suppression d'une plage de messages via le menu contextuel (clic droit > Applications) :
//   1. « Purge : début » sur le premier message
//   2. « Purge : fin » sur le dernier message → aperçu + boutons de confirmation
// Les messages de début et de fin sont inclus. L'ordre des deux clics n'importe pas.

const MAX_MESSAGES = 1000;
const TTL_MS = 10 * 60 * 1000;
const BULK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60 * 1000; // limite Discord de bulkDelete (marge 1 min)

const starts  = new Map(); // `${userId}_${channelId}` → { messageId, at }
const pending = new Map(); // userId → { channelId, ids, at }

const key = (i) => i.user.id + '_' + i.channelId;

// Récupère les IDs des messages entre low et high (inclus), du plus ancien au plus récent.
async function collectRange(channel, lowId, highId) {
  const ids = [lowId];
  let cursor = lowId;
  while (ids.length <= MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ after: cursor, limit: 100 });
    if (!batch.size) break;
    const sorted = [...batch.keys()].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    for (const id of sorted) {
      if (BigInt(id) > BigInt(highId)) return ids;
      ids.push(id);
      if (id === highId) return ids;
    }
    cursor = sorted[sorted.length - 1];
  }
  return ids;
}

const dataStart = new ContextMenuCommandBuilder()
  .setName('Purge : début')
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

const dataEnd = new ContextMenuCommandBuilder()
  .setName('Purge : fin')
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

async function executeStart(interaction) {
  starts.set(key(interaction), { messageId: interaction.targetId, at: Date.now() });
  await interaction.reply({
    content: '📍 Message de début enregistré.\nFais maintenant clic droit > Applications > **Purge : fin** sur le dernier message à supprimer.',
    flags: 64,
  });
}

async function executeEnd(interaction) {
  const start = starts.get(key(interaction));
  if (!start || Date.now() - start.at > TTL_MS) {
    starts.delete(key(interaction));
    await interaction.reply({ content: '❌ Aucun message de début dans ce salon. Utilise d\'abord **Purge : début**.', flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const a = start.messageId, b = interaction.targetId;
  const [lowId, highId] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];

  let ids;
  try { ids = await collectRange(interaction.channel, lowId, highId); }
  catch (err) {
    console.error('Erreur purge (lecture) :', err.message);
    await interaction.editReply({ content: '❌ Impossible de lire les messages du salon. (' + err.message + ')' });
    return;
  }

  if (ids.length > MAX_MESSAGES) {
    await interaction.editReply({ content: '❌ Plage trop grande (plus de ' + MAX_MESSAGES + ' messages). Réduis la sélection.' });
    return;
  }

  pending.set(interaction.user.id, { channelId: interaction.channelId, ids, at: Date.now() });
  starts.delete(key(interaction));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('purge_ok_' + interaction.user.id).setLabel('Supprimer ' + ids.length + ' message(s)').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('purge_no_' + interaction.user.id).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
  const url = (id) => 'https://discord.com/channels/' + interaction.guildId + '/' + interaction.channelId + '/' + id;
  await interaction.editReply({
    content: '🗑️ **' + ids.length + ' message(s)** vont être supprimés, du [premier](' + url(lowId) + ') au [dernier](' + url(highId) + ') inclus.\nConfirmer ?',
    components: [row],
  });
}

async function handleButton(interaction) {
  const id = interaction.customId;
  const ownerId = id.replace(/^purge_(ok|no)_/, '');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: '❌ Cette confirmation ne t\'appartient pas.', flags: 64 });
    return;
  }

  const job = pending.get(ownerId);
  pending.delete(ownerId);

  if (id.startsWith('purge_no_')) {
    await interaction.update({ content: '↩️ Suppression annulée.', components: [] });
    return;
  }
  if (!job || Date.now() - job.at > TTL_MS || job.channelId !== interaction.channelId) {
    await interaction.update({ content: '❌ Sélection expirée. Recommence avec **Purge : début**.', components: [] });
    return;
  }

  await interaction.update({ content: '⏳ Suppression en cours...', components: [] });

  const channel = interaction.channel;
  const cutoff = Date.now() - BULK_MAX_AGE_MS;
  // Horodatage d'un snowflake : (id >> 22) + epoch Discord
  const ts = (sid) => Number(BigInt(sid) >> 22n) + 1420070400000;
  const recent = job.ids.filter(sid => ts(sid) > cutoff);
  const old    = job.ids.filter(sid => ts(sid) <= cutoff);

  let deleted = 0, failed = 0;
  for (let i = 0; i < recent.length; i += 100) {
    const chunk = recent.slice(i, i + 100);
    try {
      if (chunk.length === 1) { await channel.messages.delete(chunk[0]); deleted++; }
      else { const res = await channel.bulkDelete(chunk, true); deleted += res.size; failed += chunk.length - res.size; }
    } catch (err) { console.error('Erreur purge (bulk) :', err.message); failed += chunk.length; }
  }
  // Messages de plus de 14 jours : suppression une par une (plus lent)
  for (const sid of old) {
    try { await channel.messages.delete(sid); deleted++; }
    catch (err) { if (err.code !== 10008) failed++; } // 10008 = déjà supprimé
  }

  await interaction.editReply({
    content: '✅ **' + deleted + '** message(s) supprimé(s).' + (failed ? '\n⚠️ ' + failed + ' n\'ont pas pu être supprimés.' : ''),
  }).catch(() => {});

  await log(interaction.client, 'messages_purged', { modId: interaction.user.id, channelName: channel.name, count: deleted });
  console.log('🗑️ Purge : ' + deleted + ' message(s) dans #' + channel.name + ' par ' + interaction.user.tag);
}

module.exports = { dataStart, dataEnd, executeStart, executeEnd, handleButton };
