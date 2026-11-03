const ids = require('./ids');
// Journal d'activité EUROAGRI : une ligne par événement, sans ping.
// Chaque ligne va dans le salon de sa catégorie (cf. ROUTES).

const ROUTES = [
  // (échanges boutique : demande + décision, dans le salon d'activité)
  // demandes d'échange de points, contrats/besoins (prise, accord, refus, fin, retrait, nouveau besoin)
  [/^(💱|(✅|❌|⚠️) Échange|📋|📦|🤝 Accord|❌ (Besoin|Contrat)|🏁|🗑️ \*\*|🆕 \*\*.*\*\* recherche : )/, 'FS25_ACTIVITE_CHANNEL_ID'],
  // Le reste (propositions, exploitations) est ignoré
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
