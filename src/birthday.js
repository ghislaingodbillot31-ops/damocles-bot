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

// ── Afficher TOUS les anniversaires de l'année groupés par mois ───────────────
async function updateBirthdayChannel(client) {
  const guild   = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID);
  if (!channel) return;

  const today    = new Date();
  const todayDay = today.getDate();
  const todayMois = today.getMonth() + 1;

  // Récupérer tous les membres avec anniversaire
  const allMembersRaw = await db.getAllMembers();
  const allMembers = allMembersRaw.filter(m => m.anniversaire);

  // Grouper par mois
  const parMois = {};
  for (let i = 1; i <= 12; i++) parMois[i] = [];

  for (const m of allMembers) {
    const parts = m.anniversaire.split('/');
    const mois  = parseInt(parts[1]);
    if (mois >= 1 && mois <= 12) parMois[mois].push(m);
  }

  // Trier chaque mois par jour
  for (let i = 1; i <= 12; i++) {
    parMois[i].sort((a, b) => {
      return parseInt(a.anniversaire.split('/')[0]) - parseInt(b.anniversaire.split('/')[0]);
    });
  }

  // Effacer les anciens messages du bot
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    for (const [, msg] of msgs) {
      if (msg.author.id === client.user.id) await msg.delete().catch(() => {});
    }
  } catch {}

  // Message d'explication
  await channel.send({
    embeds: [{
      title: '🎂 Anniversaires — ' + today.getFullYear(),
      description: [
        '**Comment enregistrer ton anniversaire ?**',
        '> Utilise la commande `/anniversaire` suivie de ta date de naissance',
        '> **Exemple :** `/anniversaire 20/11/1988`',
        '',
        'Le jour de ton anniversaire, un message apparaîtra automatiquement dans le salon général !',
      ].join('\n'),
      color: 0xF1C40F,
      footer: { text: 'Mis à jour le ' + today.toLocaleDateString('fr-FR') + ' — Damoclès Bot' },
      timestamp: new Date().toISOString(),
    }]
  }).catch(console.error);

  // Un embed par mois (seulement les mois non vides)
  for (let mois = 1; mois <= 12; mois++) {
    const membres = parMois[mois];
    if (!membres.length) continue;

    const isMoisActuel = mois === todayMois;

    const lines = membres.map(m => {
      const parts  = m.anniversaire.split('/');
      const jour   = parseInt(parts[0]);
      const annee  = parseInt(parts[2]);
      const age    = today.getFullYear() - annee;
      const isToday = jour === todayDay && mois === todayMois;

      const emoji  = isToday ? '🎉' : (mois < todayMois || (mois === todayMois && jour < todayDay) ? '✅' : '📅');
      const name   = m.username || 'Inconnu';
      const dateStr = String(jour).padStart(2, '0') + '/' + String(mois).padStart(2, '0');

      return emoji + ' **' + name + '** — ' + dateStr + (isToday ? ' 🎂' : '') + ' *(' + age + ' ans)*';
    }).join('\n');

    await channel.send({
      embeds: [{
        title: (isMoisActuel ? '📍 ' : '') + MOIS[mois],
        description: lines,
        color: isMoisActuel ? 0xF1C40F : 0x2F3136,
      }]
    }).catch(console.error);

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('🎂 Salon anniversaires mis à jour — ' + allMembers.length + ' anniversaire(s)');
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