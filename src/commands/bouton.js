const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const { ROLES_CHANNEL } = require('../roles');
const ROLES_CHANNEL_ID = process.env.ROLES_CHANNEL_ID || ROLES_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bouton')
    .setDescription('Crée un bouton interactif pour attribuer/retirer un rôle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o => o.setName('nom').setDescription('Texte du bouton').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer/retirer').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const nom   = interaction.options.getString('nom');
    const role  = interaction.options.getRole('role');
    const guild = interaction.guild;

    const channel = ROLES_CHANNEL_ID
      ? guild.channels.cache.get(ROLES_CHANNEL_ID)
      : interaction.channel;

    if (!channel) {
      await interaction.editReply({ content: '❌ Salon des rôles introuvable. Vérifie `ROLES_CHANNEL_ID` dans le `.env`.' });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(nom)
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({
      embeds: [{
        description: `Clique sur le bouton pour obtenir ou retirer le rôle **${role.name}**.`,
        color: role.color || 0x5865F2,
        footer: { text: 'Damoclès Security Bot' },
      }],
      components: [row],
    });

    await interaction.editReply({ content: `✅ Bouton **${nom}** créé dans <#${channel.id}> pour le rôle **${role.name}**.` });
    console.log(`🎭 Bouton "${nom}" créé pour le rôle ${role.name}`);
  },

  // Gestion du clic sur le bouton de rôle
  async handleRoleButton(interaction, roleId) {
    const member = interaction.member;
    const role   = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      await interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });
      return;
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role).catch(console.error);
      await interaction.reply({ content: `✅ Rôle **${role.name}** retiré.`, ephemeral: true });
    } else {
      await member.roles.add(role).catch(console.error);
      await interaction.reply({ content: `✅ Rôle **${role.name}** attribué.`, ephemeral: true });
    }
  },
};
