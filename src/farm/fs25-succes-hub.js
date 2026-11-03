/**
 * HUB des succès (salon des succès) : classement des exploitations
 * et un menu pour recevoir ses statistiques détaillées en MP.
 * Mis à jour à chaque vérification des succès (toutes les 15 min).
 */
const fs = require('fs');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { panneauEmbed } = require('../core/embed-format');
const SERIES = require('./fs25-succes-config');

const FOOTER = 'MonCopainBot · Hub succès';
const MEDALS = ['🥇', '🥈', '🥉'];
const succes = () => require('./fs25-succes'); // import tardif : évite la dépendance circulaire

// Nombre de niveaux débloqués par ferme, tri décroissant.
function ranking(status) {
  const { seriesValue, tiersReached } = succes();
  const total = SERIES.reduce((n, s) => n + s.tiers.length, 0);
  return status.farms
    .map((farm) => ({ farm, done: SERIES.reduce((n, s) => { const v = seriesValue(s, farm.id, status); return n + (v === null ? 0 : tiersReached(s, v)); }, 0), total }))
    .sort((a, b) => b.done - a.done || a.farm.name.localeCompare(b.farm.name, 'fr'));
}

function buildMessage(status) {
  const rank = ranking(status);
  const lines = rank.map((r, i) => `${MEDALS[i] || '`' + String(i + 1).padStart(2) + '`'} **${r.farm.name}** · ${r.done} / ${r.total} niveaux`);
  const embed = panneauEmbed({
    title: '🏆 HUB DES SUCCÈS',
    color: 0xF1C40F,
    description: '**Classement des exploitations**\n' + (lines.join('\n') || '_Aucune exploitation._'),
    fields: [{ name: '📅 Succès des dernières 24 h', value: shown.join('\n') || '_Aucun succès débloqué pour le moment._' }],
    footer: { text: FOOTER },
    timestamp: new Date().toISOString(),
  });
  const menu = new StringSelectMenuBuilder()
    .setCustomId('succhub_farm')
    .setPlaceholder('🌾 Choisis ton exploitation pour recevoir tes statistiques en MP')
    .addOptions(rank.slice(0, 25).map((r) => ({ label: r.farm.name.slice(0, 100), value: String(r.farm.id), description: `${r.done} / ${r.total} niveaux` })));
  return { embeds: [embed], components: [
    ...(rank.length ? [new ActionRowBuilder().addComponents(menu)] : []),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('succhub_liste').setLabel('📋 Liste complète des succès').setStyle(ButtonStyle.Secondary)),
  ] };
}

// Crée ou met à jour l'unique message du HUB dans le salon.
async function update(status, channel, unlocks = []) {
  if (!channel) return;
  const msg = buildMessage(status);
  const msgs = await channel.messages.fetch({ limit: 50 });
  const existing = msgs.find((m) => m.author.id === channel.client.user.id && m.embeds[0]?.footer?.text === FOOTER);
  if (existing) await existing.edit(msg); else await channel.send(msg);
}

// Menu : envoie les statistiques détaillées de la ferme choisie en MP.
async function handleSelect(interaction) {
  await interaction.deferReply({ flags: 64 });
  const { getStatus, progressEmbed } = succes();
  const status = getStatus();
  const farm = status && status.farms.find((f) => String(f.id) === interaction.values[0]);
  if (!farm) return interaction.editReply('⏳ Données indisponibles, réessaie dans une minute.');
  const embed = progressEmbed(farm, status);
  try {
    await interaction.user.send({ embeds: [embed] });
    await interaction.editReply(`📩 Statistiques de **${farm.name}** envoyées en message privé.`);
  } catch {
    await interaction.editReply({ content: '⚠️ MP fermés : voici tes statistiques ici (visibles par toi seul).', embeds: [embed], natif: true });
  }
}

// Bouton : liste complète des succès (src/farm/liste-succes.md), visible par le joueur seul.
async function handleButton(interaction) {
  const txt = fs.readFileSync(require('path').join(__dirname, 'liste-succes.md'), 'utf-8').replace(/^# .*\r?\n+/, '');
  await interaction.reply({ embeds: [panneauEmbed({ title: '📋 Liste des succès FS25', color: 0xF1C40F, description: txt, footer: { text: 'MonCopainBot' } })], flags: 64, natif: true }); // natif : sinon simple.js aplatit l'embed en texte de 2000 car. max
}

module.exports = { handleButton, update, handleSelect, buildMessage };
