// Deux modes de vérification par code :
//
// • VERIF_MODE=code (DOMINIUS) : le nouvel arrivant reçoit un code dans le salon de vérification, le retape et obtient
//   le rôle Membres. Aucune expulsion.
//
// • VERIF_MODE=code-compte (VANGUARD) : le compte est d'abord vérifié dans bot-status (verification.verifyMember).
//   Une fois validé, un salon PRIVÉ « code-<pseudo> » s'ouvre (visible du seul joueur et du staff) et le code lui est envoyé
//   en MP (à défaut dans ce salon privé). Le bon code donne le rôle « En attente » (accès au règlement) et supprime le salon ;
//   l'acceptation du règlement donne ensuite l'accès à tout. Il n'est jamais nécessaire de parler pour activer son compte.
const crypto = require('crypto');
const fs = require('fs');
const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const db = require('./database');
const { log } = require('./logger');
const { dataPath } = require('./paths');

const channelId = () => process.env.VERIFICATION_CHANNEL_ID;
const FLOW = () => process.env.VERIF_MODE === 'code-compte';
const MAX_ESSAIS = 5;
// Rôles qui prouvent que le code a déjà été validé (ou que le membre est plus loin dans le parcours)
const dejaActif = member => ['MEMBRE_ROLE_ID', 'ATTENTE_ROLE_ID', 'REGLEMENT_ROLE_ID', 'ACTIVE_ROLE_ID']
  .some(k => process.env[k] && member.roles.cache.has(process.env[k]));
const newCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const flash = async (channel, text, ms = 6000) => {
  const m = await channel.send(text).catch(() => null);
  if (m) setTimeout(() => m.delete().catch(() => {}), ms);
};

