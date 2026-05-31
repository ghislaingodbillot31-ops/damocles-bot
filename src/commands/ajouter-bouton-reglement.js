const { ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Ajouter bouton règlement')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
    const EXCLUDED_ROLE_IDS    = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);

    // Vérifier que c'est bien dans #reglement
    if (interaction.channel.id !== REGLEMENT_CHANNEL_ID) {
      await interaction.editReply({ content: '❌ Cette commande fonctionne uniquement dans le salon **#reglement**.' });
      return;
    }

    // Vérifier que c'est un admin
    const isAdmin = EXCLUDED_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
    if (!isAdmin) {
      await interaction.editReply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.' });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reglement_accept')
        .setLabel('✅ J\'accepte le règlement')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.targetMessage.reply({ components: [row] });
    await interaction.editReply({ content: '✅ Bouton ajouté sous ton message !' });
  },
};
