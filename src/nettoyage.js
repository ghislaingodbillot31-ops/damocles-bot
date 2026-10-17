// Une seule version de chaque panneau par salon : quand un panneau a été republié, les anciens messages
// identiques du bot sont supprimés (le plus récent est gardé). Les messages à identifiants variables
// (propositions sugg_ok_12, bugs, tickets…) et ceux des joueurs ne sont jamais touchés.
const SALONS = [
  'INVITE_HUB_CHANNEL_ID', 'HUB_CHANNEL_ID', 'REGLEMENT_CHANNEL_ID', 'BIRTHDAY_CHANNEL_ID', 'SUGG_CHANNEL_ID',
  'BUG_HUB_CHANNEL_ID', 'TEMPVOICE_PANEL_CHANNEL_ID', 'ROLES_CHANNEL_ID', 'TICKET_CHANNEL_ID',
];

// Signature d'un panneau : ses boutons (sans numéro), ou le titre de l'embed pour le centre de contrôle
function signature(m, statut) {
  const ids = m.components.flatMap(r => r.components.map(b => b.customId)).filter(Boolean);
  if (ids.length) return ids.some(i => /\d/.test(i)) ? null : ids.join(',');
  if (statut) return m.embeds[0]?.title || null;
  return null;
}

async function dedoublonner(client, channelId, statut = false) {
  const channel = channelId && (client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null));
  if (!channel?.messages) return 0;
  const messages = [...(await channel.messages.fetch({ limit: 100 }).catch(() => new Map())).values()]
    .filter(m => m.author.id === client.user.id)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const vus = new Set();
  let n = 0;
  for (const m of messages) {
    const sig = signature(m, statut);
    if (!sig) continue;
    if (vus.has(sig)) { await m.delete().then(() => n++).catch(() => {}); } else vus.add(sig);
  }
  return n;
}

async function nettoyerTout(client) {
  let total = 0;
  for (const cle of SALONS) total += await dedoublonner(client, process.env[cle]);
  total += await dedoublonner(client, process.env.STATUS_CHANNEL_ID, true);
  if (total) console.log('🧹 ' + total + ' ancien(s) panneau(x) supprimé(s)');
  return total;
}

module.exports = { nettoyerTout, dedoublonner };
