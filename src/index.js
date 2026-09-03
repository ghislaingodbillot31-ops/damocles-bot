require('dotenv').config();

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
const hub                                              = require('./hub');
const { startFS25Monitor }                             = require('./fs25-monitor');
const contrat                                          = require('./commands/contrat');
const { startDailyTasks }                              = require('./dailytasks');
const { updateStatusMessage }                          = require('./statusbot');
const tempvoice                                        = require('./tempvoice');
const levels                                           = require('./levels');
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);
  console.log('📡 Serveurs : ' + client.guilds.cache.size);
  setClient(client);
  await db.initMongo();

  const members = await db.getAllMembers();
  console.log('💾 DB : ' + members.length + ' membres');

  scheduledMessages.startAll(client);
  startKeepAlive();
  startBirthdayTasks(client, cron);
  startFS25Monitor(client);
  startDailyTasks(client, cron);
  tempvoice.startTempVoice(client);
  levels.startLevels(client);

  // Publier le HUB des exploitants
  try {
    const hubChannel = client.channels.cache.get(hub.HUB_CHANNEL);
    if (hubChannel) await hub.postHub(hubChannel);
    console.log('🌾 HUB des exploitants publié');
  } catch (err) {
    console.error('⚠️ Erreur publication HUB :', err.message);
  }

  // Ré-attribuer le rôle Exploitant aux exploitants existants
  try {
    const guild = client.guilds.cache.first();
    const exploitations = require('./exploitation').getAll();
    for (const exploit of exploitations) {
      const member = await guild.members.fetch(exploit.ownerId).catch(() => null);
      if (member && !member.roles.cache.has(hub.EXPLOITANT_ROLE_ID)) {
        await member.roles.add(hub.EXPLOITANT_ROLE_ID).catch(() => {});
        console.log('✅ Rôle Exploitant attribué : ' + member.user.tag);
      }
    }
    if (exploitations.length) console.log('🌾 ' + exploitations.length + ' exploitation(s)');
  } catch (err) {
    console.error('⚠️ Erreur rôles exploitants :', err.message);
  }

  // Message « Démarrage du système » dans le salon de statut
  try {
    await updateStatusMessage(client, true);
  } catch (err) {
    console.error('⚠️ Erreur message de statut :', err.message);
  }
});

// ── Nouveau membre ────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  console.log('👋 Nouveau membre : ' + member.user.tag);

  await db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });
  await levels.onMemberAdd(member);
  if (VERIFICATION_ROLE_ID) await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});
  await checkNewMember(member);
  await log(client, 'member_join', { userId: member.id });
  await verifyMember(member);
});

// ── Départ membre ─────────────────────────────────────────────────────────────
client.on(Events.GuildMemberRemove, async member => {
  if (member.user.bot) return;
  await db.memberLeft(member.user);
  await sendLeave(member);
  await log(client, 'member_left', { userId: member.id });
  console.log('🚪 Départ : ' + member.user.tag);
});

// ── Ban ───────────────────────────────────────────────────────────────────────
client.on(Events.GuildBanAdd, async ban => {
  await db.banMember(ban.user, ban.reason || 'Aucune raison', 'Discord');
});

// ── Vocal : salons temporaires vides + XP vocal ─────────────────────────────
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  tempvoice.handleVoiceState(oldState).catch(() => {});
  try { levels.onVoice(oldState, newState); } catch {}
});

// ── Invitations (tracking XP) ───────────────────────────────────────────────
client.on(Events.InviteCreate, inv => { try { levels.cacheInvites(inv.guild); } catch {} });
client.on(Events.InviteDelete, inv => { try { levels.cacheInvites(inv.guild); } catch {} });

// ── Messages ──────────────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  const member = message.member;
  if (!member) return;

  try { levels.onMessage(message); } catch {}
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
    await db.upsertMember(member.user, { firstMessageAt: new Date().toISOString(), status: 'active' });
    await log(client, 'member_activated', { userId: member.id, source: 'premier message général' });
    console.log('✅ Premier message #général — Membre validé : ' + member.user.tag);
  }
});

