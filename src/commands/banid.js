const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banid')
    .setDescription('Bannit un membre par son ID Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('id').setDescription('ID Discord du membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('id');
    const raison = interaction.options.getString('raison');
    const guild  = interaction.guild;

    try {
      // Tenter de récupérer le membre (peut ne plus être sur le serveur)
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      if (!user) {
        await interaction.editReply({ content: `❌ Aucun utilisateur trouvé avec l'ID \`${userId}\`.` });
        return;
      }

      // Ban Discord
      await guild.members.ban(userId, { reason: `${raison} (par ${interaction.user.tag})` });

      // Enregistrement DB
      await db.banMember(user, raison, interaction.user.tag);

      // Log dans le salon logs
      const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
      if (LOG_CHANNEL_ID) {
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          await logChannel.send({
            embeds: [{
              title: '🔨 Bannissement',
              color: 0xE74C3C,
              fields: [
                { name: 'Membre',      value: `${user.tag} (\`${user.id}\`)`, inline: true },
                { name: 'Modérateur', value: interaction.user.tag, inline: true },
                { name: 'Raison',     value: raison },
                { name: 'Date',       value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
              ],
              footer: { text: 'Damoclès Security Bot' },
              timestamp: new Date().toISOString(),
            }]
          });
        }
      }

      await interaction.editReply({
        content: `✅ **${user.tag}** a été banni.\nRaison : ${raison}`,
      });

      console.log(`🔨 ${user.tag} banni par ${interaction.user.tag} — ${raison}`);

    } catch (err) {
      console.error('Erreur /banid :', err);
      await interaction.editReply({ content: `❌ Impossible de bannir cet utilisateur. (${err.message})` });
    }
  },
};
