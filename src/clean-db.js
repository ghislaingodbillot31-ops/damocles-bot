// Script à lancer UNE SEULE FOIS pour nettoyer la base de données
// node src/clean-db.js

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'members.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  console.log('✅ Bot connecté : ' + client.user.tag);

  const guild = client.guilds.cache.first();
  if (!guild) { console.error('❌ Serveur introuvable'); process.exit(1); }

  // Récupérer TOUS les membres Discord actuels
  console.log('📡 Chargement des membres Discord...');
  const discordMembers = await guild.members.fetch();
  const discordIds = new Set(discordMembers.map(m => m.user.id));
  console.log('👥 ' + discordIds.size + ' membres sur Discord');

  // Charger la DB
  let db = {};
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }

  const avant = Object.keys(db).length;
  console.log('💾 ' + avant + ' entrées en DB avant nettoyage');

  // Nettoyer les faux membres
  // Un faux membre = en DB mais jamais vraiment venu (pas d'historique de join réel)
  let supprimes = 0;
  let gardes    = 0;
  let miseAJour = 0;

  for (const [id, member] of Object.entries(db)) {
    const estSurDiscord = discordIds.has(id);
    const aUnHistorique = member.history && member.history.length > 0;
    const aRejoins      = member.history?.some(h => h.event === 'join' || h.event === 'rejoin');
    const aUnRole       = member.status && member.status !== 'active'; // banned, kicked, left = vrais

    if (!aUnHistorique && !estSurDiscord && !aUnRole) {
      // Faux membre — supprimer
      delete db[id];
      supprimes++;
    } else if (estSurDiscord) {
      // Membre actuel — mettre à jour username
      const discordMember = discordMembers.get(id);
      if (discordMember) {
        db[id].username = discordMember.user.username;
        db[id].tag      = discordMember.user.tag;
        // S'assurer que joinedAt est correct
        if (!db[id].joinedAt && discordMember.joinedAt) {
          db[id].joinedAt = discordMember.joinedAt.toISOString();
        }
      }
      miseAJour++;
      gardes++;
    } else {
      gardes++;
    }
  }

  // Ajouter les membres Discord qui ne sont pas en DB
  let ajoutes = 0;
  for (const [id, discordMember] of discordMembers) {
    if (!db[id] && !discordMember.user.bot) {
      const now = new Date().toISOString();
      db[id] = {
        id,
        tag:      discordMember.user.tag,
        username: discordMember.user.username,
        status:   'active',
        firstSeen: now,
        joinedAt:  discordMember.joinedAt?.toISOString() || now,
        leftAt:    null, kickedAt: null, bannedAt: null, banReason: null,
        warnings:  [],
        verifiedAt: null, verificationResult: null,
        reglementAcceptedAt: null,
        history: [{ event: 'join_retroactif', date: now }],
        visits: 1,
      };
      ajoutes++;
    }
  }

  // Sauvegarder
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  const apres = Object.keys(db).length;
  console.log('\n✅ Nettoyage terminé :');
  console.log('  🗑️  Supprimés (faux membres) : ' + supprimes);
  console.log('  ✅  Gardés/mis à jour        : ' + gardes + ' (' + miseAJour + ' mis à jour)');
  console.log('  ➕  Ajoutés (membres Discord) : ' + ajoutes);
  console.log('  💾  Total DB                 : ' + apres + ' (était ' + avant + ')');

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
