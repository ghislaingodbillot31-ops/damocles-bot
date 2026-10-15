const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

client.once('clientReady', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const INACTIVE_ROLE_ID = process.env.INACTIVE_ROLE_ID;
  if (!INACTIVE_ROLE_ID) {
    console.error('❌ INACTIVE_ROLE_ID manquant dans .env');
    process.exit(1);
  }

  for (const [, guild] of client.guilds.cache) {
    console.log(`\n🔍 Serveur : ${guild.name}`);

    const members = await guild.members.fetch();
    const inactiveRole = guild.roles.cache.get(INACTIVE_ROLE_ID);

    if (!inactiveRole) {
      console.error(`❌ Rôle Inactif introuvable (ID: ${INACTIVE_ROLE_ID})`);
      process.exit(1);
    }

    const toProcess = members.filter(m =>
      !m.user.bot && m.roles.cache.has(INACTIVE_ROLE_ID)
    );

    console.log(`👥 ${toProcess.size} membres avec le rôle Inactif`);

    let done = 0;
    for (const [, member] of toProcess) {
      await member.roles.remove(inactiveRole).catch(console.error);
      done++;
      process.stdout.write(`\r  Traité : ${done} / ${toProcess.size}  `);
      await sleep(300);
    }

    console.log(`\n\n✅ Terminé — rôle Inactif retiré à ${done} membres`);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
