const fs   = require('fs');
const path = require('path');
const db   = require('./database');

const STATE_PATH = path.join(__dirname, '..', 'data', 'levels.json'); // ids des messages du salon
const XP_PATH    = path.join(__dirname, '..', 'data', 'xp.json');      // LES POINTS (source de vérité)
const MEMBERS_PATH = path.join(__dirname, '..', 'data', 'members.json');

// ── Barème (tout est modifiable ici) ─────────────────────────────────────────
const XP = {
  MESSAGE:        5,     // par message texte
  MESSAGE_CD_MS:  60_000,
  IMAGE:          15,    // bonus message avec image / screenshot
  IMAGE_CD_MS:    5 * 60_000,
  VOICE_PER_MIN:  4,     // par minute en vocal actif (2+ humains, non mute/sourdine)
  INVITE:         250,   // inviter un membre qui rejoint
  INVITE_KEEP:    150,   // bonus si l'invité reste 7 jours
};
const LEVELUP_CHANNEL     = '1538533319430373516'; // annonces de montée de niveau
const LEADERBOARD_CHANNEL = '1538533319430373516'; // message de classement permanent

// ── Courbe de niveaux ────────────────────────────────────────────────────────
function xpToNext(level)      { return 5 * level * level + 50 * level + 100; }
function totalXpForLevel(lvl) { let t = 0; for (let i = 0; i < lvl; i++) t += xpToNext(i); return t; }
function levelFromXp(xp)      { let l = 0; while (xp >= totalXpForLevel(l + 1)) l++; return l; }

// ── État ─────────────────────────────────────────────────────────────────────
let _client = null;
let _leaderboardMsgId = null;
let _baremeMsgId = null;
let _refreshTimer = null;
const cooldowns = new Map();   // userId -> { msg, img }
const pending   = new Map();   // userId -> { dxp, dvoiceMs, dinvites, user }
const inviteCache = new Map(); // code -> uses

// ── Stockage des points : data/xp.json ──────────────────────────────────────
// { [userId]: { xp, level, voiceMs, invites, tag } }
let _xp = {};
let _saveTimer = null;
let _xpDirty   = false;

function loadXp() {
  // 1) fichier xp.json existant
  try {
    const parsed = JSON.parse(fs.readFileSync(XP_PATH, 'utf-8'));
    if (parsed && typeof parsed === 'object') { _xp = parsed; return; }
  } catch {}

  // 2) sinon, migration one-shot depuis members.json (ancien emplacement)
  _xp = {};
  try {
    const raw = JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf-8'));
    for (const [id, m] of Object.entries(raw)) {
      if ((m.xp || 0) > 0 || (m.voiceMs || 0) > 0 || (m.invites || 0) > 0) {
        _xp[id] = {
          xp: m.xp || 0,
          level: m.level ?? levelFromXp(m.xp || 0),
          voiceMs: m.voiceMs || 0,
          invites: m.invites || 0,
          tag: m.tag || m.username || null,
        };
      }
    }
    if (Object.keys(_xp).length) {
      console.log('🎚️ Migration XP : ' + Object.keys(_xp).length + ' membre(s) depuis members.json');
      saveXpNow();
    }
  } catch {}
}

function saveXpNow() {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  _xpDirty = false;
  try {
    fs.mkdirSync(path.dirname(XP_PATH), { recursive: true });
    fs.writeFileSync(XP_PATH, JSON.stringify(_xp, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ xp.json — sauvegarde impossible :', err.message);
  }
}

// Écriture différée (2 s) pour éviter d'écrire le fichier à chaque petite modif
function saveXpSoon() {
  _xpDirty = true;
  if (_saveTimer) return;
  _saveTimer = setTimeout(saveXpNow, 2000);
}

function rec(userId) {
  if (!_xp[userId]) _xp[userId] = { xp: 0, level: 0, voiceMs: 0, invites: 0, tag: null };
  return _xp[userId];
}

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    _leaderboardMsgId = s.leaderboardMsgId || null;
    _baremeMsgId      = s.baremeMsgId || null;
  } catch {}
}
function saveState() {
  try {
    if (!fs.existsSync(path.dirname(STATE_PATH))) fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify({ leaderboardMsgId: _leaderboardMsgId, baremeMsgId: _baremeMsgId }, null, 2), 'utf-8');
  } catch {}
}

