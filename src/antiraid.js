require('dotenv').config();
const { log } = require('./logger');

const RAID_THRESHOLD = 10;  // joins
const RAID_WINDOW_MS = 10000; // 10 secondes
const SPAM_THRESHOLD = 5;   // messages
const SPAM_WINDOW_MS = 5000; // 5 secondes

// Tracking
const recentJoins   = []; // timestamps
const memberMessages = new Map(); // userId -> [timestamps]

const EXCLUDED_ROLE_IDS = (process.env.EXCLUDED_ROLE_IDS || '').split(',').filter(Boolean);

/**
 * Anti-raid : appelé à chaque guildMemberAdd
 */
async function checkRaid(client, member) {
  const now = Date.now();
  recentJoins.push(now);

  // Nettoyer les anciens joins
  while (recentJoins.length && recentJoins[0] < now - RAID_WINDOW_MS) {
    recentJoins.shift();
  }

  if (recentJoins.length >= RAID_THRESHOLD) {
    console.log(`🚨 RAID DÉTECTÉ — ${recentJoins.length} joins en ${RAID_WINDOW_MS/1000}s`);

    // Kick le membre
    await member.kick('Anti-raid — trop de joins simultanés').catch(() => {});

    // Log
    await log(client, 'raid_detected', {
      userId: member.id,
      count: recentJoins.length,
    });
  }
}

/**
 * Anti-spam : appelé à chaque messageCreate
 */
async function checkSpam(client, message) {
  if (message.author.bot) return;
  if (EXCLUDED_ROLE_IDS.some(id => message.member?.roles.cache.has(id))) return;

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
  if (EXCLUDED_ROLE_IDS.some(id => message.member?.roles.cache.has(id))) return;

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

module.exports = { checkRaid, checkSpam, checkLinks };
