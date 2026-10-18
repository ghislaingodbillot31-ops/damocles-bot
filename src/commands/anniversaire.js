const { SlashCommandBuilder } = require('discord.js');
const birthday = require('../birthday');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription('Enregistre ta date d\'anniversaire')
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Ta date d\'anniversaire au format JJ/MM/AAAA (ex: 20/11/1988)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const erreur = await birthday.enregistrer(interaction.user, interaction.options.getString('date'));
    if (erreur) return interaction.reply({ content: erreur, flags: 64 });

    await interaction.reply({ content: '🎂 Anniversaire enregistré ! Tu auras un message le jour J.', flags: 64 });
    await birthday.updateBirthdayChannel(interaction.client)
      .catch(err => console.error('⚠️ Rafraîchissement liste anniversaires :', err.message));
  },
};
