// Lance UNIQUEMENT Multifruit en local (le reste du bot n'est pas démarré) :
// enregistre les 3 commandes du jeu (sans toucher aux autres), installe catégorie + salons + panneau, puis écoute les interactions « mf: ».
//   npm run multifruit
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const mf = require('./index');
const { installerServeur, publierClassements, publierMarche } = require('./commands');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  console.log('🍹 Multifruit local connecté : ' + client.user.tag);
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  for (const c of mf.commands) await rest.post(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: c });
  console.log('✅ Commandes : ' + mf.commands.map(c => '/' + c.name).join(' '));
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  console.log(await installerServeur(guild));
  setInterval(() => publierClassements(guild).catch(e => console.error('Classements :', e.message)), 5 * 60 * 1000);
  setInterval(() => publierMarche(guild).catch(e => console.error('Marché :', e.message)), 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, i => { mf.handle(i).catch(e => console.error(e)); });
client.login(process.env.DISCORD_TOKEN);
