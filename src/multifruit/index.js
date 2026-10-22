// Point d'entrée de Multifruit : seul fichier que le reste du bot connaît.
// Validation des données et ouverture de la base au chargement (erreurs claires au démarrage).
const commandes   = require('./commands');
const interactions = require('./interactions');
require('./systems/contenu');
require('./db/db');

const NOMS = new Set(commandes.data.map(c => c.name));

// Renvoie true si l'interaction appartient à Multifruit (et a été prise en charge).
async function handle(interaction) {
  if (interaction.isChatInputCommand() && NOMS.has(interaction.commandName)) {
    try { await commandes.executer(interaction); } catch (err) { console.error('Erreur Multifruit :', err.stack || err.message); }
    return true;
  }
  if (interaction.customId && interaction.customId.startsWith('mf:')) { await interactions.gerer(interaction); return true; }
  return false;
}

module.exports = { handle, commands: commandes.data };
