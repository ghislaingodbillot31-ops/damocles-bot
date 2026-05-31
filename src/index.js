const { Client, GatewayIntentBits, Partials, AuditLogEvent, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const db   = require('./database');
const activity = require('./activity');
const { updateStatusMessage } = require('./statusbot');
const { verifyMember, handleVerifyButton, setClient: setVerifClient } = require('./verification');
const { log } = require('./logger');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Commandes ────────────────────────────────────────────────────────────────
client.commands = new Collection();
const cmdFiles  = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of cmdFiles) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
  console.log(`📌 Commande : /${cmd.data.name}`);
}

const {
  VERIFICATION_ROLE_ID, REGLEMENT_ROLE_ID, ATTENTE_ROLE_ID,
  ACTIVE_ROLE_ID, INACTIVE_ROLE_ID, REGLES_ACCEPTEES_ROLE_ID,
  VERIFICATION_CHANNEL_ID, REGLEMENT_CHANNEL_ID,
  ATTENTE_CHANNEL_ID, ACTIVATE_CHANNEL_ID, CHAT_CHANNEL_ID,
  LOG_CHANNEL_ID, STATUS_CHANNEL_ID, DAMOCLES_LOG_CHANNEL_ID,
  EXCLUDED_ROLE_IDS: EXCLUDED_STR,
} = process.env;

const EXCLUDED_ROLE_IDS = (EXCLUDED_STR || '').split(',').filter(Boolean);