// ── code-compte : état persistant { userId: { code, channelId, essais } } ────────
const STORE_PATH = dataPath('codeverif.json');
let store = {};
try { store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); } catch {}
const save = () => { try { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8'); } catch {} };

const slug = member => 'code-' + (String(member.user.username).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || member.id);

// Salon privé du joueur (réutilisé s'il existe déjà)
async function salonPrive(member) {
  const g = member.guild;
  const ancien = store[member.id]?.channelId && (g.channels.cache.get(store[member.id].channelId) || await g.channels.fetch(store[member.id].channelId).catch(() => null));
  if (ancien) return ancien;
  const parent = g.channels.cache.get(process.env.CODE_CATEGORY_ID)?.id || g.channels.cache.get(channelId())?.parentId || null;
  const voir = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages];
  const overwrites = [
    { id: g.id, deny: [P.ViewChannel] },
    { id: member.id, allow: voir },
    { id: g.client.user.id, allow: [...voir, P.ManageChannels, P.ManageMessages] },
  ];
  for (const r of g.roles.cache.filter(r => !r.managed && (r.permissions.has(P.Administrator) || /mod[eé]rat/i.test(r.name))).values()) {
    overwrites.push({ id: r.id, allow: voir });
  }
  return g.channels.create({
    name: slug(member), type: ChannelType.GuildText, parent, permissionOverwrites: overwrites,
    topic: 'Code de validation de ' + member.user.tag, reason: 'Vérification par code : ' + member.user.tag,
  }).catch(err => { console.error('⚠️ codeverif : salon privé impossible :', err.message); return null; });
}

// Génère un code, l'envoie en MP (sinon dans le salon privé) et le mémorise
async function issueFlow(member) {
  const channel = await salonPrive(member);
  if (!channel) return null;
  const code = newCode();
  store[member.id] = { code, channelId: channel.id, essais: 0 };
  save();

  const embedCode = {
    title: '🔐 Ton code de validation',
    description: 'Voici ton code pour activer ton compte sur **' + member.guild.name + '** :\n# `' + code + '`\nTape-le dans <#' + channel.id + '>.',
    color: 0x3498DB,
  };
  let mp = true;
  await member.send({ embeds: [embedCode] }).catch(() => { mp = false; });
  await channel.send({
    content: '<@' + member.id + '>',
    embeds: [{
      title: '🔐 Code de validation',
      description: [
        'Bienvenue sur **' + member.guild.name + '** ! Ton compte est vérifié, il reste à l\'activer.',
        mp ? '📩 Ton **code** t\'a été envoyé en **message privé**. Tape-le ici pour continuer.'
           : '⚠️ Tes MP sont fermés : voici ton code (visible de toi seul) :\n# `' + code + '`\nTape-le ici pour continuer.',
      ].join('\n'),
      color: 0x3498DB,
    }],
  }).catch(() => {});
  return channel;
}

async function onMessageFlow(message) {
  const entree = Object.entries(store).find(([, v]) => v.channelId === message.channelId);
  if (!entree) return false;
  const [userId, e] = entree;
  if (message.author.id !== userId) return false; // le staff peut parler dans le salon
  message.delete().catch(() => {});
  const member = message.member;
  if (!member) return true;

  if (message.content.trim().toUpperCase() === e.code) {
    if (process.env.ATTENTE_ROLE_ID) await member.roles.add(process.env.ATTENTE_ROLE_ID).catch(() => {});
    // (sur DOMINIUS le rôle « En attente » est le rôle Vérification lui-même : on ne le retire pas)
    if (process.env.VERIFICATION_ROLE_ID && process.env.VERIFICATION_ROLE_ID !== process.env.ATTENTE_ROLE_ID) await member.roles.remove(process.env.VERIFICATION_ROLE_ID).catch(() => {});
    await db.upsertMember(member.user, { verifiedAt: new Date().toISOString(), verificationResult: 'ok', codeValidatedAt: new Date().toISOString() });
    delete store[userId]; save();
    await message.channel.send({ content: '<@' + userId + '>', embeds: [{
      description: '✅ **Compte activé !** Lis et accepte le **règlement** (<#' + process.env.REGLEMENT_CHANNEL_ID + '>) pour accéder au serveur.\nCe salon va se fermer.',
      color: 0x2ECC71,
    }] }).catch(() => {});
    await log(message.client, 'verification_ok', { userId });
    setTimeout(() => message.channel.delete('Code validé').catch(() => {}), 8000);
    return true;
  }

  e.essais++;
  if (e.essais >= MAX_ESSAIS) {
    await flash(message.channel, '❌ Trop d\'essais : un **nouveau code** vient de t\'être envoyé.', 10000);
    await issueFlow(member);
  } else {
    save();
    await flash(message.channel, '❌ Code incorrect (' + e.essais + '/' + MAX_ESSAIS + '), réessaie.');
  }
  return true;
}

// Le joueur est parti : on supprime son salon et son code
async function cleanup(member) {
  const e = store[member.id];
  if (!e) return;
  delete store[member.id]; save();
  (member.guild.channels.cache.get(e.channelId) || await member.guild.channels.fetch(e.channelId).catch(() => null))?.delete('Joueur parti').catch(() => {});
}

// ── mode « code » (DOMINIUS) : code dans le salon de vérification ───────────────
const codes = new Map(); // userId → { code, msg }  (perdu au redémarrage : un nouveau code est alors redonné)

async function issueSimple(member) {
  const channel = member.guild.channels.cache.get(channelId());
  if (!channel) return;
  const prev = codes.get(member.id);
  if (prev) prev.msg?.delete().catch(() => {});
  const code = newCode();
  const msg = await channel.send({
    content: '<@' + member.id + '>',
    embeds: [{
      title: '🔐 Vérification',
      description: 'Bienvenue sur **' + member.guild.name + '** !\nTape ce code dans ce salon pour accéder au serveur :\n# `' + code + '`',
      color: 0x3498DB,
    }],
  }).catch(() => null);
  codes.set(member.id, { code, msg });
}

async function onMessageSimple(message) {
  if (message.channel.id !== channelId()) return false;
  const { member } = message;
  const membreId = process.env.MEMBRE_ROLE_ID || process.env.ACTIVE_ROLE_ID; // rôle « membre » : Membres (DOMINIUS) ou Membre vérifié (VANGUARD)
  if (member.roles.cache.has(membreId) || member.permissions.has('ManageMessages')) return false;

  message.delete().catch(() => {});
  const entry = codes.get(member.id);
  if (!entry) { await issueSimple(member); return true; }
  if (message.content.trim().toUpperCase() !== entry.code) {
    await flash(message.channel, '❌ <@' + member.id + '> code incorrect, réessaie.');
    return true;
  }
  await member.roles.add(membreId).catch(() => {});
  if (process.env.VERIFICATION_ROLE_ID) await member.roles.remove(process.env.VERIFICATION_ROLE_ID).catch(() => {});
  await db.upsertMember(member.user, { verifiedAt: new Date().toISOString(), verificationResult: 'ok' });
  entry.msg?.delete().catch(() => {});
  codes.delete(member.id);
  await flash(message.channel, '✅ <@' + member.id + '> vérifié, bienvenue !');
  await log(message.client, 'verification_ok', { userId: member.id });
  return true;
}

// true = message traité (salon de vérification / de code), l'appelant s'arrête là
const onMessage = message => FLOW() ? onMessageFlow(message) : onMessageSimple(message);
const issue = member => FLOW() ? issueFlow(member) : issueSimple(member);

module.exports = { issue, onMessage, cleanup, dejaActif };
