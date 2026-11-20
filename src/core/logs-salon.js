// Salon de logs du serveur : une ligne de texte par événement (même format que le log du tuto : emoji + noms en gras), sans ping.
const SALON_LOGS = '1567011774912532671';

async function logsSalon(client, ligne) {
  const ch = await client.channels.fetch(SALON_LOGS).catch(() => null);
  await ch?.send({ content: ligne, allowedMentions: { parse: [] } }).catch(console.error);
}

// Nom affiché d'un joueur (pseudo du serveur), à défaut sa mention (sans ping)
const nomAffiche = async (guild, id) => (await guild?.members.fetch(id).catch(() => null))?.displayName || '<@' + id + '>';

module.exports = { logsSalon, nomAffiche, SALON_LOGS };
