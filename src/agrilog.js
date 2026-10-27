const ids = require('./ids');
// Journal d'activité EUROAGRI : une ligne par événement, sans ping.
// Chaque ligne va dans le salon de sa catégorie (cf. ROUTES).

const ROUTES = [
  [/^(💱|✅ Échange)/,                         'FS25_BANQUE_CHANNEL_ID'], // échanges de points de la boutique
  [/^🛠️|^(✅|❌) Proposition n°|^❌ Mod refusé/, 'MODS_CHANNEL_ID'],        // propositions de mods
  [/^💡/,                                      'SUGG_CHANNEL_ID'],        // propositions de jeux
  [/./,                                        'CONTRAT_CHANNEL_ID'],     // contrats, besoins, exploitations
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
  if (!ch) return;
  await ch.send({ content: line, allowedMentions: { parse: [] } }).catch(() => {});
}

module.exports = { agrilog, canal };
