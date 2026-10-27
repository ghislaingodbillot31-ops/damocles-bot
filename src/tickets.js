const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { log } = require('./logger');
const db = require('./database');

// Trace l'événement dans la fiche du membre : c'est ce que lit la page Tickets du dashboard.
function historique(userId, event, extra) {
  return db.updateMember(userId, null, { history: { event, date: new Date().toISOString(), ...extra } })
    .catch(err => console.error('⚠️ historique ticket :', err.message));
}
const { panneau } = require('./embed-format');
require('dotenv').config();

const config = require('./config');

// Panneau d'ouverture : un embed + le bouton, publié au démarrage et modifié en place (jamais en double).
function panneauTicket() {
  return panneau({
    embeds: [{
      title: '🎫  SUPPORT  ·  OUVRIR UN TICKET',
      description: 'Une question ou un problème ? Clique sur le bouton : un salon privé s\'ouvre avec le staff.',
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_create').setLabel('🎫 Ouvrir un ticket').setStyle(ButtonStyle.Primary),
    )],
  });
}

async function startTickets(client) {
  const channel = await client.channels.fetch(process.env.TICKET_CHANNEL_ID || '').catch(() => null);
  if (!channel) return console.warn('⚠️ Tickets : salon introuvable (TICKET_CHANNEL_ID)');
  const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => new Map());
  const existant = [...msgs.values()].find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'ticket_create')));
  if (existant) await existant.edit(panneauTicket());
  else await channel.send(panneauTicket());
  await require('./nettoyage').epurer(client, channel.id, false);
  console.log('🎫 Tickets · prêt (#' + channel.name + ')');
}

