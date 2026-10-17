// ID de salon/rôle/catégorie : .env > config.json (aucune valeur par défaut : chaque ID vient de la configuration).
// Une 2e instance (autre serveur) remplit config.json via clone-server.js.
const config = require('./config');
const cfg = config.get();
module.exports = (key, fallback = '') => process.env[key] || cfg[key] || fallback;
