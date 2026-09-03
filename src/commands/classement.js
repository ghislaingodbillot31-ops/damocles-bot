const { SlashCommandBuilder } = require('discord.js');
const levels = require('../levels');

const MEDAILLE = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classement XP du serveur'),

  async execute(interaction) {
    const top = await levels.getClassement(15);

    if (!top.length) {
      await interaction.reply({ embeds: [{ description: '📭 Personne n\'a encore d\'XP.', color: 0x95A5A6 }], flags: 64 });
      return;
    }

    const lignes = top.map(e => {
      const pos = MEDAILLE[e.rang - 1] || '`#' + e.rang + '`';
      return pos + ' <@' + e.id + '> — **Nv ' + e.level + '** · ' + e.xp.toLocaleString('fr-FR') + ' XP';
    });

    await interaction.reply({
      embeds: [{
        title: '🏆  CLASSEMENT XP',
        description: lignes.join('\n'),
        color: 0xF1C40F,
        footer: { text: 'EURO-AGRI — Damoclès Bot' },
      }],
    });
  },
};
