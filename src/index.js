require('dotenv').config();
const ids = require('./ids');

process.on('unhandledRejection', err => {
  console.error('⚠️ Erreur non gérée :', err.message || err);
});
process.on('uncaughtException', err => {
  console.error('⚠️ Exception non capturée :', err.message || err);
});

const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
require('./silencieux').installer();
const { verifyMember, handleVerifyButton, handleVerifRefButton } = require('./verification');
const { annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave } = require('./welcome');
const { createTicket, takeTicket, closeTicket }        = require('./tickets');
const { checkSpam, checkLinks }                        = require('./antiraid');
const { checkNewMember }                               = require('./antidoublecompte');
const db                                               = require('./database');
const { log }                                          = require('./logger');
const { createDashboard, setClient }                   = require('./dashboard');
const scheduledMessages                                = require('./scheduled-messages');
const { startBirthdayTasks }                           = require('./birthday');
const hub                                              = require('./hub');
const { startFs25Bridge }                              = require('./fs25-bridge');
const contrat                                          = require('./commands/contrat');
const { startDailyTasks }                              = require('./dailytasks');
const tempvoice                                        = require('./tempvoice');
const levels                                           = require('./levels');
const boutique                                         = require('./boutique');
const { postRolesHeader }                              = require('./roles');
const cron                                             = require('node-cron');
const multifruit                                       = require('./multifruit');

const VERIFICATION_ROLE_ID = process.env.VERIFICATION_ROLE_ID;
const ATTENTE_ROLE_ID      = process.env.ATTENTE_ROLE_ID;
const REGLEMENT_ROLE_ID    = process.env.REGLEMENT_ROLE_ID;
const ACTIVE_ROLE_ID       = process.env.ACTIVE_ROLE_ID;
const GENERAL_CHANNEL_ID   = ids('CHAT_CHANNEL_ID');

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

// Le bot peut être invité sur plusieurs serveurs : on n'écoute que celui de GUILD_ID (base de données propre à chaque serveur).
const _on = client.on.bind(client);
client.on = (ev, fn) => _on(ev, (...a) => {
  const g = a[0]?.guild?.id ?? a[0]?.guildId ?? a[1]?.guild?.id;
  if (g && process.env.GUILD_ID && g !== process.env.GUILD_ID) return;
  return fn(...a);
});

// ── Ready ─────────────────────────────────────────────────────────────────────
// Réponses visibles par le joueur seul (clics, formulaires) : texte simple, sans cadre ni icône
require('./simple').installer();

client.once(Events.ClientReady, async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);
  console.log('📡 Serveurs : ' + client.guilds.cache.size);
  setClient(client);
  require('./embed-format').setClient(client);
  const members = await db.getAllMembers();
  console.log('💾 DB : ' + members.length + ' membres');

  scheduledMessages.startAll(client);
  startBirthdayTasks(client, cron);
  startFs25Bridge(client).catch(e => console.error('[FS25] Pont :', e.message));
  startDailyTasks(client, cron);
  require('./restart').startDailyRestart(client, cron);
  tempvoice.startTempVoice(client);
  require('./temptext').startTempText(client);
  require('./suggestions').startSuggestions(client);
  require('./bugs').startBugs(client);
  require('./invitations').startInvitations(client);
  require('./jeux').startJeux(client);
  require('./tickets').startTickets(client).catch(err => console.error('⚠️ Tickets :', err.message));
  require('./antispam').startAntiSpam(client);
  if (process.env.VERIF_MODE === 'code') require('./codeverif').publierPanneau(client).catch(() => {});
  require('./publiclog').demarrer(client).catch(() => {});
  levels.startLevels(client);
  boutique.startBoutique(client);
  // une seule version de chaque panneau : une fois les panneaux republiés, on supprime les anciens
  setTimeout(() => require('./nettoyage').nettoyerTout(client).catch(() => {}), 60_000);

  // En-tête explicatif du salon des rôles
  try {
    await postRolesHeader(client);
  } catch (err) {
    console.error('⚠️ Erreur en-tête des rôles :', err.message);
  }

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
    const guild = (client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first());
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

  // Le salon de statut est (re)publié par runDaily(), lancé au démarrage par
  // startDailyTasks() puis chaque jour à 04h00.
});

