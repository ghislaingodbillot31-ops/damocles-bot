const activityMap = new Map(); // userId -> lastMessageTimestamp

const INACTIVE_DAYS = 15;
const EXPEL_DAYS    = 40;
const INACTIVE_MS   = INACTIVE_DAYS * 24 * 60 * 60 * 1000;
const EXPEL_MS      = EXPEL_DAYS    * 24 * 60 * 60 * 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Chargement initial — remonte 15 jours d'historique dans tous les salons
 */
async function loadAllChannels(guild) {
  const channels = guild.channels.cache.filter(c => c.isTextBased() && c.viewable);
  const total    = channels.size;
  let   loaded   = 0;
  const cutoff   = Date.now() - INACTIVE_MS;

  console.log('\n📂 Chargement de l\'historique (' + total + ' salons, ' + INACTIVE_DAYS + ' jours)\n');

  for (const [, channel] of channels) {
    loaded++;
    process.stdout.write('\r  Salon chargé : ' + loaded + ' / ' + total + '  ');

    try {
      let lastId       = null;
      let reachedLimit = false;

      for (let page = 0; page < 20 && !reachedLimit; page++) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const [, msg] of messages) {
          if (msg.author.bot) continue;
          if (msg.createdTimestamp < cutoff) { reachedLimit = true; break; }
          const existing = activityMap.get(msg.author.id);
          if (!existing || msg.createdTimestamp > existing) {
            activityMap.set(msg.author.id, msg.createdTimestamp);
          }
        }

        lastId = messages.last()?.id;
        await sleep(200);
      }
    } catch {}
  }

  console.log('\n\n✅ Historique chargé — ' + activityMap.size + ' membres actifs détectés\n');
  return { total, loaded: activityMap.size };
}

/**
 * Enregistre une activité en temps réel
 */
function recordActivity(userId) {
  activityMap.set(userId, Date.now());
}

/**
 * Retourne le timestamp de dernière activité
 */
function getLastActivity(userId) {
  return activityMap.get(userId) || null;
}

/**
 * Calcule le statut d'un membre
 */
function getMemberStatus(member) {
  const now      = Date.now();
  const last     = activityMap.get(member.id);
  const joinedMs = member.joinedTimestamp;

  if ((now - joinedMs) < INACTIVE_MS) return 'new';
  if (last && (now - last) < INACTIVE_MS) return 'active';

  const ref = last ?? joinedMs;
  if ((now - ref) >= EXPEL_MS)    return 'expel';
  if ((now - ref) >= INACTIVE_MS) return 'inactive';
  return 'active';
}

function getDaysInactive(member) {
  const last = activityMap.get(member.id);
  const ref  = last ?? member.joinedTimestamp;
  return Math.floor((Date.now() - ref) / 86400000);
}

module.exports = {
  loadAllChannels, recordActivity, getLastActivity,
  getMemberStatus, getDaysInactive,
  INACTIVE_DAYS, EXPEL_DAYS,
};