function queue(userId, user, { xp = 0, voiceMs = 0, invites = 0 }) {
  const p = pending.get(userId) || { dxp: 0, dvoiceMs: 0, dinvites: 0, user: null };
  p.dxp += xp; p.dvoiceMs += voiceMs; p.dinvites += invites;
  if (user) p.user = user;
  pending.set(userId, p);
}

// Applique les points en attente. AUCUN remise à zéro : on ajoute au total existant.
async function flush() {
  if (!pending.size) return;
  let bougé = false;
  let leveledUp = false;

  for (const [uid, p] of [...pending.entries()]) {
    pending.delete(uid);
    try {
      const r        = rec(uid);
      const oldLevel = r.level ?? levelFromXp(r.xp || 0);

      r.xp      = Math.max(0, (r.xp || 0) + p.dxp);
      r.voiceMs = (r.voiceMs || 0) + p.dvoiceMs;
      r.invites = (r.invites || 0) + p.dinvites;
      r.level   = levelFromXp(r.xp);
      if (p.user) r.tag = p.user.tag || p.user.username || r.tag;

      bougé = true;
      if (r.level > oldLevel) { leveledUp = true; await announceLevelUp(uid, r.level); }
    } catch (e) { console.error('⚠️ levels flush :', e.message); }
  }

  if (bougé) saveXpNow(); // on écrit tout de suite après un flush

  if (leveledUp) await refreshLeaderboard();  // republie en bas après les 🎉
  else if (bougé) await editLeaderboard();     // simple mise à jour du contenu
}

async function announceLevelUp(userId, level) {
  if (!_client || !LEVELUP_CHANNEL) return;
  const ch = _client.channels.cache.get(LEVELUP_CHANNEL)
    || await _client.channels.fetch(LEVELUP_CHANNEL).catch(() => null);
  if (!ch) return;
  await ch.send({
    embeds: [{
      description: '🎉 <@' + userId + '> passe **niveau ' + level + '** !',
      color: 0xF1C40F,
    }],
  }).catch(() => {});
}

// ── Bloc « comment gagner des points » ──────────────────────────────────────
function baremeTexte() {
  return [
    '💬 **Message** — +' + XP.MESSAGE + ' XP *(1×/min)*',
    '📸 **Message avec image / screenshot** — +' + XP.IMAGE + ' XP *(1×/5 min)*',
    '🎙️ **Vocal** — +' + XP.VOICE_PER_MIN + ' XP / minute *(à 2+ personnes, micro non coupé)*',
    '📥 **Inviter un membre qui rejoint** — +' + XP.INVITE + ' XP',
    '🌱 **Ton invité reste 7 jours** — +' + XP.INVITE_KEEP + ' XP bonus',
  ].join('\n');
}

const MEDAILLE = ['🥇', '🥈', '🥉'];

// Bloc 1 : explication (statique)
function baremeEmbed() {
  return {
    title: '📖  COMMENT GAGNER DES POINTS',
    description: [
      baremeTexte(),
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '🎚️ **Niveaux** — ton XP total te fait monter de niveau.',
      'Tape **/niveau** pour voir ta progression, ton rang, ton temps vocal et tes invitations.',
      'Tape **/classement** pour le classement complet.',
    ].join('\n'),
    color: 0x5865F2,
  };
}

// Bloc 2 : le classement (mis à jour en continu)
function classementEmbed() {
  const top = getClassement(15);
  const lignes = top.length
    ? top.map(e => (MEDAILLE[e.rang - 1] || '`#' + e.rang + '`') + ' <@' + e.id + '> — **Nv ' + e.level + '** · ' + e.xp.toLocaleString('fr-FR') + ' XP').join('\n')
    : '*Personne n\'a encore d\'XP — sois le premier !*';

  return {
    title: '🏆  CLASSEMENT XP',
    description: lignes,
    color: 0xF1C40F,
    footer: { text: 'EURO-AGRI — Mis à jour' },
    timestamp: new Date().toISOString(),
  };
}

// ── Message de classement permanent (toujours en bas du salon) ──────────────
let _refreshing = false;

async function _channel() {
  if (!_client || !LEADERBOARD_CHANNEL) return null;
  return _client.channels.cache.get(LEADERBOARD_CHANNEL)
    || await _client.channels.fetch(LEADERBOARD_CHANNEL).catch(() => null);
}

