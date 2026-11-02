const ids = require('./ids');
// Journal d'activité EUROAGRI : une ligne par événement, sans ping.
// Chaque ligne va dans le salon de sa catégorie (cf. ROUTES).

const ROUTES = [
  [/^(💱|✅ Échange)/, 'FS25_BANQUE_CHANNEL_ID'], // échanges de points de la boutique
  // Journal général supprimé (contrats, besoins, propositions, exploitations) : toute autre ligne est ignorée
];

// ID du salon de destination d'une ligne de journal
function canal(line) {
  const route = ROUTES.find(([re]) => re.test(line));
  return route && ids(route[1]);
}

async function agrilog(guild, line) {
  const id = canal(line || '');
  if (!guild || !line || !id) return;
  const ch = guild.channels.cache.get(id)
    || await guild.channels.fetch(id).catch(() => null);
  if (!ch) return console.error('⚠️ agrilog : salon ' + id + ' introuvable');
  await ch.send({ content: line, allowedMentions: { parse: [] } })
    .catch(err => console.error('⚠️ agrilog : envoi dans ' + id + ' impossible :', err.message));
}

module.exports = { agrilog, canal };
