const ids = require('./ids');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const { dataPath }       = require('./paths');
const { panneau }        = require('./embed-format');
const CONFIG_PATH        = dataPath('welcome-config.json');
const LOG_CHANNEL_ID     = process.env.LOG_CHANNEL_ID;
const REGLEMENT_CHANNEL_ID = process.env.REGLEMENT_CHANNEL_ID;
const CHAT_CHANNEL_ID      = process.env.CHAT_CHANNEL_ID || ids('CHAT_CHANNEL_ID');

// ── Config personnalisable ────────────────────────────────────────────────────
function loadWelcomeConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {
    message: '🎉 **Dernière étape** {mention} : présente-toi aux autres membres !',
    color: '2ECC71',
    enabled: true,
  };
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveWelcomeConfig(cfg) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function getWelcomeConfig()      { return loadWelcomeConfig(); }
// ── Message de bienvenue après règlement validé (ping dans le général) ─────────
async function sendWelcomeAfterReglement(member) {
  const channel = member.guild.channels.cache.get(CHAT_CHANNEL_ID)
    || await member.guild.channels.fetch(CHAT_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error('⚠️ sendWelcomeAfterReglement : salon général introuvable (CHAT_CHANNEL_ID=' + CHAT_CHANNEL_ID + ')');
    return;
  }

  const cfg = loadWelcomeConfig();
  if (!cfg.enabled) return;

  const text = (cfg.message || '')
    .replace(/{pseudo}/g,       member.user.username)
    .replace(/{mention}/g,      '<@' + member.id + '>')
    .replace(/{serveur}/g,      member.guild.name)
    .replace(/{membres}/g,      member.guild.memberCount);

  // message simple : du texte, sans cadre ni icône (le joueur est mentionné)
  const simple = require('./simple').simplifier(text);
  await channel.send({
    content: simple.includes('<@' + member.id + '>') ? simple : '<@' + member.id + '> ' + simple,
    allowedMentions: { users: [member.id] },
  }).catch(console.error);
}

// ── Annonce d'arrivée dans « bienvenue » (+ qui a invité le joueur) ───────────
// Embed natif, largeur fixe commune (panneau) : titre, message bilingue, puis 3 blocs d'infos et la marche à suivre.
function embedArrivee({ nom, serveur, num, creeLe, inviterId, avatar, date }) {
  const fields = [
    { name: '🔢 Membre n° · Member #', value: '**' + num + '**', inline: true },
    { name: '📅 Compte créé · Created', value: '<t:' + creeLe + ':D>', inline: true },
    { name: '🤝 Invité par · Invited by', value: inviterId ? '<@' + inviterId + '>' : '—', inline: true },
  ];
  if (REGLEMENT_CHANNEL_ID || CHAT_CHANNEL_ID) fields.push({ name: '🚀 Pour commencer · Getting started', value: [
    REGLEMENT_CHANNEL_ID ? '1️⃣ Accepte le règlement · Accept the rules → <#' + REGLEMENT_CHANNEL_ID + '>' : '',
    CHAT_CHANNEL_ID ? '2️⃣ Présente-toi · Introduce yourself → <#' + CHAT_CHANNEL_ID + '>' : '',
  ].filter(Boolean).join('\n') });
  return panneau({ embeds: [{
    title: '👋 Bienvenue ' + nom + ' !',
    description: '🇫🇷 Bienvenue sur **' + serveur + '**, installe-toi !\n🇬🇧 Welcome to **' + serveur + '**, make yourself at home!',
    color: 0x2ECC71,
    thumbnail: avatar ? { url: avatar } : undefined,
    fields,
    footer: { text: 'MonCopainBot' },
    timestamp: date || new Date().toISOString(),
  }] }).embeds;
}

async function annoncerArrivee(member, inviterId) {
  const id = ids('WELCOME_CHANNEL_ID');
  const channel = id && (member.guild.channels.cache.get(id) || await member.guild.channels.fetch(id).catch(() => null));
  if (!channel) return;
  await channel.send({
    content: '<@' + member.id + '>',
    allowedMentions: { users: [member.id] },
    embeds: embedArrivee({ nom: member.displayName, serveur: member.guild.name, num: member.guild.memberCount,
      creeLe: Math.floor(member.user.createdTimestamp / 1000), inviterId, avatar: member.user.displayAvatarURL({ size: 256 }) }),
  }).catch(err => console.error('⚠️ annoncerArrivee :', err.message));
}

// ── MP envoyé à l'arrivée : marche à suivre (règlement + présentation) ──────────
async function sendJoinDM(member) {
  const reglementMention = REGLEMENT_CHANNEL_ID ? '<#' + REGLEMENT_CHANNEL_ID + '>' : 'le salon **#règlement**';
  const chatMention      = CHAT_CHANNEL_ID ? '<#' + CHAT_CHANNEL_ID + '>' : 'le salon **#bavardage**';

  try {
    await member.send(panneau({
      embeds: [{
        title: '👋 Bienvenue sur ' + member.guild.name + ' !',
        description: [
          'Salut ' + member.user.username + ' !',
          '',
          'Avant de pouvoir profiter du serveur, deux petites étapes :',
          '',
          '**1.** ✅ Accepte le règlement dans ' + reglementMention,
          '**2.** 💬 Présente-toi dans ' + chatMention,
          '',
          'À très vite sur le serveur 🌾',
        ].join('\n'),
        color: 0x2ECC71,
        thumbnail: { url: member.user.displayAvatarURL() },
        footer: { text: 'MonCopainBot' },
        timestamp: new Date().toISOString(),
      }],
    }));
  } catch {
    // MP fermés : on ne bloque pas l'arrivée du membre pour autant.
  }
}

// ── Message de départ ─────────────────────────────────────────────────────────
async function sendLeave(member) {
  const leaveChannelId = process.env.LOG_CHANNEL_ID;
  if (!leaveChannelId) return;
  const channel = member.guild.channels.cache.get(leaveChannelId);
  if (!channel) return;

  await channel.send(panneau({
    embeds: [{
      title: '👋 DÉPART',
      description: '👋 **' + member.user.username + '** a quitté le serveur.',
      color: 0x95A5A6,
      footer: { text: 'MonCopainBot' },
      timestamp: new Date().toISOString(),
    }]
  })).catch(console.error);
}

module.exports = { embedArrivee, annoncerArrivee, sendWelcomeAfterReglement, sendJoinDM, sendLeave, getWelcomeConfig };