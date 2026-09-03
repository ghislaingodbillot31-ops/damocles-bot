const { SlashCommandBuilder } = require('discord.js');
const levels = require('../levels');

function barre(courant, total, taille = 18) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, courant / total)) : 0;
  const plein = Math.round(ratio * taille);
  return '█'.repeat(plein) + '░'.repeat(taille - plein) + '  ' + Math.round(ratio * 100) + '%';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('niveau')
    .setDescription('Affiche ton niveau (ou celui d\'un membre)')
    .addUserOption(o => o.setName('membre').setDescription('Le membre à consulter').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('membre') || interaction.user;
    const r    = await levels.getRang(user.id);

    if (!r.xp) {
      await interaction.reply({
        embeds: [{ description: (user.id === interaction.user.id ? 'Tu n\'as' : '**' + user.username + '** n\'a') + ' pas encore d\'XP. Discute et rejoins les vocaux !', color: 0x95A5A6 }],
        flags: 64,
      });
      return;
    }

    const dansNiveau  = r.xp - r.xpNiveauActuel;
    const pourNiveau  = r.xpNiveauSuivant - r.xpNiveauActuel;
    const heuresVocal = Math.floor(r.voiceMs / 3_600_000);
    const minVocal    = Math.floor((r.voiceMs % 3_600_000) / 60_000);

    await interaction.reply({
      embeds: [{
        title: '🎚️ Niveau de ' + user.username,
        thumbnail: { url: user.displayAvatarURL() },
        fields: [
          { name: 'Niveau',  value: '**' + r.level + '**', inline: true },
          { name: 'Rang',    value: r.rang ? '**#' + r.rang + '**/' + r.total : '—', inline: true },
          { name: 'XP total', value: '**' + r.xp.toLocaleString('fr-FR') + '**', inline: true },
          { name: 'Progression', value: '`' + barre(dansNiveau, pourNiveau) + '`\n' + dansNiveau.toLocaleString('fr-FR') + ' / ' + pourNiveau.toLocaleString('fr-FR') + ' XP', inline: false },
          { name: '🎙️ Temps vocal', value: heuresVocal + 'h ' + minVocal + 'min', inline: true },
          { name: '📥 Invitations', value: String(r.invites), inline: true },
        ],
        color: 0xF1C40F,
        footer: { text: 'EURO-AGRI — Damoclès Bot' },
      }],
    });
  },
};
