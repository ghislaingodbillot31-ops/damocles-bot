const {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const info = require('../farm/hub-info');

// Deux sortes de boutons :
//  - texte (Règlement, Paramètre, Drive, Password) : le texte EST l'embed ;
//  - dynamiques (Contrat, Marché, Succès, Mods…) : le texte s'affiche en tête de leur embed (vide = rien).
const TEXTE = ['reglement', 'parametre', 'drive', 'motdepasse'];
const base = info.get().boutons;
const CHOIX = [
  ...TEXTE.map(k => ({ name: base.find(b => b.key === k).label, value: k })),
  ...Object.entries(info.DYN).map(([value, name]) => ({ name, value })),
];

const lire = id => info.DYN[id] ? { label: info.DYN[id], texte: info.getIntro(id), dyn: true }
  : (b => ({ label: b.label, texte: b.message, dyn: false }))(info.get().boutons.find(x => x.key === id));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bouton-info')
    .setDescription('Modifier le texte (embed) d\'un bouton des HUB')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('bouton').setDescription('Bouton à modifier').setRequired(true).addChoices(...CHOIX))
    .addStringOption(o => o.setName('texte').setDescription('Nouveau texte (sans : ouvre l\'éditeur avec le texte actuel)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
      return;
    }
    const id = interaction.options.getString('bouton');
    const texte = interaction.options.getString('texte');
    if (texte) { await enregistrer(interaction, id, texte); return; }

    const b = lire(id);
    const champ = new TextInputBuilder().setCustomId('texte')
      .setLabel(b.dyn ? 'Texte affiché en tête (vide = aucun)' : 'Texte de l\'embed (Markdown accepté)')
      .setStyle(TextInputStyle.Paragraph).setRequired(!b.dyn).setMaxLength(b.dyn ? 2000 : 4000);
    if (b.texte) champ.setValue(b.texte.slice(0, b.dyn ? 2000 : 4000));
    await interaction.showModal(new ModalBuilder().setCustomId('boutoninfo_' + id).setTitle(('Modifier : ' + b.label).slice(0, 45))
      .addComponents(new ActionRowBuilder().addComponents(champ)));
  },

  async handleModal(interaction) {
    await enregistrer(interaction, interaction.customId.replace('boutoninfo_', ''), interaction.fields.getTextInputValue('texte'));
  },
};

async function enregistrer(interaction, id, texte) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
    return;
  }
  info.set(info.DYN[id] ? { intros: { [id]: texte } } : { boutons: [{ key: id, message: texte }] });
  const b = lire(id);
  await interaction.reply({
    content: b.texte ? '✅ Texte du bouton **' + b.label + '** enregistré (' + b.texte.length + ' caractères). Il s\'affiche dès le prochain clic.'
      : '✅ Texte du bouton **' + b.label + '** retiré.',
    flags: 64,
  });
}
