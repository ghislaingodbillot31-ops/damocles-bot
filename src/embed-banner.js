// Bandeau « EUROAGRI » ajouté en bas des embeds du système d'exploitation.
// Une image d'embed force Discord à afficher l'embed à sa largeur maximale sur
// tous les clients → toutes les fiches / annonces ont la même (grande) largeur.
//
// Hébergé en raw GitHub (le dépôt est public) : pas de ré-upload à chaque message.
// Régénéré par scripts/gen-embed-banner.js — bump ?v= si le PNG change.
const BANNER_URL = 'https://raw.githubusercontent.com/ghislaingodbillot31-ops/damocles-bot/master/assets/embed-banner.png?v=1';

// Injecte l'image bandeau sur chaque embed d'un payload de message.
function withBanner(payload) {
  if (!payload || !Array.isArray(payload.embeds)) return payload;
  return {
    ...payload,
    embeds: payload.embeds.map(e => (e.image ? e : { ...e, image: { url: BANNER_URL } })),
  };
}

module.exports = { BANNER_URL, withBanner };
