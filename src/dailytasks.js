// Tâche quotidienne : rafraîchir la liste des membres, nettoyer la base,
// relancer l'analyse actifs/inactifs et le message de statut.
const db = require('./database');

// Réconcilie la base avec les membres réellement présents sur le serveur
async function refreshMembers(guild) {
  const membres = await guild.members.fetch();

  let synced = 0;
  for (const [, m] of membres) {
    if (m.user.bot) continue;
    await db.upsertMember(m.user, { joinedAt: m.joinedAt?.toISOString(), present: true });
    synced++;
  }

  // Marquer « partis » ceux qui ne sont plus sur le serveur
  const all = await db.getAllMembers();
  let left = 0;
  for (const rec of all) {
    if (rec.present && !membres.has(rec.id)) {
      await db.memberLeft({ id: rec.id, tag: rec.tag || rec.id, username: rec.username || rec.id });
      left++;
    }
  }

  return { synced, left };
}

async function runDaily(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  console.log('🔄 Tâche quotidienne — démarrage');

  try {
    const { synced, left } = await refreshMembers(guild);
    console.log('   👥 ' + synced + ' membres synchronisés, ' + left + ' marqués partis');
  } catch (e) { console.error('   ⚠️ Sync membres :', e.message); }

  try {
    const { before, removed, after } = await db.cleanDatabase();
    console.log('   🧹 Base nettoyée : ' + removed + ' fiche(s) retirée(s) (' + before + ' → ' + after + ')');
  } catch (e) { console.error('   ⚠️ Nettoyage base :', e.message); }

  try {
    const { runAuto } = require('./commands/analyse');
    const r = await runAuto(guild);
    if (r) console.log('   📊 Analyse : ' + r.inactive + ' inactifs, ' + r.reactivated + ' réactivés, ' + r.toExpel + ' à expulser');
  } catch (e) { console.error('   ⚠️ Analyse :', e.message); }

  try {
    const { updateStatusMessage } = require('./statusbot');
    await updateStatusMessage(client, true);
  } catch (e) { console.error('   ⚠️ Message de statut :', e.message); }

  console.log('🔄 Tâche quotidienne — terminée');
}

function startDailyTasks(client, cron) {
  // Tous les jours à 04h00 (heure de Paris)
  cron.schedule('0 4 * * *', () => runDaily(client), { timezone: 'Europe/Paris' });
  console.log('🗓️ Tâche quotidienne planifiée — tous les jours à 04h00');
}

module.exports = { startDailyTasks, runDaily, refreshMembers };
