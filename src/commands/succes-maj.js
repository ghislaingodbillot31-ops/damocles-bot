const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { recapAll } = require('../farm/fs25-succes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('succes-maj')
    .setDescription('[ADMIN] Recalcule les succès déjà réalisés et poste le bilan de toutes les fermes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    try {
      const id = process.env.FS25_SUCCES_CHANNEL_ID;
      const channel = (id && await interaction.client.channels.fetch(id).catch(() => null)) || interaction.channel;
      const n = await recapAll(channel);
      await interaction.editReply(n ? '✅ Bilan posté pour ' + n + ' ferme(s) dans <#' + channel.id + '>.' : '⏳ Pas encore de données du serveur FS25.');
    } catch (err) {
      await interaction.editReply('❌ ' + err.message);
    }
  },
};
