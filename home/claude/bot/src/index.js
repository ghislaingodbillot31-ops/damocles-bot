require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { verifyMember, handleVerifyButton } = require('./verification');
const { sendWelcomeAfterReglement, sendLeave, getWelcomeConfig, setWelcomeConfig } = require('./welcome');
const { createTicket, takeTicket, closeTicket } = require('./tickets');
const { checkRaid, checkSpam, checkLinks }       = require('./antiraid');
const { checkNewMember }                         = require('./antidoublecompte');
const db                                         = require('./database');
const { log }                                    = require('./logger');
const { createDashboard, setClient }             = require('./dashboard');
const scheduledMessages                          = require('./scheduled-messages');
const { startKeepAlive }                         = require('./keepalive');

const VERIFICATION_ROLE_ID = process.env.VERIFICATION_ROLE_ID;
const ATTENTE_ROLE_ID      = process.env.ATTENTE_ROLE_ID;
const REGLEMENT_ROLE_ID    = process.env.REGLEMENT_ROLE_ID;
const ACTIVE_ROLE_ID       = process.env.ACTIVE_ROLE_ID;

// Suivi premier message : userId -> true
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

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);
  console.log('📡 Serveurs : ' + client.guilds.cache.size);
  setClient(client);
  createDashboard();
  console.log('💾 DB : ' + db.getAllMembers().length + ' membres');
  scheduledMessages.startAll(client);
  startKeepAlive();
});

// ── Nouveau membre ────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  console.log('👋 Nouveau membre : ' + member.user.tag);

  db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });

  // Rôle Vérification
  if (VERIFICATION_ROLE_ID) await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});

  await checkNewMember(member);
  await log(client, 'member_join', { userId: member.id });
  await verifyMember(member);
});

// ── Départ membre ─────────────────────────────────────────────────────────────
client.on(Events.GuildMemberRemove, async member => {
  if (member.user.bot) return;
  db.memberLeft(member.user);
  await sendLeave(member);
  await log(client, 'member_left', { userId: member.id });
  console.log('🚪 Départ : ' + member.user.tag);
});

// ── Ban ───────────────────────────────────────────────────────────────────────
client.on(Events.GuildBanAdd, async ban => {
  db.banMember(ban.user, ban.reason || 'Aucune raison', 'Discord');
});

// ── Messages ──────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const member = message.member;
  if (!member) return;

  await checkSpam(client, message);
  await checkLinks(client, message);

  // Détection premier message → rôle Membre validé
  if (
    ACTIVE_ROLE_ID &&
    member.roles.cache.has(REGLEMENT_ROLE_ID) &&
    !member.roles.cache.has(ACTIVE_ROLE_ID) &&
    !firstMessageDone.has(member.id)
  ) {
    firstMessageDone.add(member.id);
    await member.roles.add(ACTIVE_ROLE_ID).catch(() => {});
    db.upsertMember(member.user, {
      firstMessageAt: new Date().toISOString(),
      status: 'active',
    });
    db.recordActivity(member.id, 'first_message');
    await log(client, 'member_activated', { userId: member.id, source: 'premier message' });
    console.log('✅ Premier message — Membre validé : ' + member.user.tag);
  }
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  // Commandes slash
  if (interaction.isChatInputCommand()) {
    const cmdMap = {
      'expulsion': './commands/expulsion',
      'banid':     './commands/banid',
      'sanction':  './commands/sanction',
      'bouton':    './commands/bouton',
      'analyse':   './commands/analyse',
    };
    const cmdPath = cmdMap[interaction.commandName];
    if (cmdPath) {
      try { await require(cmdPath).execute(interaction); }
      catch (err) { console.error('Erreur commande :', err.message); }
    }
    return;
  }

  // Menus contextuels
  if (interaction.isContextMenuCommand()) {
    if (interaction.commandName === 'Ajouter bouton règlement') {
      await require('./commands/ajouter-bouton-reglement').execute(interaction);
    }
    if (interaction.commandName === 'Ajouter bouton ticket') {
      await require('./commands/ticket').execute(interaction);
    }
    return;
  }

  // Boutons
  if (!interaction.isButton()) return;
  const id = interaction.customId;

  // Vérification admin
  if (id.startsWith('verify_')) {
    await handleVerifyButton(interaction);
    return;
  }

  // Acceptation règlement
  if (id === 'accept_reglement') {
    const member = interaction.member;

    // Retirer Attente → donner Règlement validé
    if (ATTENTE_ROLE_ID)   await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID) await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});

    db.reglementAccepted(member.id);
    await log(client, 'reglement_accepted', { userId: member.id });

    // Message de bienvenue dans #bienvenue
    await sendWelcomeAfterReglement(member);

    await interaction.reply({
      embeds: [{
        description: '✅ **Règlement accepté !**\nConsulte le salon **#bienvenue** pour la suite.',
        color: 0x2ECC71,
        footer: { text: 'Damoclès Security Bot' },
      }],
      flags: 64,
    });
    console.log('📜 Règlement accepté : ' + member.user.tag);
    return;
  }

  // Tickets
  if (id === 'ticket_create') { await createTicket(interaction); return; }
  if (id.startsWith('ticket_take_'))  { await takeTicket(interaction, id.replace('ticket_take_', '')); return; }
  if (id.startsWith('ticket_close_')) { await closeTicket(interaction, id.replace('ticket_close_', '')); return; }

  // Rôles boutons
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

  // Scanner
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

client.login(process.env.DISCORD_TOKEN);