// ── Interactions ──────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {
    const cmdMap = {
      'anniversaire': './commands/anniversaire',
      'verifier':     './commands/verifier',
      'sync-db':      './commands/sync-db',
      'contrat':      './commands/contrat',
      'maintenance':  './commands/maintenance',
      'niveau':       './commands/niveau',
      'classement':   './commands/classement',
      'xp-admin':     './commands/xp-admin',
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

  // Select menu utilisateur (@) → ajout ouvrier
  if (interaction.isUserSelectMenu()) {
    try {
      if (interaction.customId.startsWith('hub_expl_ouvadd_')) { await hub.handleHubExplOuvAdd(interaction); return; }
    } catch (err) { console.error('Erreur user select :', err.message); }
    return;
  }

  // Select menu (texte)
  if (interaction.isStringSelectMenu()) {
    const cid = interaction.customId;
    try {
      if (cid.startsWith('hub_expl_manage_'))  { await hub.handleHubExplManage(interaction);  return; }
      if (cid.startsWith('hub_expl_setact_'))  { await hub.handleHubExplSetAct(interaction);  return; }
      if (cid.startsWith('hub_expl_ouvdel_'))  { await hub.handleHubExplOuvDel(interaction);  return; }
      if (cid.startsWith('hub_expl_recrute_')) { await hub.handleHubExplRecrute(interaction); return; }
      if (cid.startsWith('hub_expl_proddel_')) { await hub.handleHubExplProdDel(interaction); return; }
    } catch (err) { console.error('Erreur select menu :', err.message); }
    return;
  }

  // Modal
  if (interaction.isModalSubmit()) {
    const cid = interaction.customId;
    try {
      if (cid === 'hub_expl_creer_modal')       { await hub.handleHubExplCreerModal(interaction); return; }
      if (cid.startsWith('hub_expl_nom_'))      { await hub.handleHubExplNom(interaction);        return; }
      if (cid.startsWith('hub_expl_prodmodal_')) { await hub.handleHubExplProdModal(interaction); return; }
      if (cid.startsWith('contrat_modal_'))     { await contrat.handleContratModal(interaction);  return; }
      if (cid.startsWith('besoin_modal_'))      { await contrat.handleBesoinModal(interaction);   return; }
      if (cid.startsWith('voice_rename_modal_') || cid.startsWith('voice_limit_modal_')) { await tempvoice.handleVoiceModal(interaction); return; }
    } catch (err) { console.error('Erreur modal :', err.message); }
    return;
  }

  if (!interaction.isButton()) return;
  const id = interaction.customId;

  // Boutons HUB des exploitants
  try {
    if (id === 'hub_expl')                    { await hub.handleHubExpl(interaction);        return; }
    if (id === 'hub_expl_creer')              { await hub.handleHubExplCreer(interaction);   return; }
    if (id === 'hub_contrat')                 { await contrat.startContratFlow(interaction); return; }
    if (id === 'hub_besoin')                  { await contrat.handleBesoinButton(interaction); return; }
    if (id === 'hub_annuaire')                { await hub.handleHubAnnuaire(interaction);    return; }
    if (id === 'hub_annuaire_off')            { await hub.handleHubAnnuaireOff(interaction); return; }
    if (id.startsWith('hub_expl_prodadd_'))   { await hub.handleHubExplProdAdd(interaction); return; }
    if (id.startsWith('hub_expl_done_'))      { await hub.handleHubExplDone(interaction);    return; }
    if (id.startsWith('contrat_accepter_'))     { await contrat.handleContratAccepter(interaction);    return; }
    if (id.startsWith('contrat_deal_ok_'))      { await contrat.handleContratDealOk(interaction);      return; }
    if (id.startsWith('contrat_deal_refuse_'))  { await contrat.handleContratDealRefuse(interaction);  return; }
    if (id.startsWith('contrat_deal_done_'))    { await contrat.handleContratDealDone(interaction);    return; }
    if (id.startsWith('contrat_supprimer_'))    { await contrat.handleContratSupprimer(interaction);   return; }
  } catch (err) { console.error('Erreur bouton farming :', err.message); }

  // Boutons salons vocaux temporaires
  try {
    if (id === 'voice_create')                { await tempvoice.handleVoiceCreate(interaction);  return; }
    if (/^voice_(rename|limit|lock|delete)_/.test(id)) { await tempvoice.handleVoiceControl(interaction); return; }
  } catch (err) { console.error('Erreur bouton vocal :', err.message); }

  // Vérification admin
  if (id.startsWith('verify_')) {
    await handleVerifyButton(interaction);
    return;
  }

  // Règlement accepté
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
    await db.reglementAccepted(member.id);
    await log(client, 'reglement_accepted', { userId: member.id });
    await sendWelcomeAfterReglement(member);
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

// ── Démarrage ─────────────────────────────────────────────────────────────────
createDashboard();

client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('🟢 Login Discord réussi');
}).catch(err => {
  console.error('❌ Erreur login Discord :', err.message);
});
