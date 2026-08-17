const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { log } = require('./logger');
require('dotenv').config();

const config = require('./config');

/**
 * Poste le bouton ticket dans un salon
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
  const member      = interaction.member;
  const guild       = interaction.guild;
  const cfg         = config.get();
  const maxTickets  = cfg.TICKET_MAX_PER_USER || 1;
  const categoryId  = cfg.TICKET_CATEGORY_ID  || null;
  const supportRoleId = cfg.TICKET_SUPPORT_ROLE_ID || null;

  console.log('🎫 Création ticket — catégorie:', categoryId || 'aucune', '| support:', supportRoleId || 'aucun');

  // Vérifier si le membre a déjà un ticket ouvert
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

  const channelName = 'ticket-' + member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  // Permissions explicites — on construit tout manuellement
  const permissionOverwrites = [
    // @everyone : aucun accès
    {
      id:   guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // Le membre qui ouvre : accès complet en lecture/écriture
    {
      id:    member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  // Rôle support : peut voir et lire, mais pas écrire avant prise en charge
  if (supportRoleId) {
    permissionOverwrites.push({
      id:    supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
      deny: [PermissionFlagsBits.SendMessages],
    });
  }

  // Créer le salon avec les permissions explicites dès la création
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: 'Ticket de ' + member.user.tag + ' | ID: ' + member.id,
      parent: categoryId || null,
      permissionOverwrites,
    });
    console.log('🎫 Salon créé:', ticketChannel.name, '| parent:', ticketChannel.parentId || 'aucun');
  } catch (err) {
    console.error('❌ Erreur création ticket:', err.message);
    await interaction.reply({ content: '❌ Impossible de créer le ticket : ' + err.message, ephemeral: true });
    return;
  }

  // Message d'accueil
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
      title: '🎫 Ticket — ' + member.user.username,
      description: '<@' + member.id + '>\n\n' +
        (cfg.TICKET_WELCOME || 'Merci pour ton ticket ! Un responsable s\'occupera de toi.') +
        '\n\n📌 Merci de clore ton ticket une fois ta demande traitée.',
      color: 0x5865F2,
      footer: { text: 'Damoclès Security Bot' },
      timestamp: new Date().toISOString(),
    }],
    components: [row],
  });

  await interaction.reply({ content: '✅ Ton ticket a été créé : <#' + ticketChannel.id + '>', ephemeral: true });

  await log(interaction.client, 'ticket_created', {
    userId: member.id,
    channelId: ticketChannel.id,
    channelName,
  });
}

/**
 * Prise en charge du ticket
 */
async function takeTicket(interaction, memberId) {
  const cfg = config.get();
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
        '📌 Merci de clore ton ticket une fois ta demande traitée.',
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
