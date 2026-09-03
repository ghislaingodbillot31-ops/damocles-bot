const db = require('./database');

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
const LEVELUP_CHANNEL = '1538533319430373516';

// ── Courbe de niveaux ────────────────────────────────────────────────────────
function xpToNext(level)      { return 5 * level * level + 50 * level + 100; }
function totalXpForLevel(lvl) { let t = 0; for (let i = 0; i < lvl; i++) t += xpToNext(i); return t; }
function levelFromXp(xp)      { let l = 0; while (xp >= totalXpForLevel(l + 1)) l++; return l; }

// ── État ─────────────────────────────────────────────────────────────────────
let _client = null;
const cooldowns = new Map();   // userId -> { msg, img }
const voiceSince = new Map();  // userId -> timestamp de la dernière minute créditée
const pending   = new Map();   // userId -> { dxp, dvoiceMs, dinvites, user }
const inviteCache = new Map(); // code -> uses

function queue(userId, user, { xp = 0, voiceMs = 0, invites = 0 }) {
  const p = pending.get(userId) || { dxp: 0, dvoiceMs: 0, dinvites: 0, user: null };
  p.dxp += xp; p.dvoiceMs += voiceMs; p.dinvites += invites;
  if (user) p.user = user;
  pending.set(userId, p);
}

async function flush() {
  for (const [uid, p] of [...pending.entries()]) {
    pending.delete(uid);
    try {
      let m = await db.getMember(uid);
      if (!m && p.user) m = await db.upsertMember(p.user);
      if (!m) continue;

      const oldXp    = m.xp || 0;
      const oldLevel = m.level ?? levelFromXp(oldXp);
      const newXp    = Math.max(0, oldXp + p.dxp);
      const newLevel = levelFromXp(newXp);

      await db.updateMember(uid, {
        xp: newXp,
        level: newLevel,
        voiceMs: (m.voiceMs || 0) + p.dvoiceMs,
        invites: (m.invites || 0) + p.dinvites,
      });

      if (newLevel > oldLevel) announceLevelUp(uid, newLevel);
    } catch (e) { console.error('⚠️ levels flush :', e.message); }
  }
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
function onVoice(oldState, newState) {
  const uid = newState.id;
  if (!newState.channelId) voiceSince.delete(uid);            // a quitté
  else if (!voiceSince.has(uid)) voiceSince.set(uid, Date.now()); // vient d'arriver
}

function sweepVoice() {
  if (!_client) return;
  const guild = _client.guilds.cache.first();
  if (!guild) return;

  for (const [uid] of [...voiceSince.entries()]) {
    const gm = guild.members.cache.get(uid);
    const vs = gm?.voice;
    if (!vs || !vs.channelId || !vs.channel) { voiceSince.delete(uid); continue; }
    if (gm.user.bot) { voiceSince.delete(uid); continue; }

    const humains = vs.channel.members.filter(m => !m.user.bot).size;
    const actif   = humains >= 2 && !vs.selfMute && !vs.selfDeaf && !vs.serverMute && !vs.serverDeaf;
    if (actif) queue(uid, gm.user, { xp: XP.VOICE_PER_MIN, voiceMs: 60_000 });
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

    const inviter = await db.getMember(m.invitedBy);
    if (inviter) {
      await db.updateMember(m.invitedBy, {
        xp: (inviter.xp || 0) + XP.INVITE_KEEP,
        level: levelFromXp((inviter.xp || 0) + XP.INVITE_KEEP),
      });
    }
    await db.updateMember(m.id, { inviteBonusDone: true });
    bonus++;
  }
  return bonus;
}

// ── Getters pour les commandes ───────────────────────────────────────────────
async function getClassement(limit = 15) {
  const all = (await db.getAllMembers()).filter(m => (m.xp || 0) > 0);
  all.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return all.slice(0, limit).map((m, i) => ({
    rang: i + 1, id: m.id, xp: m.xp || 0, level: m.level ?? levelFromXp(m.xp || 0),
  }));
}

async function getRang(userId) {
  const all = (await db.getAllMembers()).filter(m => (m.xp || 0) > 0);
  all.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const idx = all.findIndex(m => m.id === userId);
  const m   = (await db.getMember(userId)) || {};
  const xp  = m.xp || 0;
  const level = m.level ?? levelFromXp(xp);
  return {
    xp, level,
    rang: idx === -1 ? null : idx + 1,
    total: all.length,
    voiceMs: m.voiceMs || 0,
    invites: m.invites || 0,
    xpNiveauActuel: totalXpForLevel(level),
    xpNiveauSuivant: totalXpForLevel(level + 1),
  };
}

async function adminAjuster(userId, delta) {
  const m = (await db.getMember(userId)) || (await db.upsertMember({ id: userId, tag: userId, username: userId }));
  const xp = Math.max(0, (m.xp || 0) + delta);
  await db.updateMember(userId, { xp, level: levelFromXp(xp) });
  return { xp, level: levelFromXp(xp) };
}

async function adminReset() {
  const all = await db.getAllMembers();
  let n = 0;
  for (const m of all) {
    if (m.xp || m.voiceMs || m.invites) {
      await db.updateMember(m.id, { xp: 0, level: 0, voiceMs: 0, invites: 0 });
      n++;
    }
  }
  return n;
}

// ── Démarrage ────────────────────────────────────────────────────────────────
async function startLevels(client) {
  _client = client;
  const guild = client.guilds.cache.first();
  if (guild) await cacheInvites(guild);

  setInterval(() => sweepVoice(), 60_000);
  setInterval(() => flush().catch(() => {}), 30_000);
  console.log('🎚️ Système de niveaux — prêt');
}

module.exports = {
  XP, LEVELUP_CHANNEL,
  startLevels, onMessage, onVoice, onMemberAdd, cacheInvites, checkRetention, flush,
  levelFromXp, totalXpForLevel,
  getClassement, getRang, adminAjuster, adminReset,
};
