require('dotenv').config();
const { log } = require('./logger');

const SPAM_THRESHOLD = 5;   // messages
const SPAM_WINDOW_MS = 5000; // 5 secondes

// Tracking
const memberMessages = new Map(); // userId -> [timestamps]

const EXCLUDED_ROLE_IDS = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);

/**
 * Anti-raid : appelé à chaque guildMemberAdd
 */
/**
 * Anti-spam : appelé à chaque messageCreate
 */
const estStaff = member => !!member?.permissions?.has('ManageMessages');

async function checkSpam(client, message) {
  if (message.author.bot) return;
  if (estStaff(message.member) || EXCLUDED_ROLE_IDS.some(id => message.member?.roles.cache.has(id))) return;

  const userId = message.author.id;
  const now    = Date.now();

  if (!memberMessages.has(userId)) memberMessages.set(userId, []);
  const timestamps = memberMessages.get(userId);
  timestamps.push(now);

  // Nettoyer les anciens messages
  while (timestamps.length && timestamps[0] < now - SPAM_WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length >= SPAM_THRESHOLD) {
    console.log(`🚨 SPAM DÉTECTÉ — ${message.author.tag} (${timestamps.length} messages en ${SPAM_WINDOW_MS/1000}s)`);
    timestamps.length = 0; // Reset pour éviter les logs en boucle

    await log(client, 'spam_detected', {
      userId: message.author.id,
      channelId: message.channel.id,
      channelName: message.channel.name,
      count: SPAM_THRESHOLD,
    });
  }
}

/**
 * Détection de liens : appelé à chaque messageCreate
 */
async function checkLinks(client, message) {
  if (message.author.bot) return;
  if (estStaff(message.member) || EXCLUDED_ROLE_IDS.some(id => message.member?.roles.cache.has(id))) return;

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const links    = message.content.match(urlRegex);

  if (links && links.length > 0) {
    // Vérifier si c'est un lien suspect (pas discord.com ni les domaines connus)
    const trustedDomains = ['discord.com', 'discord.gg', 'youtube.com', 'youtu.be', 'twitch.tv'];
    const suspiciousLinks = links.filter(link => {
      try {
        const domain = new URL(link).hostname.replace('www.', '');
        return !trustedDomains.some(d => domain.endsWith(d));
      } catch { return false; }
    });

    if (suspiciousLinks.length > 0) {
      console.log(`🔗 Lien suspect de ${message.author.tag} : ${suspiciousLinks.join(', ')}`);
      await log(client, 'link_detected', {
        userId: message.author.id,
        channelId: message.channel.id,
        channelName: message.channel.name,
        links: suspiciousLinks.join(', '),
        content: message.content.slice(0, 100),
      });
    }
  }
}

module.exports = { checkSpam, checkLinks };
