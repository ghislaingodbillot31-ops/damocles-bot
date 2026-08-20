const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { verifyMember } = require('../verification');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifier')
    .setDescription('Relance la vérification automatique sur un membre')
    .addUserOption(opt =>
      opt.setName('membre')
        .setDescription('Le membre à vérifier')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // Répondre IMMÉDIATEMENT avant tout
    await interaction.reply({
      content: '🔍 Vérification en cours...',
      flags: 64,
    });

    const user   = interaction.options.getUser('membre');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({ content: '❌ Membre introuvable sur le serveur.' });
      return;
    }

    // Enregistrer en DB
    await db.upsertMember(user, { joinedAt: member.joinedAt?.toISOString() });

    // Donner le rôle Vérification si pas déjà présent
    const VERIFICATION_ROLE_ID = process.env.VERIFICATION_ROLE_ID;
    if (VERIFICATION_ROLE_ID && !member.roles.cache.has(VERIFICATION_ROLE_ID)) {
      await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});
    }

    // Lancer la vérification (en arrière-plan)
    verifyMember(member).catch(console.error);

    await interaction.editReply({
      content: '✅ Vérification lancée pour **' + user.tag + '** — Résultat dans <#' + process.env.VERIFICATION_CHANNEL_ID + '>',
    });
  },
};
