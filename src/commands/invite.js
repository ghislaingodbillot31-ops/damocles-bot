const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Invite un joueur dans ton salon textuel temporaire')
    .addUserOption(o => o.setName('joueur').setDescription('Le joueur à inviter').setRequired(true)),

  async execute(interaction) {
    await require('../temptext').inviter(interaction, interaction.options.getUser('joueur'));
  },
};
