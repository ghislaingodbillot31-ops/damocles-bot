const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FR = require('../farm/ressources-fr');
const { classement } = require('../farm/ressources');

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const MEDALS = ['🥇', '🥈', '🥉'];

const data = new SlashCommandBuilder().setName('ventes')
  .setDescription('Classement des exploitations qui ont le plus vendu un produit')
  .addStringOption((o) => o.setName('produit').setDescription('Le produit').setAutocomplete(true).setRequired(true));

async function autocomplete(interaction) {
  const q = norm(interaction.options.getFocused());
  await interaction.respond(Object.entries(FR).filter(([, nom]) => norm(nom).includes(q)).slice(0, 25).map(([k, nom]) => ({ name: nom, value: k })));
}

async function execute(interaction) {
  const key = interaction.options.getString('produit');
  const status = require('../farm/fs25-succes').getStatus();
  if (!FR[key]) return interaction.reply({ content: 'Produit inconnu : choisis-en un dans la liste.', flags: 64 });
  if (!status) return interaction.reply({ content: '⏳ Données indisponibles, réessaie dans une minute.', flags: 64 });
  const rows = classement(status, key);
  const lignes = rows.map((r, i) => `${MEDALS[i] || '`' + (i + 1) + '`'} **${r.nom}** · ${Math.round(r.litres).toLocaleString('fr-FR')} L`);
  await interaction.reply({ flags: 64, embeds: [new EmbedBuilder().setColor(0x6aa84f).setTitle(`💰 Ventes · ${FR[key]}`)
    .setDescription(lignes.join('\n') || '_Personne n\'en a encore vendu._').setFooter({ text: 'MonCopainBot · depuis la dernière remise à zéro des compteurs' })] });
}

module.exports = { data, execute, autocomplete };
