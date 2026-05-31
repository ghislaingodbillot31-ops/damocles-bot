const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
require('dotenv').config();

const MUTE_ROLE_ID = process.env.MUTE_ROLE_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MAX_WARNINGS = 3;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sanction')
    .setDescription('Ajoute un avertissement à un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à sanctionner').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison');
    const guild  = interaction.guild;

    if (!target) {
      await interaction.editReply({ content: '❌ Membre introuvable.' });
      return;
    }

    // Enregistrer dans la DB
    db.upsertMember(target.user);
    const warningCount = db.addWarning(target.user.id, raison, interaction.user.tag);

    const logChannel = LOG_CHANNEL_ID ? guild.channels.cache.get(LOG_CHANNEL_ID) : null;

    // ── Moins de 3 avertissements ────────────────────────────────────────────
    if (warningCount < MAX_WARNINGS) {
      // Log dans damocles-log
    try {
      const { log } = require('../logger');
      await log(interaction.client, 'warning_added', { userId: target.id, modId: interaction.user.id, reason: raison, count: warningCount });
    } catch {}

    if (logChannel) {
        await logChannel.send({
          embeds: [{
            title: `⚠️ Avertissement ${warningCount}/${MAX_WARNINGS}`,
            color: 0xF39C12,
            thumbnail: { url: target.user.displayAvatarURL() },
            fields: [
              { name: 'Membre',      value: `<@${target.id}> (${target.user.tag})`, inline: true },
              { name: 'Modérateur', value: interaction.user.tag, inline: true },
              { name: 'Raison',     value: raison },
              { name: 'Date',       value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
            ],
            footer: { text: 'Damoclès Security Bot' },
            timestamp: new Date().toISOString(),
          }]
        });
      }

      await interaction.editReply({
        content: `⚠️ Avertissement **${warningCount}/${MAX_WARNINGS}** ajouté à **${target.user.tag}**.\nRaison : ${raison}`,
      });

      console.log(`⚠️ ${target.user.tag} — avertissement ${warningCount}/${MAX_WARNINGS}`);
      return;
    }

    // ── 3 avertissements atteints → mute + déconnexion ───────────────────────
    try {
      // Donner le rôle Mute
      if (MUTE_ROLE_ID) {
        await target.roles.add(MUTE_ROLE_ID).catch(console.error);
      }

      // Déconnecter du vocal si présent
      if (target.voice?.channel) {
        await target.voice.disconnect('3 avertissements atteints').catch(console.error);
      }

      if (logChannel) {
        await logChannel.send({
          embeds: [{
            title: '🚨 3 avertissements — Joueur sous contrôle',
            color: 0xE74C3C,
            thumbnail: { url: target.user.displayAvatarURL() },
            description: `**${target.user.tag}** a atteint ${MAX_WARNINGS} avertissements.\nIl a été **muté** et **déconnecté**. En attente de jugement.`,
            fields: [
              { name: 'Membre',            value: `<@${target.id}> (${target.user.tag})`, inline: true },
              { name: 'Modérateur',        value: interaction.user.tag, inline: true },
              { name: 'Dernier motif',     value: raison },
              { name: 'Actions effectuées', value: '🔇 Muté\n🔌 Déconnecté du vocal\n📋 Ajouté à la liste d\'expulsion' },
              { name: 'Date',              value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
            ],
            footer: { text: 'Damoclès Security Bot — Action requise' },
            timestamp: new Date().toISOString(),
          }]
        });
      }

      await interaction.editReply({
        content: `🚨 **${target.user.tag}** a atteint ${MAX_WARNINGS} avertissements.\nIl a été **muté**, **déconnecté** et ajouté à la liste d'expulsion.`,
      });

      console.log(`🚨 ${target.user.tag} — ${MAX_WARNINGS} avertissements, muté et déconnecté`);

    } catch (err) {
      console.error('Erreur sanction max :', err);
      await interaction.editReply({ content: `❌ Erreur lors de l'application des sanctions. (${err.message})` });
    }
  },
};