// Met à jour le contenu SANS déplacer le message (utilisé quand l'XP bouge)
async function editLeaderboard() {
  if (_refreshing) return;
  _refreshing = true;
  try {
    const ch = await _channel();
    if (!ch) return;
    const embed = classementEmbed();
    if (_leaderboardMsgId) {
      const msg = await ch.messages.fetch(_leaderboardMsgId).catch(() => null);
      if (msg) { await msg.edit({ embeds: [embed] }).catch(() => {}); return; }
    }
    const m = await ch.send({ embeds: [embed] }).catch(() => null);
    _leaderboardMsgId = m ? m.id : null;
    saveState();
  } finally { _refreshing = false; }
}

// Nettoie les anciens messages de classement du bot (garde les 🎉 montées de niveau)
async function _clearChannel(ch) {
  try {
    const msgs = await ch.messages.fetch({ limit: 50 });
    for (const [, m] of msgs) {
      if (m.author.id !== _client.user.id) continue;
      const estLevelUp = (m.embeds[0]?.description || '').startsWith('🎉');
      if (!estLevelUp) await m.delete().catch(() => {}); // classement + tout autre message du bot
    }
  } catch {}
}

// Supprime TOUT message du bot et republie les 2 blocs EN BAS
// (démarrage, après un level-up, chaque heure)
async function refreshLeaderboard() {
  if (_refreshing) return;
  _refreshing = true;
  try {
    const ch = await _channel();
    if (!ch) return;
    await _clearChannel(ch);
    const b = await ch.send({ embeds: [baremeEmbed()] }).catch(() => null);
    const m = await ch.send({ embeds: [classementEmbed()] }).catch(() => null);
    _baremeMsgId      = b ? b.id : null;
    _leaderboardMsgId = m ? m.id : null;
    saveState();
  } finally { _refreshing = false; }
}

// ── Messages ─────────────────────────────────────────────────────────────────
function onMessage(message) {
  if (message.author.bot || !message.guild) return;
  const uid = message.author.id;
  const now = Date.now();
  const cd  = cooldowns.get(uid) || { msg: 0, img: 0 };

  let gained = 0;
  if (now - cd.msg >= XP.MESSAGE_CD_MS) { gained += XP.MESSAGE; cd.msg = now; }

  const hasImage = message.attachments.some(a =>
    (a.contentType && a.contentType.startsWith('image/')) || /\.(png|jpe?g|gif|webp)$/i.test(a.name || ''));
  if (hasImage && now - cd.img >= XP.IMAGE_CD_MS) { gained += XP.IMAGE; cd.img = now; }

  cooldowns.set(uid, cd);
  if (gained) queue(uid, message.author, { xp: gained });
}

// ── Vocal ────────────────────────────────────────────────────────────────────
function onVoice() {}

// Balaye TOUS les salons vocaux du serveur toutes les minutes et crédite
// chaque humain actif — fonctionne même s'il était déjà connecté au démarrage.
function sweepVoice() {
  if (!_client) return;
  const guild = _client.guilds.cache.first();
  if (!guild) return;

  const salonsVocaux = guild.channels.cache.filter(c => c.isVoiceBased && c.isVoiceBased());
  for (const [, ch] of salonsVocaux) {
    const humains = ch.members.filter(m => !m.user.bot);
    if (humains.size < 2) continue; // besoin d'au moins 2 personnes

    for (const [uid, gm] of humains) {
      const vs = gm.voice;
      if (!vs) continue;
      if (vs.selfMute || vs.selfDeaf || vs.serverMute || vs.serverDeaf) continue;
      queue(uid, gm.user, { xp: XP.VOICE_PER_MIN, voiceMs: 60_000 });
    }
  }
}

// ── Invitations ──────────────────────────────────────────────────────────────
async function cacheInvites(guild) {
  try {
    const invs = await guild.invites.fetch();
    inviteCache.clear();
    for (const [, inv] of invs) inviteCache.set(inv.code, inv.uses || 0);
  } catch {}
}

async function onMemberAdd(member) {
  if (member.user.bot) return;
  try {
    const invs = await member.guild.invites.fetch();
    let inviter = null;
    for (const [, inv] of invs) {
      const avant = inviteCache.get(inv.code) ?? 0;
      if ((inv.uses || 0) > avant) { inviter = inv.inviter; }
      inviteCache.set(inv.code, inv.uses || 0);
    }

    if (inviter && inviter.id !== member.id && !inviter.bot) {
      queue(inviter.id, inviter, { xp: XP.INVITE, invites: 1 });
      await db.updateMember(member.id, {
        invitedBy: inviter.id,
        invitedAt: new Date().toISOString(),
        inviteBonusDone: false,
      });
      console.log('📥 ' + member.user.tag + ' invité par ' + inviter.tag + ' (+' + XP.INVITE + ' XP)');
    }
  } catch (e) { console.error('⚠️ invite tracking :', e.message); }
}

