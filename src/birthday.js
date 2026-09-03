const db = require('./database');
require('dotenv').config();

const BIRTHDAY_CHANNEL_ID = '1538533316410474547';
const GENERAL_CHANNEL_ID  = process.env.CHAT_CHANNEL_ID || '1538533261314236527';

const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ── Message d'anniversaire dans #général ──────────────────────────────────────
async function sendBirthdayMessages(client) {
  const members = await db.getAnniversairesAujourdhui();
  if (!members.length) return;

  const guild   = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(GENERAL_CHANNEL_ID);
  if (!channel) return;

  const today = new Date();

  for (const m of members) {
    const parts = m.anniversaire.split('/');
    const age   = today.getFullYear() - parseInt(parts[2]);

    await channel.send({
      embeds: [{
        description: [
          '🎂 **Joyeux anniversaire <@' + m.id + '> !**',
          '',
          '> Toute l\'équipe de **VANGUARD** te souhaite un excellent anniversaire ! 🥳',
          '> Tu fêtes aujourd\'hui tes **' + age + ' ans** !',
          '',
          '🎉 Bon anniversaire de la part de toute la communauté !',
        ].join('\n'),
        color: 0xF1C40F,
        footer: { text: 'Damoclès Security Bot' },
        timestamp: new Date().toISOString(),
      }]
    }).catch(console.error);
  }
}

// ── Liste globale : prochain anniversaire en tête + tous les suivants ────────
async function updateBirthdayChannel(client) {
  const guild   = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID);
  if (!channel) return;

  const now    = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Membres avec un anniversaire valide JJ/MM/AAAA
  const all = (await db.getAllMembers())
    .filter(m => m.anniversaire && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(m.anniversaire));

  // Effacer les anciens messages du bot
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    for (const [, msg] of msgs) {
      if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
    }
  } catch {}

  if (!all.length) {
    await channel.send({
      embeds: [{
        title: '🎂  ANNIVERSAIRES',
        description: '*Aucun anniversaire enregistré pour le moment.*\n\nEnregistre le tien avec `/anniversaire JJ/MM/AAAA` (ex : `/anniversaire 20/11/1988`).',
        color: 0xF1C40F,
      }]
    }).catch(console.error);
    return;
  }

  // Prochaine occurrence de chaque anniversaire
  const list = all.map(m => {
    const [jj, mm, aaaa] = m.anniversaire.split('/').map(Number);
    let next = new Date(now.getFullYear(), mm - 1, jj);
    if (next < today0) next = new Date(now.getFullYear() + 1, mm - 1, jj);
    const jours = Math.round((next - today0) / 86400000);
    return { id: m.id, jj, mm, aaaa, next, jours, age: next.getFullYear() - aaaa, isToday: jours === 0 };
  }).sort((a, b) => a.next - b.next);

  const dateLongue = e => e.jj + ' ' + MOIS[e.mm].toLowerCase() + ' ' + e.next.getFullYear();
  const dateCourte = e => String(e.jj).padStart(2, '0') + '/' + String(e.mm).padStart(2, '0');

  const prochain = list[0];
  const suivants = list.slice(1);

  const tete = prochain.isToday
    ? '## 🎉 Aujourd\'hui !\n> C\'est l\'anniversaire de <@' + prochain.id + '> — **' + prochain.age + ' ans** 🥳'
    : '## 🎂 Prochain anniversaire\n> **le ' + dateLongue(prochain) + '** de <@' + prochain.id + '>\n'
      + '> dans **' + prochain.jours + ' jour' + (prochain.jours > 1 ? 's' : '') + '** — il/elle aura **' + prochain.age + ' ans**';

  const lignes = suivants.map(e =>
    '• `' + dateCourte(e) + '` — <@' + e.id + '>  ·  ' + e.age + ' ans  ·  dans ' + e.jours + ' j'
  );

  // Respecter la limite de 4096 caractères
  let corps = '';
  let affiches = 0;
  for (const l of lignes) {
    if (corps.length + l.length + 1 > 3400) break;
    corps += (corps ? '\n' : '') + l;
    affiches++;
  }
  if (affiches < lignes.length) corps += '\n*… et ' + (lignes.length - affiches) + ' autre(s)*';

  await channel.send({
    embeds: [{
      title: '🎂  ANNIVERSAIRES  —  ' + all.length + ' enregistré' + (all.length > 1 ? 's' : ''),
      description: [
        tete,
        '',
        '**📋 Anniversaires suivants**',
        corps || '*aucun autre*',
        '',
        '-# Enregistre le tien avec `/anniversaire JJ/MM/AAAA`',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'Mis à jour le ' + now.toLocaleDateString('fr-FR') + ' — Damoclès Bot' },
      timestamp: now.toISOString(),
    }]
  }).catch(console.error);

  console.log('🎂 Salon anniversaires mis à jour — ' + all.length + ' anniversaire(s)');
}

// ── Tâches cron ───────────────────────────────────────────────────────────────
function startBirthdayTasks(client, cron) {
  // Tous les jours à minuit
  cron.schedule('0 0 * * *', () => {
    sendBirthdayMessages(client);
    updateBirthdayChannel(client);
    console.log('🎂 Vérification anniversaires du jour');
  }, { timezone: 'Europe/Paris' });

  // Au démarrage
  updateBirthdayChannel(client);
  console.log('🎂 Système anniversaires démarré');
}

module.exports = { startBirthdayTasks, updateBirthdayChannel, sendBirthdayMessages };