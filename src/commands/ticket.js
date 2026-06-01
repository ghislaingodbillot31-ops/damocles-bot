const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const { postTicketButton } = require('../tickets');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Ajouter bouton ticket')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await postTicketButton(interaction.channel);
    await interaction.editReply({ content: '✅ Bouton ticket ajouté sous le message !' });
  },
};
