const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { log } = require('./logger');
require('dotenv').config();

const config  = require('./config');

/**
 * Poste le bouton ticket sous un message (menu contextuel)
 */
async function postTicketButton(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('🎫 Ouvrir un ticket')
      .setStyle(ButtonStyle.Primary),
  );

  await channel.send({ components: [row] });
}

/**
 * Crée un channel ticket privé pour le membre
 */
async function createTicket(interaction) {
  const member   = interaction.member;
  const guild    = interaction.guild;
  const cfg       = config.get();
  const maxTickets = cfg.TICKET_MAX_PER_USER || 1;

  // Vérifier si le membre a déjà le max de tickets ouverts
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

  // Créer le channel
  const categoryId    = cfg.TICKET_CATEGORY_ID;
  const supportRoleId = cfg.TICKET_SUPPORT_ROLE_ID;

  const channelName = 'ticket-' + member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  const permissionOverwrites = [
    // @everyone ne voit pas
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    // Le membre peut voir et écrire
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  if (supportRoleId) {
    // Le rôle support peut voir MAIS ne peut pas écrire tant que pas pris en charge
    permissionOverwrites.push({
      id: supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      deny: [PermissionFlagsBits.SendMessages],
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: 'Ticket de ' + member.user.tag + ' | ID: ' + member.id,
    parent: categoryId || null,
    permissionOverwrites,
  });

  // Message d'accueil dans le ticket
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_take_' + member.id)
      .setLabel('✋ Prise en charge')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_close_' + member.id)
      .setLabel('🔒 Clôturer')
      .setStyle(ButtonStyle.Danger),
  );

  await ticketChannel.send({
    content: supportRoleId ? '<@&' + supportRoleId + '>' : '',
    embeds: [{
      title: '🎫 Ticket #' + channelName,
      description: '<@' + member.id + '>\n\n' + (cfg.TICKET_WELCOME || 'Merci pour ton ticket ! Un responsable s\'occupera de toi.') + '\n\n📌 Merci de clore ton ticket si nous avons répondu à ta question ou tes attentes.',
      color: 0x5865F2,
      footer: { text: 'Damoclès Security Bot' },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  });

  await interaction.reply({
    content: '✅ Ticket ouvert !',
    ephemeral: true,
  });

  // Log
  const client = interaction.client;
  await log(client, 'ticket_created', { userId: member.id, channelId: ticketChannel.id, channelName });
  console.log('🎫 Ticket créé : ' + channelName + ' pour ' + member.user.tag);
}

/**
 * Prise en charge du ticket
 */
async function takeTicket(interaction, memberId) {
  const cfg = require('./config').get();
  const supportRoleId = cfg.TICKET_SUPPORT_ROLE_ID;

  // Débloquer l'écriture pour le rôle support
  if (supportRoleId) {
    await interaction.channel.permissionOverwrites.edit(supportRoleId, {
      SendMessages: true,
    }).catch(() => {});
  }

  await interaction.update({
    embeds: [{
      title: '🎫 Ticket pris en charge',
      description: [
        '<@' + memberId + '>, ton ticket a été pris en charge par <@' + interaction.user.id + '> !',
        '',
        '> Un responsable s\'occupe de ta demande.',
        '',
        '📌 Merci de clore ton ticket si nous avons répondu à ta question ou tes attentes.',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'Damoclès Security Bot' },
      timestamp: new Date().toISOString(),
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_take_' + memberId)
        .setLabel('✋ Pris en charge')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('ticket_close_' + memberId)
        .setLabel('🔒 Clôturer')
        .setStyle(ButtonStyle.Danger),
    )],
  });

  await log(interaction.client, 'ticket_taken', {
    userId: memberId,
    modId: interaction.user.id,
    channelId: interaction.channel.id,
  });
  console.log('✋ Ticket pris en charge par ' + interaction.user.tag);
}

/**
 * Clôture du ticket
 */
async function closeTicket(interaction, memberId) {
  await interaction.reply({
    content: '🔒 Ticket clôturé par <@' + interaction.user.id + '>. Ce salon sera supprimé dans 5 secondes.',
  });

  await log(interaction.client, 'ticket_closed', {
    userId: memberId,
    modId: interaction.user.id,
    channelId: interaction.channel.id,
    channelName: interaction.channel.name,
  });

  console.log('🔒 Ticket clôturé : ' + interaction.channel.name);

  setTimeout(async () => {
    await interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = { postTicketButton, createTicket, takeTicket, closeTicket };
