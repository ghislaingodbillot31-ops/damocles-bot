const { SlashCommandBuilder } = require('discord.js');
const levels = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classement XP du serveur + comment gagner des points'),

  async execute(interaction) {
    await interaction.reply({ embeds: [await levels.classementEmbed()] });
  },
};