// ── Nouveau membre ────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  console.log('👋 Nouveau membre : ' + member.user.tag);

  await db.upsertMember(member.user, { joinedAt: member.joinedAt?.toISOString() });
  const inviterId = await levels.onMemberAdd(member);
  await annoncerArrivee(member, inviterId);
  if (process.env.VERIF_MODE === 'code-compte') {
    // aucun rôle : le membre ne voit que le salon de vérification ; compte vérifié d'abord, code ensuite
    await checkNewMember(member);
    await log(client, 'member_join', { userId: member.id });
    await verifyMember(member);
    return;
  }
  if (process.env.VERIF_MODE === 'code') {
    if (VERIFICATION_ROLE_ID) await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});
    await checkNewMember(member);
    await log(client, 'member_join', { userId: member.id });
    // vérification complète de chaque arrivant (âge, pseudo, base de données : connu, expulsé, banni…) dans les logs publics
    await log(client, 'verification_ok', { userId: member.id });
    await require('./codeverif').issue(member);
    return;
  }
  if (VERIFICATION_ROLE_ID) await member.roles.add(VERIFICATION_ROLE_ID).catch(() => {});
  await sendJoinDM(member);
  await checkNewMember(member);
  await log(client, 'member_join', { userId: member.id });
  await verifyMember(member);
});

// ── Départ membre ─────────────────────────────────────────────────────────────
client.on(Events.GuildMemberRemove, async member => {
  if (member.user.bot) return;
  await db.memberLeft(member.user);
  await require('./codeverif').cleanup(member).catch(() => {}); // salon de code privé éventuel
  // expulsion ? (les départs volontaires ne sont jamais publiés)
  const kick = await require('./publiclog').auditRecent(member.guild, 'kick', member.id);
  if (kick) await log(client, 'member_kicked', { userId: member.id, modId: kick.executor?.id, reason: kick.reason, publicOnly: true });
  await sendLeave(member);
  await log(client, 'member_left', { userId: member.id });
  console.log('🚪 Départ : ' + member.user.tag);
});

