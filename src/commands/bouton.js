const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const roles = require('../roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bouton')
    .setDescription('Ajoute / met à jour / retire un bouton de rôle dans le salon des rôles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(o => o.setName('role').setDescription('Rôle concerné').setRequired(true))
    .addStringOption(o => o.setName('nom').setDescription('Texte du bouton (obligatoire pour ajouter)').setRequired(false))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji du bouton (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('couleur').setDescription('Couleur du bouton').setRequired(false)
      .addChoices(
        { name: 'Bleu',  value: 'Primary' },
        { name: 'Gris',  value: 'Secondary' },
        { name: 'Vert',  value: 'Success' },
        { name: 'Rouge', value: 'Danger' },
      ))
    .addBooleanOption(o => o.setName('retirer').setDescription('Retirer ce bouton au lieu de l\'ajouter').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const role    = interaction.options.getRole('role');
    const nom     = interaction.options.getString('nom');
    const emoji   = interaction.options.getString('emoji') || '';
    const couleur = interaction.options.getString('couleur') || 'Primary';
    const retirer = interaction.options.getBoolean('retirer') || false;

    if (retirer) {
      const r = await roles.removeRoleButton(interaction.client, role.id);
      await interaction.editReply(r.ok
        ? '🗑️ Bouton **' + role.name + '** retiré du salon des rôles. (' + r.count + ' bouton(s) restant(s))'
        : '❌ Aucun bouton n\'existe pour **' + role.name + '**.');
      return;
    }

    if (!nom) {
      await interaction.editReply('❌ Précise un **nom** de bouton pour l\'ajouter (ou utilise `retirer:true` pour l\'enlever).');
      return;
    }

    const r = await roles.addRoleButton(interaction.client, { roleId: role.id, label: nom, emoji, style: couleur });
    if (!r.ok) {
      await interaction.editReply('❌ Maximum ' + 25 + ' boutons atteint dans le panneau.');
      return;
    }

    await interaction.editReply(
      (r.updated ? '✏️ Bouton **' + nom + '** mis à jour' : '✅ Bouton **' + nom + '** ajouté')
      + ' pour le rôle **' + role.name + '** dans <#' + roles.ROLES_CHANNEL + '>. (' + r.count + ' bouton(s))');
    console.log('🎭 /bouton — ' + (r.updated ? 'maj' : 'ajout') + ' "' + nom + '" → ' + role.name);
  },
};
