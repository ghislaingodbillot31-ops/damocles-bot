const { SlashCommandBuilder } = require('discord.js');
const levels = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classement XP du serveur + comment gagner des points'),

  async execute(interaction) {
    await levels.flush().catch(() => {}); // applique les points en attente avant l'affichage
    await interaction.reply({ embeds: [levels.baremeEmbed(), levels.classementEmbed()] });
  },
};
