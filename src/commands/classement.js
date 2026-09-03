const { SlashCommandBuilder } = require('discord.js');
const levels = require('../levels');

const MEDAILLE = ['🥇', '🥈', '🥉'];

function baremeTexte() {
  const x = levels.XP;
  return [
    '💬 **Message** — +' + x.MESSAGE + ' XP *(1×/min)*',
    '📸 **Message avec image / screenshot** — +' + x.IMAGE + ' XP *(1×/5 min)*',
    '🎙️ **Vocal** — +' + x.VOICE_PER_MIN + ' XP / minute *(à 2+ personnes, micro non coupé)*',
    '📥 **Inviter un membre qui rejoint** — +' + x.INVITE + ' XP',
    '🌱 **Ton invité reste 7 jours** — +' + x.INVITE_KEEP + ' XP bonus',
  ].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classement XP du serveur + comment gagner des points'),

  async execute(interaction) {
    const top = await levels.getClassement(15);

    const lignes = top.length
      ? top.map(e => {
          const pos = MEDAILLE[e.rang - 1] || '`#' + e.rang + '`';
          return pos + ' <@' + e.id + '> — **Nv ' + e.level + '** · ' + e.xp.toLocaleString('fr-FR') + ' XP';
        }).join('\n')
      : '*Personne n\'a encore d\'XP — sois le premier !*';

    await interaction.reply({
      embeds: [{
        title: '🏆  CLASSEMENT XP',
        description: lignes,
        color: 0xF1C40F,
        fields: [
          {
            name: '💡 Comment gagner des points ?',
            value: baremeTexte(),
            inline: false,
          },
          {
            name: '🎚️ Niveaux',
            value: 'Ton XP total te fait monter de niveau (courbe progressive). Utilise **/niveau** pour voir ta progression, ton rang, ton temps vocal et tes invitations.',
            inline: false,
          },
        ],
        footer: { text: 'EURO-AGRI — Damoclès Bot' },
      }],
    });
  },
};
