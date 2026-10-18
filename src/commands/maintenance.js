const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runDaily } = require('../dailytasks');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('[ADMIN] Sync des membres, nettoyage de la base, analyse et message de statut')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: '🔧 Maintenance en cours… (résultat dans la console et le salon de statut)', flags: 64 });
    try {
      await runDaily(interaction.client);
      await interaction.editReply({ content: '✅ Maintenance terminée.' });
    } catch (err) {
      await interaction.editReply({ content: '❌ Erreur pendant la maintenance : ' + err.message });
    }
  },
};
