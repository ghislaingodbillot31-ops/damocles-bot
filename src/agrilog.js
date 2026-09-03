// Journal d'activité EURO-AGRI : une ligne par événement (contrats / besoins /
// exploitations). Publié dans le salon logs, sans ping.
const LOG_CHANNEL = '1541422309619802153';

async function agrilog(guild, line) {
  if (!guild || !line) return;
  const ch = guild.channels.cache.get(LOG_CHANNEL)
    || await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!ch) return;
  await ch.send({ content: line, allowedMentions: { parse: [] } }).catch(() => {});
}

module.exports = { agrilog, LOG_CHANNEL };
