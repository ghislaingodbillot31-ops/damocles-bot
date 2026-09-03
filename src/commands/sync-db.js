const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs   = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-db')
    .setDescription('Synchronise la base de données avec les membres Discord actuels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Répondre IMMÉDIATEMENT
    await interaction.reply({
      embeds: [{ description: '⏳ Synchronisation en cours... Cela peut prendre quelques secondes.', color: 0xF39C12 }],
      flags: 64,
    });

    // Faire le travail en arrière-plan
    syncDatabase(interaction).catch(console.error);
  },
};

async function syncDatabase(interaction) {
  const guild = interaction.guild;
  const now   = new Date().toISOString();

  const DB_PATH = require('../paths').dataPath('members.json');
  let dbRaw = {};
  if (fs.existsSync(DB_PATH)) {
    dbRaw = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }

  // Récupérer tous les membres Discord
  const discordMembers = await guild.members.fetch();
  const discordIds     = new Set(
    [...discordMembers.values()]
      .filter(m => !m.user.bot)
      .map(m => m.user.id)
  );

  let ajoutes   = 0;
  let presences = 0;
  let absences  = 0;

  // 1. Membres Discord → ajouter/marquer présents
  for (const [id, member] of discordMembers) {
    if (member.user.bot) continue;

    if (dbRaw[id]) {
      if (!dbRaw[id].present) {
        dbRaw[id].present = true;
        dbRaw[id].status  = 'active';
        dbRaw[id].leftAt  = null;
        if (!dbRaw[id].history) dbRaw[id].history = [];
        dbRaw[id].history.push({ event: 'sync_rejoin', date: now });
        presences++;
      }
      dbRaw[id].username = member.user.username;
      dbRaw[id].tag      = member.user.tag;
      if (member.joinedAt && !dbRaw[id].joinedAt) {
        dbRaw[id].joinedAt = member.joinedAt.toISOString();
      }
    } else {
      dbRaw[id] = {
        id, tag: member.user.tag, username: member.user.username,
        avatar: member.user.avatar || null,
        status: 'active', present: true,
        firstSeen: now, joinedAt: member.joinedAt?.toISOString() || now,
        leftAt: null, kickedAt: null, bannedAt: null, banReason: null,
        verifiedAt: null, verificationResult: null,
        adminAccepted: null, adminAcceptedBy: null,
        reglementAcceptedAt: null, firstMessageAt: null,
        anniversaire: null, warnings: [], visits: 1,
        history: [{ event: 'sync_add', date: now }],
      };
      ajoutes++;
    }
  }

  // 2. En DB mais pas sur Discord → marquer absent
  for (const [id, member] of Object.entries(dbRaw)) {
    if (!discordIds.has(id) && member.present) {
      dbRaw[id].present = false;
      if (!['banned', 'kicked'].includes(dbRaw[id].status)) {
        dbRaw[id].status = 'left';
        dbRaw[id].leftAt = dbRaw[id].leftAt || now;
      }
      if (!dbRaw[id].history) dbRaw[id].history = [];
      dbRaw[id].history.push({ event: 'sync_absent', date: now });
      absences++;
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(dbRaw, null, 2), 'utf-8');

  const total   = Object.keys(dbRaw).length;
  const present = Object.values(dbRaw).filter(m => m.present).length;
  const absent  = Object.values(dbRaw).filter(m => !m.present).length;

  await interaction.editReply({
    embeds: [{
      title: '✅ Synchronisation terminée',
      description: [
        '➕ Membres ajoutés : **' + ajoutes + '**',
        '🟢 Marqués présents : **' + presences + '**',
        '🔴 Marqués absents : **' + absences + '**',
        '',
        '👥 Total DB : **' + total + '** membres',
        '✅ Présents : **' + present + '**',
        '❌ Absents : **' + absent + '**',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'Damoclès Security Bot' },
      timestamp: new Date().toISOString(),
    }],
  });

  console.log('🔄 Sync DB — ' + ajoutes + ' ajoutés, ' + presences + ' réactivés, ' + absences + ' absents');
}