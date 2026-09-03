const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
require('dotenv').config();

const EXCLUDED_ROLE_IDS = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// File d'attente par serveur
const queues = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expulsion')
    .setDescription('Liste les membres inactifs et permet de les expulser')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild   = interaction.guild;

      // Récupérer membres avec retry
      let members;
      for (let i = 0; i < 3; i++) {
        try {
          members = await guild.members.fetch();
          break;
        } catch (err) {
          if (err.data?.retry_after && i < 2) {
            const wait = (err.data.retry_after + 2) * 1000;
            console.log('⏳ Rate limit — attente ' + Math.ceil(wait/1000) + 's...');
            await new Promise(r => setTimeout(r, wait));
          } else throw err;
        }
      }

      const toExpel = [];

      for (const [, member] of members) {
        if (member.user.bot) continue;
        if (EXCLUDED_ROLE_IDS.some(id => member.roles.cache.has(id))) continue;

        const status = getMemberStatus(member);
        if (status === 'expel') {
          toExpel.push({
            member,
            daysInactive: getDaysInactive(member),
            lastActivity: getLastActivity(member.id),
          });
        }
      }

      if (toExpel.length === 0) {
        await interaction.editReply({ content: '✅ Aucun membre inactif depuis plus de ' + EXPEL_DAYS + ' jours.' });
        return;
      }

      // Trier du plus inactif au moins inactif
      toExpel.sort((a, b) => b.daysInactive - a.daysInactive);
      queues.set(guild.id, { list: toExpel, index: 0, channel: interaction.channel });

      await interaction.editReply({
        content: '⚠️ **' + toExpel.length + ' membre(s)** sur la liste d\'expulsion. Premier membre :',
      });

      await sendNext(guild, interaction.channel);

    } catch (err) {
      console.error('Erreur /expulsion :', err.message);
      try { await interaction.editReply({ content: '❌ Erreur : ' + err.message }); } catch {}
    }
  },

  async handleButton(interaction) {
    const [action, memberId] = interaction.customId.split('_');
    const guild = interaction.guild;
    const queue = queues.get(guild.id);

    if (action === 'kick') {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) {
        await interaction.update({
          embeds: [{ description: '❌ Membre introuvable (déjà parti)', color: 0x95A5A6 }],
          components: [],
        }).catch(() => {});
      } else {
        // Répondre immédiatement avant le kick pour éviter l'expiration
        await interaction.update({
          embeds: [{
            description: '👢 **Expulsé** par ' + interaction.user.tag,
            color: 0xE74C3C,
            footer: { text: 'Damoclès Security Bot' },
          }],
          components: [],
        }).catch(() => {});
        // Kick après la réponse
        await member.kick('Expulsé via /expulsion par ' + interaction.user.tag).catch(() => {});
        await db.kickMember(member.user, 'Expulsé via /expulsion', interaction.user.tag);
        console.log('👢 ' + member.user.tag + ' expulsé par ' + interaction.user.tag);
      }
    }

    if (action === 'keep') {
      await interaction.update({
        embeds: [{
          description: '✅ **Gardé** par ' + interaction.user.tag,
          color: 0x2ECC71,
          footer: { text: 'Damoclès Security Bot' },
        }],
        components: [],
      }).catch(() => {});
    }

    // Membre suivant
    if (queue) {
      queue.index++;
      if (queue.index < queue.list.length) {
        await sendNext(guild, queue.channel);
      } else {
        await queue.channel.send({ content: '✅ **Tous les membres ont été traités.**' });
        queues.delete(guild.id);
      }
    }
  },
};

async function sendNext(guild, channel) {
  const queue = queues.get(guild.id);
  if (!queue) return;

  const { member, daysInactive, lastActivity } = queue.list[queue.index];
  const total   = queue.list.length;
  const current = queue.index + 1;

  const lastStr = lastActivity
    ? 'Il y a ' + Math.floor((Date.now() - lastActivity) / 86400000) + ' jours'
    : '❌ Jamais posté';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('kick_' + member.id)
      .setLabel('👢 Expulser')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('keep_' + member.id)
      .setLabel('✅ Garder')
      .setStyle(ButtonStyle.Success),
  );

  await channel.send({
    embeds: [{
      title: '⚠️ Liste d\'expulsion — ' + current + ' / ' + total,
      color: 0xE74C3C,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: 'Membre',             value: '<@' + member.id + '> (' + member.user.tag + ')', inline: false },
        { name: 'Arrivé le',          value: member.joinedAt?.toLocaleDateString('fr-FR') ?? '?', inline: true },
        { name: 'Dernière activité',  value: lastStr, inline: true },
        { name: 'Inactif depuis',     value: '**' + daysInactive + ' jours**', inline: true },
      ],
      footer: { text: 'Damoclès Security Bot — Choisissez une action pour continuer' },
    }],
    components: [row],
  });
}
