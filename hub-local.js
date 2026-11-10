// Mode « un seul salon » : connecte le bot uniquement pour le HUB des exploitants
// (boutons nv_*, cases, niveaux). Ne touche à aucun autre salon. Lancer : node hub-local.js
require('dotenv').config();
const { Client } = require('discord.js');
const hub = require('./src/farm/hub2');
const succes = require('./src/farm/fs25-succes');
const { lireStatutUneFois } = require('./src/farm/fs25-bridge');

const client = new Client({ intents: [1] });
const tick = () => lireStatutUneFois().then(st => succes.processAchievements(st, null)).catch(e => console.warn('Lecture FS25 :', e.message));

client.once('clientReady', () => {
  hub.init(client);
  tick(); setInterval(tick, 5 * 60 * 1000);
  console.log('HUB exploitants local prêt');
});
client.on('interactionCreate', i => { if (i.customId?.startsWith('nv_')) hub.handle(i); });
client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
