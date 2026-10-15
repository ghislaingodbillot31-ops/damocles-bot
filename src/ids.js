// ID de salon/rôle/catégorie : .env > config.json > valeur d'origine (serveur EUROAGRI).
// Une 2e instance (autre serveur) remplit config.json via clone-server.js.
const config = require('./config');
const cfg = config.get();
module.exports = (key, fallback = '') => process.env[key] || cfg[key] || fallback;