// ── Prêt ─────────────────────────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log(`\n✅ Bot connecté : ${client.user.tag}`);
  setVerifClient(client);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}\n`);

  for (const [, guild] of client.guilds.cache) {
    const members = await guild.members.fetch();
    for (const [, m] of members) {
      if (!m.user.bot) db.upsertMember(m.user, { joinedAt: m.joinedAt?.toISOString() });
    }
    console.log(`💾 DB : ${db.getStats().total} membres`);
    await activity.loadAllChannels(guild);
  }

  // Affichage animé au démarrage
  await updateStatusMessage(client, true);

  // Mise à jour silencieuse chaque lundi à 08h00
  const cron = require('node-cron');
  cron.schedule('0 8 * * 1', async () => {
    console.log('⏰ Mise à jour hebdomadaire du status-bot...');
    await updateStatusMessage(client, true);
  });

  // Analyse quotidienne à 6h
  cron.schedule('0 6 * * *', async () => {
    console.log('⏰ Analyse quotidienne automatique...');
    for (const [, guild] of client.guilds.cache) {
      const analyseCmd = client.commands.get('analyse');
      if (analyseCmd && analyseCmd.runAuto) {
        const result = await analyseCmd.runAuto(guild);
        if (result) await log(client, 'analyse_done', result);
      }
    }
  });
});

// ── Nouveau membre ────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  console.log(`👋 Nouveau membre : ${member.user.tag}`);

  db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });
  await log(client, 'member_join', { userId: member.id });

  // Donner le rôle Vérification en priorité
  if (VERIFICATION_ROLE_ID) {
    await member.roles.add(VERIFICATION_ROLE_ID).catch(console.error);
    console.log(`🔍 Rôle Vérification attribué à ${member.user.tag}`);
  }

  // Attendre 2s puis lancer la vérification (évite les conflits avec le scan)
  setTimeout(async () => {
    await verifyMember(member);
    await updateStatusMessage(client);
  }, 2000);
});

// ── Membre qui quitte ─────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;
  try {
    await new Promise(r => setTimeout(r, 1500));
    const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
    const log  = logs.entries.first();
    if (log && log.target.id === member.user.id && Date.now() - log.createdTimestamp < 5000) {
      db.kickMember(member.user, log.reason || 'Aucune raison', log.executor?.tag);
    } else {
      db.memberLeft(member.user);
    }
  } catch { db.memberLeft(member.user); }
  await updateStatusMessage(client);
});

// ── Ban ───────────────────────────────────────────────────────────────────────
client.on('guildBanAdd', async (ban) => {
  try {
    await new Promise(r => setTimeout(r, 1500));
    const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const log  = logs.entries.first();
    const banReason = logs?.entries?.first()?.reason || 'Aucune raison';
    const banMod    = logs?.entries?.first()?.executor?.id || '0';
    db.banMember(ban.user, banReason, banMod);
    await log(client, 'member_banned', { userId: ban.user.id, modId: banMod, reason: banReason });
  } catch { db.banMember(ban.user, 'Aucune raison', 'Inconnu'); }
  await updateStatusMessage(client);
});

// ── Messages ──────────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const member = message.member;
  if (!member) return;

  const channelId = message.channel.id;

  // ── Salon #status-joueurs : supprime les messages immédiatement ──────────
  if (channelId === STATUS_CHANNEL_ID) {
    await message.delete().catch(() => {});
    return;
  }

  // ── Salon #reglement : admin poste → bot ajoute bouton dessous ────────────
  if (channelId === REGLEMENT_CHANNEL_ID) {
    // Seuls les membres exclus (admins) peuvent poster ici
    const isAdmin = EXCLUDED_ROLE_IDS.some(id => member.roles.cache.has(id));
    if (isAdmin) {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('reglement_accept')
          .setLabel('✅ J\'accepte le règlement')
          .setStyle(ButtonStyle.Success),
      );
      await message.channel.send({ components: [row] });
    }
    return;
  }

  // ── Salon #active-toi : supprime le message, active si inactif ────────────
  if (channelId === ACTIVATE_CHANNEL_ID) {
    await message.delete().catch(() => {});
    if (member.roles.cache.has(INACTIVE_ROLE_ID)) {
      await activateMember(member, 'message');
    }
    return;
  }

  // ── Salon #chat : premier message → rôle Actif ───────────────────────────
  if (channelId === CHAT_CHANNEL_ID) {
    const hasRegles = REGLES_ACCEPTEES_ROLE_ID && member.roles.cache.has(REGLES_ACCEPTEES_ROLE_ID);
    const hasRegle  = member.roles.cache.has(REGLEMENT_ROLE_ID);

    if ((hasRegles || hasRegle) && !member.roles.cache.has(ACTIVE_ROLE_ID)) {
      await activateMember(member, 'premier message dans #chat');
    }
  }

  // ── Tous les autres salons : activité + activation en direct ────────────
  activity.recordActivity(member.id);
  db.recordActivity(member.id, 'message');

  // Dès qu'un joueur poste → rôle Actif immédiatement
  if (!member.roles.cache.has(ACTIVE_ROLE_ID)) {
    await activateMember(member, 'message');
  }
});

// ── Vocal ─────────────────────────────────────────────────────────────────────
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;
    activity.recordActivity(member.id);
    db.recordActivity(member.id, 'vocal');
    if (member.roles.cache.has(INACTIVE_ROLE_ID)) {
      await activateMember(member, 'vocal');
    }
  }
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // Commandes slash ET menus contextuels
  if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`Erreur ${interaction.commandName} :`, err.message);
      const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
      try {
        if (interaction.deferred) await interaction.editReply(msg);
        else if (!interaction.replied) await interaction.reply(msg);
      } catch {}
    }
    return;
  }

  // Boutons
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Bouton règlement accepté
    if (id === 'reglement_accept') {
      const member = interaction.member;

      // Déjà actif
      if (member.roles.cache.has(ACTIVE_ROLE_ID)) {
        await interaction.reply({ content: '✅ Tu es déjà membre actif !', ephemeral: true });
        return;
      }

      // Donner le rôle Règles acceptées
      if (REGLES_ACCEPTEES_ROLE_ID) {
        await member.roles.add(REGLES_ACCEPTEES_ROLE_ID).catch(console.error);
        console.log(`✅ Rôle Règles acceptées donné à ${member.user.tag}`);
      } else {
        console.error('❌ REGLES_ACCEPTEES_ROLE_ID manquant dans .env');
      }

      const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID;
      await interaction.reply({
        content: '✅ Règlement accepté ! Rends-toi dans <#' + CHAT_CHANNEL_ID + '> et dis bonjour pour accéder au serveur.',
        ephemeral: true
      });
      console.log(`📜 ${member.user.tag} a accepté le règlement → rôle Règles acceptées attribué`);
      await log(client, 'reglement_accepted', { userId: member.id });

      // Log
      if (LOG_CHANNEL_ID) {
        const logCh = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logCh) await logCh.send({
          embeds: [{
            title: '📜 Règlement accepté',
            color: 0x3498DB,
            thumbnail: { url: member.user.displayAvatarURL() },
            fields: [
              { name: 'Membre', value: `<@${member.id}> (${member.user.tag})`, inline: true },
              { name: 'Date', value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }), inline: true },
            ],
            footer: { text: 'Damoclès Security Bot' },
            timestamp: new Date().toISOString(),
          }]
        }).catch(() => {});
      }
      return;
    }

    // Boutons vérification admin
    if (id.startsWith('verify_')) {
      await handleVerifyButton(interaction);
      await updateStatusMessage(client);
      return;
    }

    // Boutons expulsion
    if (id.startsWith('kick_') || id.startsWith('keep_')) {
      const cmd = client.commands.get('expulsion');
      if (cmd) await cmd.handleButton(interaction);
      await updateStatusMessage(client);
      return;
    }

    // Boutons rôles
    if (id.startsWith('role_')) {
      const roleId = id.replace('role_', '');
      const cmd = client.commands.get('bouton');
      if (cmd) {
        const hadRole = interaction.member.roles.cache.has(roleId);
        await cmd.handleRoleButton(interaction, roleId);
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) await log(client, hadRole ? 'role_removed' : 'role_added', { userId: interaction.user.id, roleName: role.name });
      }
      return;
    }
  }
});

// ── Activation ────────────────────────────────────────────────────────────────
async function activateMember(member, source) {
  try {
    if (member.roles.cache.has(INACTIVE_ROLE_ID)) {
      await member.roles.remove(INACTIVE_ROLE_ID).catch(() => {});
    }
    if (ACTIVE_ROLE_ID && !member.roles.cache.has(ACTIVE_ROLE_ID)) {
      await member.roles.add(ACTIVE_ROLE_ID).catch(() => {});
    }
    // Retirer aussi Règlement si présent (étape franchie)
    if (REGLEMENT_ROLE_ID && member.roles.cache.has(REGLEMENT_ROLE_ID)) {
      await member.roles.remove(REGLEMENT_ROLE_ID).catch(() => {});
    }
    db.recordActivity(member.id, source);
    console.log(`✅ ${member.user.tag} activé (${source})`);
    await log(client, 'member_activated', { userId: member.id, source });

    // Log
    if (LOG_CHANNEL_ID) {
      const ch = member.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (ch) await ch.send({
        embeds: [{
          title: '✅ Membre activé',
          color: 0x2ECC71,
          thumbnail: { url: member.user.displayAvatarURL() },
          fields: [
            { name: 'Membre', value: `<@${member.id}> (${member.user.tag})`, inline: true },
            { name: 'Via',    value: source, inline: true },
            { name: 'Date',   value: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) },
          ],
          footer: { text: 'Damoclès Security Bot' },
          timestamp: new Date().toISOString(),
        }]
      }).catch(() => {});
    }

    await updateStatusMessage(client);
  } catch (err) {
    console.error(`Erreur activation ${member.user.tag} :`, err.message);
  }
}

client.login(process.env.DISCORD_TOKEN);