// Crée le salon privé d'un ticket (joueur + rôle support) et y poste le message d'accueil avec les boutons
// Prise en charge / Clôturer. Sert aux tickets classiques ET aux demandes d'échange de la boutique.
//   prefix : début du nom du salon ('ticket' compte dans la limite par joueur, les autres non)
async function ouvrirSalon(guild, member, { prefix = 'ticket', objet = 'Ticket', welcome } = {}) {
  const cfg = config.get();
  const categoryId = process.env.TICKET_CATEGORY_ID || cfg.TICKET_CATEGORY_ID || null;
  const supportRoleId = roleSupport(guild);
  const name = prefix + '-' + member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
  ];
  if (supportRoleId) {
    permissionOverwrites.push({
      id: supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      deny: [PermissionFlagsBits.SendMessages],
    });
  }

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic: objet + ' de ' + member.user.tag + ' | ID: ' + member.id,
    parent: categoryId,
    permissionOverwrites,
  });
  console.log('🎫 Salon créé:', channel.name, '| parent:', channel.parentId || 'aucun');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_take_' + member.id).setLabel('✋ Prise en charge').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_close_' + member.id).setLabel('🔒 Clôturer').setStyle(ButtonStyle.Danger),
  );
  await channel.send(panneau({
    content: supportRoleId ? '<@&' + supportRoleId + '>' : '',
    embeds: [{
      title: '🎫 ' + objet + ' · ' + member.user.username,
      description: '<@' + member.id + '>\n\n' +
        (welcome || 'Merci pour ton ticket ! Un responsable s\'occupera de toi.') +
        '\n\n📌 Merci de clore ton ticket une fois ta demande traitée.',
      color: 0x5865F2,
      footer: { text: 'MonCopainBot' },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  }));
  return channel;
}

async function createTicket(interaction) {
  const member      = interaction.member;
  const guild       = interaction.guild;
  const cfg         = config.get();
  const maxTickets  = cfg.TICKET_MAX_PER_USER || 1;

  const existingTickets = guild.channels.cache.filter(c =>
    c.topic?.includes(member.id) && c.name.startsWith('ticket-')
  );
  if (existingTickets.size >= maxTickets) {
    await interaction.reply({
      content: '❌ Tu as déjà ' + existingTickets.size + ' ticket(s) ouvert(s). Maximum : ' + maxTickets,
      ephemeral: true,
    });
    return;
  }

  let ticketChannel;
  try {
    ticketChannel = await ouvrirSalon(guild, member, { welcome: cfg.TICKET_WELCOME });
  } catch (err) {
    console.error('❌ Erreur création ticket:', err.message);
    await interaction.reply({ content: '❌ Impossible de créer le ticket : ' + err.message, ephemeral: true });
    return;
  }

  await interaction.reply({ content: '✅ Ton ticket a été créé : <#' + ticketChannel.id + '>', ephemeral: true });
  await log(interaction.client, 'ticket_created', { userId: member.id, channelId: ticketChannel.id, channelName: ticketChannel.name });
  await historique(member.id, 'ticket_created', { channelId: ticketChannel.id, channelName: ticketChannel.name });
}

// Rôle support : celui configuré (TICKET_SUPPORT_ROLE_ID) s'il existe encore sur le serveur, sinon le rôle Modérateur
function roleSupport(guild) {
  const cfg = config.get();
  const id = process.env.TICKET_SUPPORT_ROLE_ID || cfg.TICKET_SUPPORT_ROLE_ID;
  if (id && guild.roles.cache.has(id)) return id;
  return guild.roles.cache.find(r => /mod[eé]rat/i.test(r.name) && !r.managed)?.id || null;
}

// Membre du rôle support (@ticket) ? Les administrateurs ne sont PAS dispensés : le rôle est exigé.
function estSupport(member) {
  const id = roleSupport(member.guild);
  return !!id && member.roles.cache.has(id);
}

async function takeTicket(interaction, memberId) {
  const supportRoleId = roleSupport(interaction.guild);

  // Seuls les membres du rôle @ticket peuvent prendre un ticket en charge
  if (!supportRoleId || !interaction.member.roles.cache.has(supportRoleId)) {
    await interaction.reply({ content: '❌ Seuls les membres du rôle <@&' + (supportRoleId || '') + '> peuvent prendre un ticket en charge.', flags: 64, allowedMentions: { parse: [] } });
    return;
  }

  if (supportRoleId) {
    await interaction.channel.permissionOverwrites.edit(supportRoleId, { SendMessages: true }).catch(() => {});
  }

  await interaction.update({
    ...panneau({ embeds: [{
      title: '🎫 Ticket pris en charge',
      description: '<@' + memberId + '>, ton ticket a été pris en charge par <@' + interaction.user.id + '> !\n\n> Un responsable s\'occupe de ta demande.\n\n📌 Merci de clore ton ticket une fois ta demande traitée.',
      color: 0x2ECC71,
      footer: { text: 'MonCopainBot' },
      timestamp: new Date().toISOString(),
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_take_' + memberId).setLabel('✋ Pris en charge').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('ticket_close_' + memberId).setLabel('🔒 Clôturer').setStyle(ButtonStyle.Danger),
    )],
  });

  await log(interaction.client, 'ticket_taken', { userId: memberId, modId: interaction.user.id, channelId: interaction.channel.id });
  await historique(memberId, 'ticket_taken', { channelId: interaction.channel.id, modId: interaction.user.id });
  console.log('✋ Ticket pris en charge par ' + interaction.user.tag);
}

async function closeTicket(interaction, memberId) {
  await interaction.reply({ content: '🔒 Ticket clôturé par <@' + interaction.user.id + '>. Ce salon sera supprimé dans 5 secondes.' });
  await log(interaction.client, 'ticket_closed', { userId: memberId, modId: interaction.user.id, channelId: interaction.channel.id, channelName: interaction.channel.name });
  await historique(memberId, 'ticket_closed', { channelId: interaction.channel.id, channelName: interaction.channel.name, modId: interaction.user.id });
  console.log('🔒 Ticket clôturé : ' + interaction.channel.name);
  setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
}

module.exports = { startTickets, ouvrirSalon, estSupport, createTicket, takeTicket, closeTicket };