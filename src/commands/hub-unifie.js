const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ids = require('../core/ids');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hub-unifie')
    .setDescription('[ADMIN] Publie le HUB unifié (statut + exploitations + commerce) dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    try {
      await require('../farm/hub-unifie').maj(interaction.client, interaction.channelId);
      await interaction.editReply('✅ HUB unifié publié dans ce salon (mise à jour automatique toutes les minutes).');
    } catch (err) { await interaction.editReply('❌ ' + err.message); }
  },
};
