require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { verifyMember, handleVerifyButton } = require('./verification');
const { sendWelcome, sendLeave }           = require('./welcome');
const { createTicket, takeTicket, closeTicket } = require('./tickets');
const { checkRaid, checkSpam, checkLinks } = require('./antiraid');
const { checkNewMember }                   = require('./antidoublecompte');
const db                                   = require('./database');
const { log }                              = require('./logger');
const { createDashboard, setClient }       = require('./dashboard');
const scheduledMessages                    = require('./scheduled-messages');
const { startKeepAlive }                   = require('./keepalive');

const ATTENTE_ROLE_ID  = process.env.ATTENTE_ROLE_ID;
const ACTIVE_ROLE_ID   = process.env.ACTIVE_ROLE_ID;
const REGLEMENT_ROLE_ID = process.env.REGLEMENT_ROLE_ID;
const REGLES_ACCEPTEES_ROLE_ID = process.env.REGLES_ACCEPTEES_ROLE_ID || process.env.ACTIVE_ROLE_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);
  console.log('📡 Serveurs : ' + client.guilds.cache.size);

  setClient(client);
  createDashboard();

  const allMembers = db.getAllMembers();
  console.log('💾 DB : ' + allMembers.length + ' membres');

  scheduledMessages.startAll(client);
  startKeepAlive();
});

// ── Nouveau membre ────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;

  console.log('👋 Nouveau membre : ' + member.user.tag);

  // Enregistrer en DB
  db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });

  // Donner le rôle En attente
  if (ATTENTE_ROLE_ID) {
    await member.roles.add(ATTENTE_ROLE_ID).catch(() => {});
  }

  // Anti-double compte
  await checkNewMember(member);

  // Message de bienvenue
  await sendWelcome(member);

  // Log
  await log(client, 'member_join', { userId: member.id });

  // Vérification automatique
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

  await checkSpam(client, message);
  await checkLinks(client, message);
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  // Commandes slash
  if (interaction.isChatInputCommand()) {
    const commands = {};
    try {
      commands['expulsion'] = require('./commands/expulsion');
      commands['banid']     = require('./commands/banid');
      commands['sanction']  = require('./commands/sanction');
      commands['bouton']    = require('./commands/bouton');
      commands['analyse']   = require('./commands/analyse');
    } catch {}

    const cmd = commands[interaction.commandName];
    if (cmd) {
      try { await cmd.execute(interaction); }
      catch (err) { console.error('Erreur commande :', err.message); }
    }
    return;
  }

  // Menus contextuels
  if (interaction.isContextMenuCommand()) {
    const name = interaction.commandName;
    if (name === 'Ajouter bouton règlement') {
      const { execute } = require('./commands/ajouter-bouton-reglement');
      await execute(interaction);
    }
    if (name === 'Ajouter bouton ticket') {
      const { execute } = require('./commands/ticket');
      await execute(interaction);
    }
    return;
  }

  // Boutons
  if (interaction.isButton()) {
    const id = interaction.customId;

    // ── Vérification staff ─────────────────────────────────────────────────
    if (id.startsWith('verify_')) {
      await handleVerifyButton(interaction);
      return;
    }

    // ── Acceptation du règlement ──────────────────────────────────────────
    if (id === 'accept_reglement') {
      const member = interaction.member;
      if (REGLEMENT_ROLE_ID) await member.roles.remove(REGLEMENT_ROLE_ID).catch(() => {});
      if (ATTENTE_ROLE_ID)   await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
      if (REGLES_ACCEPTEES_ROLE_ID) await member.roles.add(REGLES_ACCEPTEES_ROLE_ID).catch(() => {});

      await interaction.reply({
        embeds: [{
          description: '✅ **Règlement accepté !**\nBienvenue sur le serveur <@' + member.id + '> !',
          color: 0x2ECC71,
          footer: { text: 'Damoclès Security Bot' },
        }],
        flags: 64, // ephemeral
      });

      await log(client, 'reglement_accepted', { userId: member.id });
      console.log('📜 Règlement accepté : ' + member.user.tag);
      return;
    }

    // ── Tickets ────────────────────────────────────────────────────────────
    if (id === 'ticket_create') {
      await createTicket(interaction);
      return;
    }
    if (id.startsWith('ticket_take_')) {
      await takeTicket(interaction, id.replace('ticket_take_', ''));
      return;
    }
    if (id.startsWith('ticket_close_')) {
      await closeTicket(interaction, id.replace('ticket_close_', ''));
      return;
    }

    // ── Rôles via boutons ──────────────────────────────────────────────────
    if (id.startsWith('role_')) {
      const roleId = id.replace('role_', '');
      const role   = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        await interaction.reply({ content: '❌ Rôle introuvable.', flags: 64 });
        return;
      }
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

    // ── Kick/ignore depuis scanner ─────────────────────────────────────────
    if (id.startsWith('kick_')) {
      const memberId = id.replace('kick_', '');
      const target   = await interaction.guild.members.fetch(memberId).catch(() => null);
      if (target) {
        await target.kick('Inactivité prolongée');
        await interaction.update({ embeds: [{ description: '👢 <@' + memberId + '> expulsé.', color: 0xE74C3C }], components: [] });
      }
      return;
    }
    if (id.startsWith('ignore_')) {
      await interaction.update({ embeds: [{ description: '✅ Ignoré.', color: 0x2ECC71 }], components: [] });
      return;
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
