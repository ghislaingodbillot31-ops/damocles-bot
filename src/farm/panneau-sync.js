// Actualise un panneau SANS notification : on édite le message existant (une édition ne notifie pas
// et ne crée pas de « non lu »). Seul un message introuvable est republié.
// `avantEnvoi` (optionnel) : nettoyage à faire uniquement quand il faut vraiment republier.
// `nom` (optionnel) : le panneau est signalé dans le rapport des logs staff.
async function publier(channel, msgId, payload, avantEnvoi, nom) {
  const m = msgId && await channel.messages.fetch(msgId).catch(() => null);
  if (m && await m.edit(payload).then(() => true, () => false)) { noter(channel, nom, 'modifié'); return m; }
  if (avantEnvoi) await avantEnvoi();
  const msg = await channel.send(payload);
  noter(channel, nom, 'republié');
  return msg;
}

// ── Rapport dans les logs staff : un seul message groupé, envoyé 15 s après la dernière mise à jour ──
const ICONE = { modifié: '✏️', republié: '📤' };
const tampon = [];
let minuteur = null;

const formater = lignes => lignes.map(l => ICONE[l.action] + ' **' + l.nom + '** · <#' + l.salon + '> · ' + l.action).join('\n');

function noter(channel, nom, action) {
  if (!nom) return;
  tampon.push({ nom, action, salon: channel.id });
  clearTimeout(minuteur);
  minuteur = setTimeout(() => envoyerRapport(channel.client), 15_000);
  minuteur.unref?.();
}

async function envoyerRapport(client) {
  const lignes = tampon.splice(0);
  const ch = process.env.LOG_CHANNEL_ID && client.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (!ch || !lignes.length) return;
  await ch.send({
    embeds: [{ title: '🔄 Panneaux actualisés', description: formater(lignes), color: 0x95A5A6, timestamp: new Date().toISOString() }],
    flags: 4096, // sans notification
  }).catch(() => {});
}

module.exports = { publier, noter, formater };
