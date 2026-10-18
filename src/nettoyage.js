// Quand un salon de panneaux est actualisé, tout ce que le bot y avait posté est supprimé, sauf les panneaux
// qui viennent d'être placés (le plus récent de chaque type est gardé). Les messages des joueurs ne sont jamais touchés.
// Salons « stricts » : uniquement des panneaux. Salons « souples » (propositions, bugs, tickets) : seuls les doublons
// de panneau partent, car ils contiennent aussi des messages à suivre (sugg_ok_12…).
const STRICTS = ['ANTISPAM_CHANNEL_ID', 'INVITE_HUB_CHANNEL_ID', 'HUB_CHANNEL_ID', 'REGLEMENT_CHANNEL_ID', 'BIRTHDAY_CHANNEL_ID', 'TEMPVOICE_PANEL_CHANNEL_ID', 'ROLES_CHANNEL_ID'];
const SOUPLES = ['SUGG_CHANNEL_ID', 'MODS_CHANNEL_ID', 'BUG_HUB_CHANNEL_ID', 'TICKET_CHANNEL_ID'];

// Signature d'un panneau : ses boutons (sans numéro), ou le titre de l'embed
function signature(m, parTitre) {
  const ids = m.components.flatMap(r => r.components.map(b => b.customId)).filter(Boolean);
  if (ids.length) return ids.some(i => /\d/.test(i)) ? null : ids.join(',');
  // panneau sans bouton (anti-spam, centre de contrôle) : reconnu à son titre
  return m.embeds[0]?.title || null;
}

// strict : les messages du bot sans signature de panneau sont supprimés aussi
async function epurer(client, channelId, strict = true, parTitre = false) {
  const channel = channelId && (client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null));
  if (!channel?.messages) return 0;
  const messages = [...(await channel.messages.fetch({ limit: 100 }).catch(() => new Map())).values()]
    .filter(m => m.author.id === client.user.id)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const vus = new Set();
  let n = 0;
  for (const m of messages) {
    const sig = signature(m, parTitre);
    const garder = sig ? !vus.has(sig) : !strict;
    if (sig) vus.add(sig);
    if (!garder) await m.delete().then(() => n++).catch(() => {});
  }
  return n;
}

async function nettoyerTout(client) {
  let total = 0;
  for (const cle of STRICTS) total += await epurer(client, process.env[cle], true);
  for (const cle of SOUPLES) total += await epurer(client, process.env[cle], false);
  total += await epurer(client, process.env.STATUS_CHANNEL_ID, true, true);
  if (total) console.log('🧹 ' + total + ' ancien(s) message(s) supprimé(s)');
  return total;
}

module.exports = { nettoyerTout, epurer, dedoublonner: epurer };
