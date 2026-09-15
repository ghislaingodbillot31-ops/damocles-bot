const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const boutique = require('../boutique');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique-admin')
    .setDescription('[ADMIN] Gérer la boutique d\'échange de points')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('reset-cooldowns')
      .setDescription('Remet à zéro le délai entre deux demandes d\'échange pour TOUT le monde')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'reset-cooldowns') {
      const n = boutique.resetCooldowns();
      await interaction.reply({
        embeds: [{ description: '♻️ Délai d\'échange réinitialisé pour **' + n + '** membre(s). Tout le monde peut refaire une demande immédiatement.', color: 0x2ECC71 }],
        flags: 64,
      });
    }
  },
};
