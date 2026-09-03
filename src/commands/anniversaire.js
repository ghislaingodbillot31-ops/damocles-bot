const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

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
    const dateStr = interaction.options.getString('date');

    // Validation format JJ/MM/AAAA
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(regex);

    if (!match) {
      await interaction.reply({
        content: '❌ Format invalide. Utilise `JJ/MM/AAAA` — exemple : `20/11/1988`',
        flags: 64,
      });
      return;
    }

    const jour = parseInt(match[1]);
    const mois = parseInt(match[2]);
    const annee = parseInt(match[3]);

    if (jour < 1 || jour > 31 || mois < 1 || mois > 12) {
      await interaction.reply({ content: '❌ Date invalide.', flags: 64 });
      return;
    }

    if (annee < 1900 || annee > new Date().getFullYear()) {
      await interaction.reply({ content: '❌ Année invalide.', flags: 64 });
      return;
    }

    const ok = await db.setAnniversaire(interaction.user.id, dateStr);

    if (!ok) {
      // Membre pas encore en DB — on l'ajoute
      await db.upsertMember(interaction.user);
      await db.setAnniversaire(interaction.user.id, dateStr);
    }

    await interaction.reply({
      embeds: [{
        description: '🎂 Anniversaire enregistré : **' + dateStr + '**\nTu recevras un message le jour J !',
        color: 0xF1C40F,
        footer: { text: 'Damoclès Security Bot' },
      }],
      flags: 64,
    });

    // Rafraîchir la liste des anniversaires
    try {
      await require('../birthday').updateBirthdayChannel(interaction.client);
    } catch (err) {
      console.error('⚠️ Rafraîchissement liste anniversaires :', err.message);
    }
  },
};
