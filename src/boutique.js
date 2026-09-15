// Boutique EUROAGRI : échange de points de classement (XP) contre de la monnaie
// en jeu (Farming Simulator). Le bot ne peut pas créditer l'argent en jeu → il
// crée une demande dans un salon staff. À la validation, les points sont retirés
// du compte du joueur ; au refus, rien ne change.
const fs   = require('fs');
const path = require('path');
const {
  ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const exp = require('./exploitation');
const levels = require('./levels');
const { agrilog } = require('./agrilog');
const { panneau, SEP } = require('./embed-format');

// ── Config ────────────────────────────────────────────────────────────────────
const HUB_CHANNEL  = '1544303765602173020'; // salon #hub → on en déduit la catégorie
const CHANNEL_NAME = 'boutique';            // salon staff des demandes d'échange
const TAUX         = 5;                     // 1 point = 5 € en jeu
const MIN          = 10;                    // points mini par échange
const COOLDOWN_MS  = 24 * 60 * 60 * 1000;   // délai entre deux demandes

const { dataPath } = require('./paths');
const STORE_PATH   = dataPath('boutique.json');

// ── Persistance ───────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return {
      staffChannelId: raw.staffChannelId || null,
      requests:       raw.requests || {},
      lastRequestAt:  raw.lastRequestAt || {},
    };
  } catch {
    return { staffChannelId: null, requests: {}, lastRequestAt: {} };
  }
}

