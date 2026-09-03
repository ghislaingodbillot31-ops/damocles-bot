const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const levels = require('../levels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp-admin')
    .setDescription('[ADMIN] Gérer l\'XP des membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('ajouter')
      .setDescription('Ajouter (ou retirer avec un négatif) de l\'XP à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('XP à ajouter (négatif pour retirer)').setRequired(true)))
    .addSubcommand(s => s.setName('reset')
      .setDescription('Remettre à zéro l\'XP de TOUT le serveur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const membre  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      const r = await levels.adminAjuster(membre.id, montant);
      await interaction.reply({
        embeds: [{ description: (montant >= 0 ? '➕ ' : '➖ ') + Math.abs(montant) + ' XP → <@' + membre.id + '>\nNouveau total : **' + r.xp.toLocaleString('fr-FR') + ' XP** (niveau ' + r.level + ')', color: 0x2ECC71 }],
        flags: 64,
      });
      await levels.refreshLeaderboard();
      return;
    }

    if (sub === 'reset') {
      await interaction.deferReply({ flags: 64 });
      const n = await levels.adminReset();
      await levels.refreshLeaderboard();
      await interaction.editReply({ content: '♻️ XP remis à zéro pour **' + n + '** membre(s).' });
    }
  },
};
