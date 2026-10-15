const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

client.once('clientReady', async () => {
  console.log(`✅ Connecté : ${client.user.tag}`);

  const REGLEMENT_ROLE_ID = process.env.REGLEMENT_ROLE_ID;
  if (!REGLEMENT_ROLE_ID) { console.error('❌ REGLEMENT_ROLE_ID manquant'); process.exit(1); }

  for (const [, guild] of client.guilds.cache) {
    console.log(`\n🔍 Serveur : ${guild.name}`);
    const members = await guild.members.fetch();
    const role    = guild.roles.cache.get(REGLEMENT_ROLE_ID);

    if (!role) { console.error('❌ Rôle Règlement introuvable'); process.exit(1); }

    const toProcess = members.filter(m => !m.user.bot && !m.roles.cache.has(REGLEMENT_ROLE_ID));
    console.log(`👥 ${toProcess.size} membres sans le rôle Règlement`);

    let done = 0;
    for (const [, member] of toProcess) {
      await member.roles.add(role).catch(console.error);
      done++;
      process.stdout.write(`\r  Traité : ${done} / ${toProcess.size}  `);
      await sleep(300);
    }

    console.log(`\n\n✅ Terminé — rôle Règlement donné à ${done} membres`);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
