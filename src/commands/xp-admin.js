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
      .setDescription('Remettre à zéro l\'XP de TOUT le serveur'))
    .addSubcommand(s => s.setName('backfill')
      .setDescription('Recalcule le classement depuis l\'historique des messages de tous les salons')
      .addIntegerOption(o => o.setName('jours').setDescription('Nombre de jours d\'historique à scanner (défaut 90)').setRequired(false))
      .addIntegerOption(o => o.setName('max_messages').setDescription('Messages max par salon (défaut 8000)').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const membre  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      const r = levels.adminAjuster(membre.id, montant);
      await interaction.reply({
        embeds: [{ description: (montant >= 0 ? '➕ ' : '➖ ') + Math.abs(montant) + ' XP → <@' + membre.id + '>\nNouveau total : **' + r.xp.toLocaleString('fr-FR') + ' XP** (niveau ' + r.level + ')', color: 0x2ECC71 }],
        flags: 64,
      });
      await levels.refreshLeaderboard();
      return;
    }

    if (sub === 'reset') {
      await interaction.deferReply({ flags: 64 });
      const n = levels.adminReset();
      await levels.refreshLeaderboard();
      await interaction.editReply({ content: '♻️ XP remis à zéro pour **' + n + '** membre(s).' });
      return;
    }

    if (sub === 'backfill') {
      const jours       = interaction.options.getInteger('jours') || 90;
      const maxParSalon = interaction.options.getInteger('max_messages') || 8000;

      await interaction.reply({
        embeds: [{
          description: '⏳ **Recalcul du classement en cours…**\nScan de l\'historique des ' + jours + ' derniers jours.\nÇa peut prendre plusieurs minutes — je mets à jour ce message au fur et à mesure.',
          color: 0xF39C12,
        }],
        flags: 64,
      });

      let dernierEdit = 0;
      const onProgress = async ({ salon, salonsFaits, total, messagesLus }) => {
        const now = Date.now();
        if (now - dernierEdit < 4000) return;       // throttle des éditions
        dernierEdit = now;
        await interaction.editReply({
          embeds: [{
            description: '⏳ **Recalcul en cours…**\n'
              + 'Salons : **' + salonsFaits + '/' + total + '**\n'
              + 'Messages lus : **' + messagesLus.toLocaleString('fr-FR') + '**\n'
              + 'Dernier salon : #' + salon,
            color: 0xF39C12,
          }],
        }).catch(() => {});
      };

      try {
        const res = await levels.backfillFromHistory(interaction.guild, { jours, maxParSalon, onProgress });
        await interaction.editReply({
          embeds: [{
            title: '✅ Classement recalculé',
            description: [
              '**' + res.salons + '** salons scannés',
              '**' + res.messagesLus.toLocaleString('fr-FR') + '** messages lus (' + res.jours + ' derniers jours)',
              '**' + res.membresCredites + '** membres avec de l\'XP',
              '',
              'Le classement a été republié. Le comptage vocal / invitations continue par-dessus.',
            ].join('\n'),
            color: 0x2ECC71,
          }],
        }).catch(() => {});
      } catch (err) {
        console.error('❌ backfill :', err);
        await interaction.editReply({ content: '❌ Erreur pendant le recalcul : ' + err.message }).catch(() => {});
      }
    }
  },
};
