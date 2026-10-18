const { ContextMenuCommandBuilder, PermissionFlagsBits, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Ajouter bouton règlement')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;

    if (interaction.channel.id !== REGLEMENT_CHANNEL_ID) {
      await interaction.reply({
        content: '❌ Cette commande fonctionne uniquement dans le salon **#règlement**.',
        flags: 64,
      });
      return;
    }

    // Répondre immédiatement
    await interaction.reply({ content: '⏳ Ajout du bouton...', flags: 64 });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_reglement')
        .setLabel('✅ J\'accepte le règlement')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.targetMessage.reply({ components: [row] });
    await interaction.editReply({ content: '✅ Bouton ajouté sous le message !' });
  },
};