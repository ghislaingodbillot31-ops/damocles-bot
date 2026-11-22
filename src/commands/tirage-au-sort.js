const fs = require('fs');
const crypto = require('crypto');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dataPath } = require('../core/paths');

// /tirage-au-sort lien:<lien du message> [emoji:<emoji>]
// Compte les membres ayant réagi (une fois chacun, bots exclus) et poste un bouton « TIRER AU SORT » réservé aux admins.
// Chaque clic tire un nouveau gagnant, différent des précédents. État dans tirages.json (survit aux redémarrages).
const FILE = dataPath('tirages.json');
const lire = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { return {}; } };
const ecrire = (d) => fs.writeFileSync(FILE, JSON.stringify(d), 'utf-8');

const embed = (t, gagnants = []) => new EmbedBuilder().setColor(0xf1c40f).setTitle('🎟️ Tirage au sort')
  .setDescription([`Message : ${t.lien}`, `Emoji : ${t.emoji || 'toutes les réactions'}`, `👥 **${t.ids.length}** participant(s)`,
    ...(t.gagnants.length ? ['', '**Gagnants :**', ...t.gagnants.map((id, i) => `${i + 1}. <@${id}>`)] : [])].join('\n'));

const bouton = () => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tirage_go').setLabel('TIRER AU SORT').setEmoji('🎲').setStyle(ButtonStyle.Success));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tirage-au-sort')
    .setDescription('[ADMIN] Tirage au sort parmi ceux qui ont réagi à un message')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName('lien').setDescription('Lien du message de la tombola').setRequired(true))
    .addStringOption((o) => o.setName('emoji').setDescription('Emoji à compter (vide = toutes les réactions)')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '⛔ Réservé aux administrateurs.', flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const lien = interaction.options.getString('lien').trim();
    const m = lien.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (!m || m[1] !== interaction.guildId) return interaction.editReply('❌ Lien invalide (il faut le lien d\'un message de ce serveur).');
    try {
      const ch = await interaction.client.channels.fetch(m[2]);
      const msg = await ch.messages.fetch(m[3]);
      const emoji = interaction.options.getString('emoji')?.trim() || null;
      const reactions = [...msg.reactions.cache.values()].filter((r) => !emoji || r.emoji.toString() === emoji || r.emoji.name === emoji || r.emoji.id === emoji.replace(/\D/g, ''));
      if (!reactions.length) return interaction.editReply('❌ Aucune réaction correspondante sur ce message.');
      const ids = new Set();
      for (const r of reactions) {
        let after;
        for (;;) { // 100 utilisateurs par page
          const page = await r.users.fetch({ limit: 100, after });
          for (const u of page.values()) if (!u.bot) ids.add(u.id);
          if (page.size < 100) break;
          after = page.last().id;
        }
      }
      if (!ids.size) return interaction.editReply('❌ Personne n\'a réagi.');
      const t = { lien, emoji, ids: [...ids], gagnants: [] };
      const sent = await interaction.channel.send({ embeds: [embed(t)], components: [bouton()] });
      const d = lire(); d[sent.id] = t; ecrire(d);
      await interaction.editReply(`✅ ${ids.size} participant(s) comptabilisé(s) : ${sent.url}`);
    } catch (err) {
      await interaction.editReply('❌ ' + err.message);
    }
  },

  async bouton(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '⛔ Seuls les administrateurs peuvent tirer au sort.', flags: 64 });
    const d = lire(), t = d[interaction.message.id];
    if (!t) return interaction.reply({ content: '❌ Tirage introuvable (données perdues).', flags: 64 });
    const restants = t.ids.filter((id) => !t.gagnants.includes(id));
    if (!restants.length) return interaction.reply({ content: '🏁 Tous les participants ont déjà été tirés.', flags: 64 });
    const gagnant = restants[crypto.randomInt(restants.length)];
    t.gagnants.push(gagnant); ecrire(d);
    await interaction.update({ embeds: [embed(t)], components: [bouton()], allowedMentions: { parse: [] } });
    await interaction.channel.send({ content: `🎉 Le gagnant du tirage au sort est <@${gagnant}> ! Félicitations !`, allowedMentions: { users: [gagnant] } });
  },
};
