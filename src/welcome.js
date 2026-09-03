const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const { dataPath }       = require('./paths');
const CONFIG_PATH        = dataPath('welcome-config.json');
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const LOG_CHANNEL_ID     = process.env.LOG_CHANNEL_ID;

// ── Config personnalisable ────────────────────────────────────────────────────
function loadWelcomeConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {
    message: [
      "Bienvenue {pseudo} ! Tu as passé les premières étapes de ta vérification, désormais il ne te reste plus qu'à suivre les étapes suivantes :",
      '',
      '• 👋 Dire bonjour dans le salon <#1538533261314236527>',
      '• 🎭 Prendre un rôle dans le salon <#1538537709633802270>',
      '',
      "Ensuite, n'hésite pas à discuter et à rejoindre les salons vocaux !",
      'À bientôt 👋',
      '',
      '⚠️ Si tu ne publies rien et ne te connectes pas, tu seras automatiquement expulsé sous 24 heures.',
    ].join('\n'),
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
function setWelcomeConfig(cfg)   { saveWelcomeConfig({ ...loadWelcomeConfig(), ...cfg }); return getWelcomeConfig(); }

// ── Message de bienvenue après règlement validé ───────────────────────────────
async function sendWelcomeAfterReglement(member) {
  if (!WELCOME_CHANNEL_ID) return;
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const cfg  = loadWelcomeConfig();
  if (!cfg.enabled) return;

  const text = (cfg.message || '')
    .replace(/{pseudo}/g,       member.user.username)
    .replace(/{mention}/g,      '<@' + member.id + '>')
    .replace(/{serveur}/g,      member.guild.name)
    .replace(/{membres}/g,      member.guild.memberCount);

  await channel.send({
    content: '<@' + member.id + '>',
    embeds: [{
      description: text,
      color: parseInt(cfg.color || '2ECC71', 16),
      thumbnail: { url: member.user.displayAvatarURL() },
      footer: { text: member.guild.name + ' — Damoclès Bot' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

// ── Message de départ ─────────────────────────────────────────────────────────
async function sendLeave(member) {
  const leaveChannelId = process.env.DAMOCLES_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  if (!leaveChannelId) return;
  const channel = member.guild.channels.cache.get(leaveChannelId);
  if (!channel) return;

  await channel.send({
    embeds: [{
      description: '👋 **' + member.user.username + '** a quitté le serveur.',
      color: 0x95A5A6,
      footer: { text: member.guild.name },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);
}

module.exports = { sendWelcomeAfterReglement, sendLeave, getWelcomeConfig, setWelcomeConfig };