// Bonus rétention 7 jours — appelé par la tâche quotidienne
async function checkRetention() {
  const all = await db.getAllMembers();
  const limite = Date.now() - 7 * 86_400_000;
  let bonus = 0;

  for (const m of all) {
    if (!m.invitedBy || m.inviteBonusDone || !m.present) continue;
    if (!m.invitedAt || Date.parse(m.invitedAt) > limite) continue;

    const r = rec(m.invitedBy);
    r.xp   += XP.INVITE_KEEP;
    r.level = levelFromXp(r.xp);
    await db.updateMember(m.id, { inviteBonusDone: true });
    bonus++;
  }
  if (bonus) saveXpNow();
  return bonus;
}

// ── Getters pour les commandes ───────────────────────────────────────────────
function getClassement(limit = 15) {
  return Object.entries(_xp)
    .filter(([, v]) => (v.xp || 0) > 0)
    .sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0))
    .slice(0, limit)
    .map(([id, v], i) => ({
      rang: i + 1, id, xp: v.xp || 0, level: v.level ?? levelFromXp(v.xp || 0),
    }));
}

function getRang(userId) {
  const classees = Object.entries(_xp)
    .filter(([, v]) => (v.xp || 0) > 0)
    .sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0));
  const idx = classees.findIndex(([id]) => id === userId);
  const r   = _xp[userId] || {};
  const xp  = r.xp || 0;
  const level = r.level ?? levelFromXp(xp);
  return {
    xp, level,
    rang: idx === -1 ? null : idx + 1,
    total: classees.length,
    voiceMs: r.voiceMs || 0,
    invites: r.invites || 0,
    xpNiveauActuel: totalXpForLevel(level),
    xpNiveauSuivant: totalXpForLevel(level + 1),
  };
}

function adminAjuster(userId, delta) {
  const r = rec(userId);
  r.xp    = Math.max(0, (r.xp || 0) + delta);
  r.level = levelFromXp(r.xp);
  saveXpNow();
  return { xp: r.xp, level: r.level };
}

function adminReset() {
  const n = Object.keys(_xp).length;
  _xp = {};
  saveXpNow();
  return n;
}

// ── Démarrage ────────────────────────────────────────────────────────────────
function _shutdown() {
  // dernier filet de sécurité : on applique les points en attente et on sauvegarde
  try {
    for (const [uid, p] of pending.entries()) {
      const r = rec(uid);
      r.xp = Math.max(0, (r.xp || 0) + p.dxp);
      r.voiceMs = (r.voiceMs || 0) + p.dvoiceMs;
      r.invites = (r.invites || 0) + p.dinvites;
      r.level = levelFromXp(r.xp);
    }
    pending.clear();
  } catch {}
  saveXpNow();
}

async function startLevels(client) {
  _client = client;
  loadXp();
  loadState();
  const guild = client.guilds.cache.first();
  if (guild) await cacheInvites(guild);

  setInterval(() => sweepVoice(), 60_000);
  setInterval(() => flush().catch(() => {}), 30_000);
  setInterval(() => { if (_xpDirty) saveXpNow(); }, 5 * 60_000); // filet de sécurité

  // Sauvegarde des points quand le process s'arrête (redéploiement Render, Ctrl+C…)
  process.once('SIGTERM', () => { _shutdown(); process.exit(0); });
  process.once('SIGINT',  () => { _shutdown(); process.exit(0); });
  process.once('beforeExit', _shutdown);

  await refreshLeaderboard();
  _refreshTimer = setInterval(() => refreshLeaderboard().catch(() => {}), 60 * 60_000); // toutes les heures

  console.log('🎚️ Système de niveaux — prêt (' + Object.keys(_xp).length + ' membre(s) avec XP)');
}

module.exports = {
  XP, LEVELUP_CHANNEL, LEADERBOARD_CHANNEL,
  startLevels, onMessage, onVoice, onMemberAdd, cacheInvites, checkRetention, flush,
  levelFromXp, totalXpForLevel,
  getClassement, getRang, adminAjuster, adminReset,
  baremeEmbed, classementEmbed, refreshLeaderboard,
};
