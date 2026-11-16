const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loto-tirage')
    .setDescription('[ADMIN] Lance tout de suite le tirage Euro-Copains (test)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: '🎟️ Tirage en cours…', flags: 64 });
    try {
      await require('../community/loto').tirage(interaction.client);
      await interaction.editReply({ content: '✅ Tirage effectué (résultat dans le salon).' });
    } catch (err) {
      await interaction.editReply({ content: '❌ ' + err.message });
    }
  },
};
