require('dotenv').config();

// Empêcher le bot de crasher sur les erreurs non gérées
process.on('unhandledRejection', err => {
  console.error('⚠️ Erreur non gérée :', err.message || err);
});
process.on('uncaughtException', err => {
  console.error('⚠️ Exception non capturée :', err.message || err);
});

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { verifyMember, handleVerifyButton }             = require('./verification');
const { sendWelcomeAfterReglement, sendLeave }         = require('./welcome');
const { createTicket, takeTicket, closeTicket }        = require('./tickets');
const { checkSpam, checkLinks }                        = require('./antiraid');
const { checkNewMember }                               = require('./antidoublecompte');
const db                                               = require('./database');
const { log }                                          = require('./logger');
const { createDashboard, setClient }                   = require('./dashboard');
const scheduledMessages                                = require('./scheduled-messages');
const { startKeepAlive }                               = require('./keepalive');
const { startBirthdayTasks }                           = require('./birthday');
const cron                                             = require('node-cron');

const VERIFICATION_ROLE_ID = process.env.VERIFICATION_ROLE_ID;
const ATTENTE_ROLE_ID      = process.env.ATTENTE_ROLE_ID;
const REGLEMENT_ROLE_ID    = process.env.REGLEMENT_ROLE_ID;
const ACTIVE_ROLE_ID       = process.env.ACTIVE_ROLE_ID;
const GENERAL_CHANNEL_ID   = '1538533261314236527';

const firstMessageDone = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);
  console.log('📡 Serveurs : ' + client.guilds.cache.size);
  setClient(client);
  console.log('💾 DB : ' + db.getAllMembers().length + ' membres');
  scheduledMessages.startAll(client);
  startKeepAlive();
  startBirthdayTasks(client, cron);
});

client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  console.log('👋 Nouveau membre : ' + member.user.tag);
  db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });
  if (VERIFICATION_ROLE_ID) await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});
  await checkNewMember(member);
  await log(client, 'member_join', { userId: member.id });
  await verifyMember(member);
});

client.on(Events.GuildMemberRemove, async member => {
  if (member.user.bot) return;
  db.memberLeft(member.user);
  await sendLeave(member);
  await log(client, 'member_left', { userId: member.id });
  console.log('🚪 Départ : ' + member.user.tag);
});

client.on(Events.GuildBanAdd, async ban => {
  db.banMember(ban.user, ban.reason || 'Aucune raison', 'Discord');
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  const member = message.member;
  if (!member) return;

  await checkSpam(client, message);
  await checkLinks(client, message);

  // Premier message dans #général → rôle Membre validé
  if (
    message.channel.id === GENERAL_CHANNEL_ID &&
    ACTIVE_ROLE_ID &&
    REGLEMENT_ROLE_ID &&
    member.roles.cache.has(REGLEMENT_ROLE_ID) &&
    !member.roles.cache.has(ACTIVE_ROLE_ID) &&
    !firstMessageDone.has(member.id)
  ) {
    firstMessageDone.add(member.id);
    await member.roles.add(ACTIVE_ROLE_ID).catch(() => {});
    db.upsertMember(member.user, { firstMessageAt: new Date().toISOString(), status: 'active' });
    await log(client, 'member_activated', { userId: member.id, source: 'premier message général' });
    console.log('✅ Premier message #général — Membre validé : ' + member.user.tag);
  }
});

client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {
    const cmdMap = {
      'anniversaire': './commands/anniversaire',
      'verifier':     './commands/verifier',
      'sync-db':      './commands/sync-db',
      'expulsion':    './commands/expulsion',
      'banid':        './commands/banid',
      'sanction':     './commands/sanction',
      'bouton':       './commands/bouton',
      'analyse':      './commands/analyse',
    };
    const cmdPath = cmdMap[interaction.commandName];
    if (cmdPath) {
      try { await require(cmdPath).execute(interaction); }
      catch (err) { console.error('Erreur commande :', err.message); }
    }
    return;
  }

  if (interaction.isContextMenuCommand()) {
    if (interaction.commandName === 'Ajouter bouton règlement') {
      await require('./commands/ajouter-bouton-reglement').execute(interaction);
    }
    if (interaction.commandName === 'Ajouter bouton ticket') {
      await require('./commands/ticket').execute(interaction);
    }
    return;
  }

  if (!interaction.isButton()) return;
  const id = interaction.customId;

  if (id.startsWith('verify_')) {
    await handleVerifyButton(interaction);
    return;
  }

  if (id === 'accept_reglement') {
    const member = interaction.member;
    await interaction.reply({
      embeds: [{
        description: '✅ **Règlement accepté !**\nConsulte le salon **#bienvenue** pour la suite.',
        color: 0x2ECC71,
        footer: { text: 'Damoclès Security Bot' },
      }],
      flags: 64,
    });
    if (ATTENTE_ROLE_ID)      await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
    db.reglementAccepted(member.id);
    await log(client, 'reglement_accepted', { userId: member.id });
    await sendWelcomeAfterReglement(member);
    console.log('📜 Règlement accepté : ' + member.user.tag);
    return;
  }

  if (id === 'ticket_create') { await createTicket(interaction); return; }
  if (id.startsWith('ticket_take_'))  { await takeTicket(interaction, id.replace('ticket_take_', '')); return; }
  if (id.startsWith('ticket_close_')) { await closeTicket(interaction, id.replace('ticket_close_', '')); return; }

  if (id.startsWith('role_')) {
    const roleId = id.replace('role_', '');
    const role   = interaction.guild.roles.cache.get(roleId);
    if (!role) { await interaction.reply({ content: '❌ Rôle introuvable.', flags: 64 }); return; }
    const member = interaction.member;
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role);
      await interaction.reply({ content: '🔴 Rôle **' + role.name + '** retiré.', flags: 64 });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: '✅ Rôle **' + role.name + '** attribué.', flags: 64 });
    }
    return;
  }

  if (id.startsWith('kick_')) {
    const target = await interaction.guild.members.fetch(id.replace('kick_', '')).catch(() => null);
    if (target) await target.kick('Inactivité prolongée');
    await interaction.update({ embeds: [{ description: '👢 Expulsé.', color: 0xE74C3C }], components: [] });
    return;
  }
  if (id.startsWith('ignore_')) {
    await interaction.update({ embeds: [{ description: '✅ Ignoré.', color: 0x2ECC71 }], components: [] });
    return;
  }
});

createDashboard();
console.log('🔑 Token présent :', !!process.env.DISCORD_TOKEN);
console.log('🚀 Tentative de connexion Discord...');
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('🟢 Login Discord réussi');
}).catch(err => {
  console.error('❌ Erreur login Discord :', err.message);
});
