const { SlashCommandBuilder } = require('discord.js');
const { lireDonneesCompletes } = require('../farm/fs25-bridge');
const { sectionEmbed } = require('../farm/fs25-data');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fs25')
    .setDescription('Affiche une catégorie de données du serveur FS25 (véhicules, champs, silos, prix…)')
    .addStringOption((o) => o.setName('donnees').setDescription('Catégorie').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('ferme').setDescription('Filtrer sur une ferme (nom)')),

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const { sections } = await lireDonneesCompletes();
    await interaction.respond(Object.keys(sections).filter((n) => n.includes(typed)).slice(0, 25).map((n) => ({ name: `${n} (${sections[n].length})`, value: n })));
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { sections, exportedAt } = await lireDonneesCompletes();
      const name = interaction.options.getString('donnees');
      if (!sections[name]) return void await interaction.editReply(`Catégorie inconnue. Disponibles : ${Object.keys(sections).join(', ') || 'aucune (mod pas encore à jour ?)'}`);
      await interaction.editReply({ embeds: [sectionEmbed(name, sections[name], exportedAt, interaction.options.getString('ferme'))] });
    } catch (err) {
      await interaction.editReply(`Données indisponibles : ${err.message}`);
    }
  },
};