// ── Ban ───────────────────────────────────────────────────────────────────────
client.on(Events.GuildBanAdd, async ban => {
  await db.banMember(ban.user, ban.reason || 'Aucune raison', 'Discord');
  // qui / pourquoi : lu dans le journal d'audit Discord (couvre /banid, le bouton Discord et l'anti-spam)
  const audit = await require('./publiclog').auditRecent(ban.guild, 'ban', ban.user.id);
  const reason = audit?.reason || ban.reason;
  await log(client, 'member_banned', { userId: ban.user.id, modId: audit?.executor?.id || client.user.id, reason, publicOnly: true, noStatus: /^anti-spam/i.test(reason || '') });
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
  if (await require('./antispam').onMessage(message)) return; // salon-piège anti-spam
  const member = message.member;
  if (!member) return;
  if (['code', 'code-compte'].includes(process.env.VERIF_MODE) && await require('./codeverif').onMessage(message)) return;

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
  if (await multifruit.handle(interaction)) return; // jeu Multifruit (customId « mf: »)

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
      'boutique-admin': './commands/boutique-admin',
      'expulsion':    './commands/expulsion',
      'banid':        './commands/banid',
      'sanction':     './commands/sanction',
      'bouton':       './commands/bouton',
      'analyse':      './commands/analyse',
      'invite':       './commands/invite',
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
    try {
      if (interaction.commandName === 'Purge : début') await require('./commands/purge').executeStart(interaction);
      if (interaction.commandName === 'Purge : fin')   await require('./commands/purge').executeEnd(interaction);
    } catch (err) { console.error('Erreur purge :', err.stack || err.message); }
    return;
  }

  // Select menu utilisateur (@) → ajout ouvrier / co-exploitant
  if (interaction.isUserSelectMenu()) {
    try {
      if (interaction.customId.startsWith('hub_expl_ouvadd_')) { await hub.handleHubExplOuvAdd(interaction); return; }
      if (interaction.customId.startsWith('hub_expl_coadd_'))  { await hub.handleHubExplCoAdd(interaction);  return; }
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
      if (cid.startsWith('hub_expl_codel_'))   { await hub.handleHubExplCoDel(interaction);   return; }
      if (cid.startsWith('hub_expl_couleur_')) { await hub.handleHubExplCouleur(interaction); return; }
      if (cid.startsWith('hub_expl_recrute_')) { await hub.handleHubExplRecrute(interaction); return; }
      if (cid === 'marche_retirer')            { await require('./marche').handleRetirer(interaction); return; }
      if (cid === 'xpadmin_bareme_select')     { await require('./commands/xp-admin').handleBaremeSelect(interaction); return; }
    } catch (err) { console.error('Erreur select menu :', err.stack || err.message); }
    return;
  }

  // Modal
  if (interaction.isModalSubmit()) {
    const cid = interaction.customId;
    try {
      if (cid === 'verif_modal')                { await require('./codeverif').handleModal(interaction); return; }
      if (cid === 'anniv_modal')                { await require('./birthday').handleModal(interaction); return; }
      if (cid === 'hub_expl_creer_modal')       { await hub.handleHubExplCreerModal(interaction); return; }
      if (cid.startsWith('hub_expl_nom_'))      { await hub.handleHubExplNom(interaction);        return; }
      if (cid.startsWith('contrat_modal_'))     { await contrat.handleContratModal(interaction);  return; }
      if (cid.startsWith('besoin_modal_'))      { await contrat.handleBesoinModal(interaction);   return; }
      if (cid.startsWith('voice_rename_modal_') || cid.startsWith('voice_limit_modal_')) { await tempvoice.handleVoiceModal(interaction); return; }
      if (cid === 'text_create_modal' || cid.startsWith('text_rename_modal_')) { await require('./temptext').handleTextModal(interaction); return; }
      if (cid === 'sugg_modal' || cid === 'modprop_modal') { await require('./suggestions')[cid.split('_')[0] === 'sugg' ? 'jeu' : 'mods'].handleSuggModal(interaction); return; }
      if (/^(sugg|modprop)_(ok|no)modal_\d+$/.test(cid)) { await require('./suggestions')[cid.startsWith('sugg') ? 'jeu' : 'mods'].handleSuggDecisionModal(interaction); return; }
      if (/^bug_modal(_en)?$/.test(cid))        { await require('./bugs').handleBugModal(interaction); return; }
      if (/^bug_nomodal_\d+$/.test(cid))        { await require('./bugs').handleBugRefus(interaction); return; }
      if (cid === 'jeux_modal')                 { await require('./jeux').handleModal(interaction); return; }
      if (cid === 'jeux_wishmodal')             { await require('./jeux').handleWishModal(interaction); return; }
      if (cid === 'marche_modal')              { await require('./marche').handleModal(interaction); return; }
      if (cid === 'hub_boutique_modal')        { await boutique.handleModal(interaction);         return; }
      if (cid.startsWith('xpadmin_bareme_modal_')) { await require('./commands/xp-admin').handleBaremeModal(interaction); return; }
    } catch (err) { console.error('Erreur modal :', err.stack || err.message); }
    return;
  }

  if (!interaction.isButton()) return;
  const id = interaction.customId;

  // Boutons HUB des exploitants
  try {
    if (id === 'verif_code' || id === 'verif_saisir') { await require('./codeverif').handleButton(interaction); return; }
    if (id === 'anniv_btn')                   { await require('./birthday').handleButton(interaction); return; }
    if (id === 'hub_expl')                    { await hub.handleHubExpl(interaction);        return; }
    if (id === 'hub_expl_creer')              { await hub.handleHubExplCreer(interaction);   return; }
    if (id === 'hub_contrat')                 { await contrat.startContratFlow(interaction); return; }
    if (id.startsWith('contrat_mode_'))       { await contrat.handleContratMode(interaction); return; }
    if (id === 'hub_besoin')                  { await contrat.handleBesoinButton(interaction); return; }
    if (id === 'hub_annuaire')                { await hub.handleHubAnnuaire(interaction);    return; }
    if (id === 'hub_annuaire_off')            { await hub.handleHubAnnuaireOff(interaction); return; }
    if (id.startsWith('hub_annuaire_delyes_')) { await hub.handleHubAnnuaireDelYes(interaction); return; }
    if (id.startsWith('hub_annuaire_delno_'))  { await hub.handleHubAnnuaireDelNo(interaction);  return; }
    if (id.startsWith('hub_annuaire_del_'))    { await hub.handleHubAnnuaireDel(interaction);    return; }
    if (id === 'hub_marche')                  { await require('./marche').handleMarche(interaction); return; }
    if (id === 'marche_ajouter')              { await require('./marche').handleAjouter(interaction); return; }
    if (id === 'hub_boutique')                { await boutique.handleBoutique(interaction);  return; }
    if (id === 'hub_boutique_monnaie')        { await boutique.handleMonnaie(interaction);   return; }
    if (id === 'hub_boutique_echange')        { await boutique.handleEchange(interaction);   return; }
    if (id.startsWith('shop_ok_') || id.startsWith('shop_no_')) { await boutique.handleDecision(interaction); return; }
    if (id.startsWith('contrat_accepter_'))     { await contrat.handleContratAccepter(interaction);    return; }
    if (id.startsWith('contrat_deal_ok_'))      { await contrat.handleContratDealOk(interaction);      return; }
    if (id.startsWith('contrat_deal_refuse_'))  { await contrat.handleContratDealRefuse(interaction);  return; }
    if (id.startsWith('contrat_deal_done_'))    { await contrat.handleContratDealDone(interaction);    return; }
    if (id.startsWith('contrat_supprimer_'))    { await contrat.handleContratSupprimer(interaction);   return; }
  } catch (err) { console.error('Erreur bouton farming :', err.message); }

  // HUB d'information (boutons Règlement / Exploitant / Activité / Paramètre)
  if (id.startsWith('hubinfo_')) {
    try { await require('./hub-info').handleButton(interaction); }
    catch (err) { console.error('Erreur bouton HUB info :', err.stack || err.message); }
    return;
  }

  // Purge de messages (confirmation)
  if (id.startsWith('purge_ok_') || id.startsWith('purge_no_')) {
    try { await require('./commands/purge').handleButton(interaction); }
    catch (err) { console.error('Erreur bouton purge :', err.stack || err.message); }
    return;
  }

  // Boutons salons vocaux temporaires
  try {
    if (id === 'voice_create')                { await tempvoice.handleVoiceCreate(interaction);  return; }
    if (/^voice_(rename|limit|lock|delete)_/.test(id)) { await tempvoice.handleVoiceControl(interaction); return; }
    if (id === 'text_create')                 { await require('./temptext').handleTextCreate(interaction); return; }
    if (/^text_(rename|lock|delete)_/.test(id)) { await require('./temptext').handleTextControl(interaction); return; }
  } catch (err) { console.error('Erreur bouton vocal :', err.message); }

  // Boîte à idées
  try {
    if (id === 'sugg_new' || id === 'modprop_new') { await require('./suggestions')[id.startsWith('sugg') ? 'jeu' : 'mods'].handleSuggNew(interaction); return; }
    if (/^(sugg|modprop)_(ok|no)_\d+$/.test(id)) { await require('./suggestions')[id.startsWith('sugg') ? 'jeu' : 'mods'].handleSuggDecision(interaction); return; }
  } catch (err) { console.error('Erreur bouton suggestions :', err.stack || err.message); }

  // Lien d'invitation (7 jours)
  try {
    if (id === 'lien_invite') { await require('./invitations').handleInviteButton(interaction); return; }
    if (id === 'jeux_new')    { await require('./jeux').handleButton(interaction); return; }
    if (id === 'jeux_wish')   { await require('./jeux').handleWishButton(interaction); return; }
    if (id === 'wish_y' || id === 'wish_n') { await require('./jeux').handleWishVote(interaction); return; }
    if (id === 'hub_roles')   { await require('./invitations').handleRolesButton(interaction); return; }
    if (id.startsWith('hubrole_')) { await require('./invitations').handleRoleToggle(interaction); return; }
  } catch (err) { console.error('Erreur bouton invitation :', err.stack || err.message); }

  // Signalement de bugs
  try {
    if (/^bug_new(_en)?$/.test(id))           { await require('./bugs').handleBugNew(interaction); return; }
    if (/^bug_(ok|fix|no)_\d+$/.test(id))     { await require('./bugs').handleBugDecision(interaction); return; }
  } catch (err) { console.error('Erreur bouton bugs :', err.stack || err.message); }

  // Vérification admin
  if (id.startsWith('verifref_')) {
    await handleVerifRefButton(interaction);
    return;
  }
  if (id.startsWith('verify_')) {
    await handleVerifyButton(interaction);
    return;
  }

  // Règlement accepté
  if (id === 'accept_reglement') {
    const member = interaction.member;
    await interaction.reply({
      embeds: [{
        description: '✅ **Règlement accepté !**\nRends-toi dans le salon général pour la suite.',
        color: 0x2ECC71,
        footer: { text: 'MonCopainBot' },
      }],
      flags: 64,
    }).catch(err => console.error('⚠️ accept_reglement reply :', err.message));

    if (ATTENTE_ROLE_ID)      await member.roles.remove(ATTENTE_ROLE_ID).catch(() => {});
    if (VERIFICATION_ROLE_ID) await member.roles.remove(VERIFICATION_ROLE_ID).catch(() => {});
    if (REGLEMENT_ROLE_ID)    await member.roles.add(REGLEMENT_ROLE_ID).catch(() => {});
    // code-compte : le règlement accepté ouvre tout de suite tous les salons (compte activé)
    if (process.env.VERIF_MODE === 'code-compte' && ACTIVE_ROLE_ID) await member.roles.add(ACTIVE_ROLE_ID).catch(() => {});

    try { await db.reglementAccepted(member.id); }
    catch (err) { console.error('⚠️ db.reglementAccepted :', err.message); }

    await log(client, 'reglement_accepted', { userId: member.id }).catch(err => console.error('⚠️ log reglement_accepted :', err.message));

    // Toujours tenté, même si une étape précédente a échoué.
    await sendWelcomeAfterReglement(member).catch(err => console.error('⚠️ sendWelcomeAfterReglement :', err.message));
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
      log(client, 'role_removed', { userId: member.id, roleName: role.name, publicOnly: true });
      await interaction.reply({ content: '🔴 Rôle **' + role.name + '** retiré.', flags: 64 });
    } else {
      await member.roles.add(role);
      log(client, 'role_added', { userId: member.id, roleName: role.name, publicOnly: true });
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
