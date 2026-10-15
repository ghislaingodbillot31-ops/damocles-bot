const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN    = 'MTUxMDMxMzU3OTExNzY3ODc5NQ.GK9Ri_.OPUfC-BgwPGwhB6WITJsSywLYfcZicm6cTgfjU';
const GUILD_ID = '1208785889849905172';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('❌ Serveur introuvable'); process.exit(1); }

  await guild.channels.fetch();
  await guild.roles.fetch();

  console.log('\n# SALONS');
  guild.channels.cache
    .filter(c => c.type === 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(c => console.log(c.name + ' = ' + c.id));

  console.log('\n# RÔLES');
  guild.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .forEach(r => console.log(r.name + ' = ' + r.id));

  process.exit(0);
});

client.login(TOKEN);