function save(state) {
  try {
    if (!fs.existsSync(path.dirname(STORE_PATH))) fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ boutique.json — sauvegarde impossible :', err.message);
  }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function getRequest(reqId) {
  const r = load().requests[reqId];
  return r ? { reqId, ...r } : null;
}

function getPending(userId) {
  const s = load();
  for (const [reqId, r] of Object.entries(s.requests)) {
    if (r.userId === userId && r.status === 'pending') return { reqId, ...r };
  }
  return null;
}

function cooldownRestant(userId) {
  const last = load().lastRequestAt[userId];
  if (!last) return 0;
  return Math.max(0, COOLDOWN_MS - (Date.now() - Date.parse(last)));
}

function createRequest({ reqId, userId, exploitId, exploitNom, points, staffMsgId }) {
  const s = load();
  s.requests[reqId] = {
    userId, exploitId, exploitNom,
    points, euros: points * TAUX,
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null, decidedBy: null,
    staffMsgId: staffMsgId || null,
  };
  s.lastRequestAt[userId] = new Date().toISOString();
  save(s);
  return { reqId, ...s.requests[reqId] };
}

function resolveRequest(reqId, { status, decidedBy }) {
  const s = load();
  if (!s.requests[reqId]) return;
  s.requests[reqId].status    = status;
  s.requests[reqId].decidedAt = new Date().toISOString();
  s.requests[reqId].decidedBy = decidedBy;
  save(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function autoClean(interaction, delay = 8000) {
  setTimeout(() => interaction.deleteReply().catch(() => {}), delay);
}

function formatDuree(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return h + ' h' + (m ? ' ' + m + ' min' : '');
  return m + ' min';
}

function adminRoles(guild) {
  return guild.roles.cache.filter(r =>
    r.id !== guild.id && !r.managed && r.permissions.has(PermissionFlagsBits.Administrator));
}

function estAdmin(interaction) {
  return !!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

// ── Salon staff : récupération / création ─────────────────────────────────────
async function ensureStaffChannel(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return null;

  const state = load();

  if (state.staffChannelId) {
    const ch = guild.channels.cache.get(state.staffChannelId)
      || await guild.channels.fetch(state.staffChannelId).catch(() => null);
    if (ch) return ch;
  }

  const hubCh = guild.channels.cache.get(HUB_CHANNEL)
    || await guild.channels.fetch(HUB_CHANNEL).catch(() => null);
  const parentId = hubCh?.parentId || null;

  let ch = guild.channels.cache.find(c =>
    c.type === ChannelType.GuildText && c.name === CHANNEL_NAME
    && (!parentId || c.parentId === parentId));

  if (!ch) {
    const perms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
    const overwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
    for (const [, r] of adminRoles(guild)) overwrites.push({ id: r.id, allow: perms });
    overwrites.push({ id: client.user.id, allow: perms });

    ch = await guild.channels.create({
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: overwrites,
      reason: 'Boutique EUROAGRI : demandes d\'échange de points',
    }).catch(err => { console.error('⚠️ Boutique — création salon :', err.message); return null; });
  }

  if (ch && ch.id !== state.staffChannelId) {
    state.staffChannelId = ch.id;
    save(state);
  }
  return ch;
}

// ── Embeds ────────────────────────────────────────────────────────────────────
function demandeEmbed(r, solde) {
  return {
    title: '💱 DEMANDE D\'ÉCHANGE',
    description: [
      'Joueur : <@' + r.userId + '> (`' + r.userId + '`)',
      'Exploitation : ' + r.exploitNom,
      'Points demandés : **' + r.points + '**',
      'Équivalent : **' + r.euros + ' € en jeu**',
      'Solde actuel : ' + (solde != null ? solde.toLocaleString('fr-FR') + ' points' : 'Non précisé'),
      'Demande : #' + r.reqId,
      SEP,
      'Si validé : crédite **' + r.euros + ' €** à <@' + r.userId + '> dans Farming Simulator.',
      'Les ' + r.points + ' points seront retirés automatiquement de son compte.',
    ].join('\n'),
    color: 0x5865F2,
    timestamp: new Date().toISOString(),
  };
}

function resultatEmbed(r, titre, color, extra) {
  return {
    title: titre,
    description: [
      'Joueur : <@' + r.userId + '> (`' + r.userId + '`)',
      'Exploitation : ' + r.exploitNom,
      'Points : **' + r.points + '** · Équivalent : **' + r.euros + ' €**',
      SEP,
      extra,
    ].join('\n'),
    color,
    timestamp: new Date().toISOString(),
  };
}

function decisionRow(reqId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_ok_' + reqId).setLabel('✅ Valider').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('shop_no_' + reqId).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
  );
}

// ── Bouton « 🛒 Boutique » ────────────────────────────────────────────────────
async function handleBoutique(interaction) {
  await interaction.reply({
    ...panneau({ embeds: [{
      title: '🛒 BOUTIQUE EUROAGRI',
      description: 'Échange tes points de classement contre des avantages.\nRéservé aux membres d\'une exploitation.',
      color: 0x1ABC9C,
    }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_boutique_monnaie').setLabel('💰 Monnaie').setStyle(ButtonStyle.Success),
    )],
    flags: 64,
  });
  autoClean(interaction, 120000);
}

// ── Bouton « 💰 Monnaie » ─────────────────────────────────────────────────────
async function handleMonnaie(interaction) {
  const uid = interaction.user.id;
  const exploit = exp.getByMember(uid);
  if (!exploit) {
    await interaction.reply({
      ...panneau({ embeds: [{
        title: '💰 Monnaie FS25',
        description: 'Réservé aux membres d\'une exploitation (exploitant, co-exploitant ou ouvrier). Crée ou rejoins une exploitation depuis le HUB.',
        color: 0xE74C3C,
      }] }),
      flags: 64,
    });
    autoClean(interaction, 15000);
    return;
  }

  await levels.flush().catch(() => {});
  const solde   = levels.getPoints(uid);
  const pending = getPending(uid);
  const cd      = cooldownRestant(uid);

  const lignes = [
    'Taux : 1 point = ' + TAUX + ' € en jeu',
    'Ton solde : **' + solde.toLocaleString('fr-FR') + '** points',
    'Échange : à partir de ' + MIN + ' points par demande',
    'Délai : 1 demande à la fois · ' + (COOLDOWN_MS / 3600000) + ' h entre deux demandes',
    '',
    'Le staff valide la demande, puis crédite l\'argent manuellement dans Farming Simulator.',
  ];

  let disabled = false;
  if (pending) {
    lignes.push('', '⏳ Demande #' + pending.reqId + ' en attente de validation.');
    disabled = true;
  } else if (cd > 0) {
    lignes.push('', '⏳ Prochaine demande possible dans ' + formatDuree(cd) + '.');
    disabled = true;
  } else if (solde < MIN) {
    lignes.push('', 'Il te faut au moins ' + MIN + ' points pour un échange.');
    disabled = true;
  }

  await interaction.reply({
    ...panneau({ embeds: [{ title: '💰 MONNAIE FS25', description: lignes.join('\n'), color: 0xF1C40F }] }),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub_boutique_echange').setLabel('💱 Demander un échange').setStyle(ButtonStyle.Success).setDisabled(disabled),
    )],
    flags: 64,
  });
  autoClean(interaction, 120000);
}

// ── Bouton « 💱 Demander un échange » → modale ────────────────────────────────
async function handleEchange(interaction) {
  const uid = interaction.user.id;
  if (!exp.getByMember(uid)) {
    await interaction.reply({ content: '❌ Réservé aux membres d\'une exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }
  if (getPending(uid)) {
    await interaction.reply({ content: '❌ Tu as déjà une demande en attente de validation.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const cd = cooldownRestant(uid);
  if (cd > 0) {
    await interaction.reply({ content: '❌ Prochaine demande possible dans ' + formatDuree(cd) + '.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const modal = new ModalBuilder().setCustomId('hub_boutique_modal').setTitle('Échange points vers argent FS25');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('points').setLabel('Points à échanger (minimum ' + MIN + ')')
      .setStyle(TextInputStyle.Short).setPlaceholder('Ex : 50').setRequired(true).setMaxLength(9),
  ));
  await interaction.showModal(modal);
}

// ── Soumission de la modale → création de la demande ─────────────────────────
async function handleModal(interaction) {
  const uid = interaction.user.id;
  const exploit = exp.getByMember(uid);
  if (!exploit) {
    await interaction.reply({ content: '❌ Réservé aux membres d\'une exploitation.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const raw = interaction.fields.getTextInputValue('points').trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(raw)) {
    await interaction.reply({ content: '❌ Entre un nombre entier de points.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const n = parseInt(raw, 10);
  if (n < MIN) { await interaction.reply({ content: '❌ Minimum ' + MIN + ' points par échange.', flags: 64 }); autoClean(interaction); return; }

  await levels.flush().catch(() => {});
  const solde = levels.getPoints(uid);
  if (n > solde) {
    await interaction.reply({ content: '❌ Solde insuffisant : tu as ' + solde.toLocaleString('fr-FR') + ' point(s).', flags: 64 });
    autoClean(interaction);
    return;
  }

  if (getPending(uid)) {
    await interaction.reply({ content: '❌ Tu as déjà une demande en attente de validation.', flags: 64 });
    autoClean(interaction);
    return;
  }
  const cd = cooldownRestant(uid);
  if (cd > 0) {
    await interaction.reply({ content: '❌ Prochaine demande possible dans ' + formatDuree(cd) + '.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const staffCh = await ensureStaffChannel(interaction.client);
  if (!staffCh) {
    await interaction.reply({ content: '⚠️ Salon de validation indisponible. Préviens un administrateur.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const reqId = genId();
  const roles = adminRoles(interaction.guild);
  const msg = await staffCh.send({
    content: roles.map(r => '<@&' + r.id + '>').join(' ') || undefined,
    ...panneau({ embeds: [demandeEmbed({ reqId, userId: uid, exploitNom: exploit.nom, points: n, euros: n * TAUX }, solde)] }),
    components: [decisionRow(reqId)],
    allowedMentions: { roles: roles.map(r => r.id) },
  }).catch(err => { console.error('⚠️ Boutique — envoi demande :', err.message); return null; });

  if (!msg) {
    await interaction.reply({ content: '⚠️ Impossible d\'envoyer la demande au staff. Réessaie plus tard.', flags: 64 });
    autoClean(interaction);
    return;
  }

  createRequest({ reqId, userId: uid, exploitId: exploit.id, exploitNom: exploit.nom, points: n, staffMsgId: msg.id });

  await agrilog(interaction.guild, '💱 <@' + uid + '> demande l\'échange de ' + n + ' points (' + (n * TAUX) + ' €)');

  await interaction.reply({
    ...panneau({ embeds: [{
      title: '💱 Demande envoyée',
      description: 'Ta demande d\'échange de **' + n + ' points** (' + (n * TAUX) + ' € en jeu) a été transmise au staff.\nTu recevras un message privé une fois la décision prise.',
      color: 0x2ECC71,
    }] }),
    flags: 64,
  });
  autoClean(interaction, 30000);
}

// ── Boutons staff « ✅ Valider » / « ❌ Refuser » ─────────────────────────────
async function handleDecision(interaction) {
  if (!estAdmin(interaction)) {
    await interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const approuve = interaction.customId.startsWith('shop_ok_');
  const reqId    = interaction.customId.replace(/^shop_(ok|no)_/, '');
  const req      = getRequest(reqId);
  if (!req || req.status !== 'pending') {
    await interaction.reply({ content: '❌ Cette demande a déjà été traitée.', flags: 64 });
    autoClean(interaction);
    return;
  }

  const staffId = interaction.user.id;
  const quand   = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  let embed, dm, logLine, refresh = false;

  if (approuve) {
    const res = levels.retirerPoints(req.userId, req.points);
    if (!res.ok) {
      resolveRequest(reqId, { status: 'refuse', decidedBy: staffId });
      embed = resultatEmbed(req, '❌ ÉCHANGE ANNULÉ', 0xE74C3C,
        'Solde insuffisant au moment de la validation (' + res.solde.toLocaleString('fr-FR') + ' points).\nAucun point retiré.');
      dm = {
        title: '❌ Échange impossible',
        description: 'Ta demande d\'échange de ' + req.points + ' points n\'a pas pu être validée : ton solde était insuffisant. Aucun point n\'a été retiré.',
        color: 0xE74C3C,
      };
      logLine = '⚠️ Échange annulé (solde insuffisant) : <@' + req.userId + '> · ' + req.points + ' points';
    } else {
      resolveRequest(reqId, { status: 'valide', decidedBy: staffId });
      refresh = true;
      embed = resultatEmbed(req, '✅ ÉCHANGE VALIDÉ', 0x2ECC71,
        'Validé par <@' + staffId + '> le ' + quand + '.\n' + req.points + ' points retirés · ' + req.euros + ' € à créditer en jeu.');
      dm = {
        title: '✅ Échange validé',
        description: 'Ta demande d\'échange de ' + req.points + ' points (' + req.euros + ' € en jeu) a été validée par le staff.\nLes points ont été retirés de ton compte. Un administrateur va créditer l\'argent en jeu.',
        color: 0x2ECC71,
      };
      logLine = '✅ Échange validé : <@' + req.userId + '> · ' + req.points + ' points → ' + req.euros + ' € · par <@' + staffId + '>';
    }
  } else {
    resolveRequest(reqId, { status: 'refuse', decidedBy: staffId });
    embed = resultatEmbed(req, '❌ ÉCHANGE REFUSÉ', 0xE74C3C,
      'Refusé par <@' + staffId + '> le ' + quand + '.\nAucun point retiré.');
    dm = {
      title: '❌ Échange refusé',
      description: 'Ta demande d\'échange de ' + req.points + ' points a été refusée par le staff.\nAucun point n\'a été retiré.',
      color: 0xE74C3C,
    };
    logLine = '❌ Échange refusé : <@' + req.userId + '> · ' + req.points + ' points · par <@' + staffId + '>';
  }

  await interaction.update({ content: '', ...panneau({ embeds: [embed] }), components: [] }).catch(() => {});

  if (refresh) await levels.refreshLeaderboard().catch(() => {});

  try {
    const user = await interaction.client.users.fetch(req.userId);
    await user.send({ embeds: [dm] });
  } catch { /* DM fermés : on n'insiste pas */ }

  await agrilog(interaction.guild, logLine);
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
async function startBoutique(client) {
  try {
    const ch = await ensureStaffChannel(client);
    console.log('🛒 Boutique — prêt' + (ch ? ' (salon #' + ch.name + ')' : ' (salon staff non disponible)'));
  } catch (err) {
    console.error('⚠️ Boutique :', err.message);
  }
}

module.exports = {
  startBoutique,
  handleBoutique, handleMonnaie, handleEchange, handleModal, handleDecision,
  TAUX, MIN,
};
