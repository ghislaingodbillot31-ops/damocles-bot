const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { panneau } = require('../embed-format');
const db = require('../database');

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

// Toutes les écritures passent par src/database.js.
// On ne touche JAMAIS members.json directement : un load→save brut autour du
// `await fetch()` écraserait toute
// écriture concurrente (ban, règlement, 1er message…) faite pendant le fetch.
async function syncDatabase(interaction) {
  const guild = interaction.guild;
  const now   = new Date().toISOString();

  // 1) Snapshot Discord AVANT toute écriture — plus aucune lecture de la DB
  //    n'est conservée en mémoire par-dessus un await.
  const discordMembers = await guild.members.fetch();
  const humans     = [...discordMembers.values()].filter(m => !m.user.bot);
  const discordIds = new Set(humans.map(m => m.user.id));

  let ajoutes = 0, presences = 0, absences = 0;

  // 2) Membres présents sur Discord → créer / réactiver
  for (const member of humans) {
    const existing = await db.getMember(member.user.id);

    if (!existing) {
      await db.upsertMember(member.user, {
        joinedAt: member.joinedAt ? member.joinedAt.toISOString() : now,
      });
      await db.updateMember(member.user.id, null, { history: { event: 'sync_add', date: now } });
      ajoutes++;
      continue;
    }

    const set = { username: member.user.username, tag: member.user.tag };
    if (member.joinedAt && !existing.joinedAt) set.joinedAt = member.joinedAt.toISOString();

    let push = null;
    if (!existing.present) {
      set.present = true;
      set.status  = db.STATUS.ACTIVE;
      set.leftAt  = null;
      push = { history: { event: 'sync_rejoin', date: now } };
      presences++;
    }

    await db.updateMember(member.user.id, set, push);
  }

  // 3) En DB, présents, mais absents de Discord → marquer absent.
  //    On relit chaque fiche juste avant d'écrire pour ne pas transformer en
  //    « left » un membre banni/kické entre-temps.
  const snapshot = await db.getAllMembers();
  for (const snap of snapshot) {
    if (discordIds.has(snap.id)) continue;

    const m = await db.getMember(snap.id);
    if (!m || !m.present) continue;

    const set = { present: false };
    if (![db.STATUS.BANNED, db.STATUS.KICKED].includes(m.status)) {
      set.status = db.STATUS.LEFT;
      set.leftAt = m.leftAt || now;
    }

    await db.updateMember(m.id, set, { history: { event: 'sync_absent', date: now } });
    absences++;
  }

  const stats = await db.getStats();

  await interaction.editReply(panneau({
    embeds: [{
      title: '✅ Synchronisation terminée',
      description: [
        '➕ Membres ajoutés : **' + ajoutes + '**',
        '🟢 Marqués présents : **' + presences + '**',
        '🔴 Marqués absents : **' + absences + '**',
        '',
        '👥 Total DB : **' + stats.total + '** membres',
        '✅ Présents : **' + stats.present + '**',
        '❌ Absents : **' + stats.absent + '**',
      ].join('\n'),
      color: 0x2ECC71,
      footer: { text: 'DAMOCLES' },
      timestamp: new Date().toISOString(),
    }],
  }));

  console.log('🔄 Sync DB — ' + ajoutes + ' ajoutés, ' + presences + ' réactivés, ' + absences + ' absents');
}
