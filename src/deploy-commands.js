const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  require('./commands/expulsion').data.toJSON(),
  require('./commands/banid').data.toJSON(),
  require('./commands/sanction').data.toJSON(),
  require('./commands/bouton').data.toJSON(),
  require('./commands/analyse').data.toJSON(),
  require('./commands/ajouter-bouton-reglement').data.toJSON(),
  require('./commands/ticket').data.toJSON(),
  require('./commands/anniversaire').data.toJSON(),
  require('./commands/verifier').data.toJSON(),
  require('./commands/sync-db').data.toJSON(),
  require('./commands/contrat').data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  console.log('📡 Enregistrement des commandes...');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ Commandes enregistrées : /expulsion /banid /sanction /bouton /analyse /anniversaire /verifier /sync-db /contrat + menus règlement & ticket');
})();
